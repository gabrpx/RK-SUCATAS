// Aba Configurações: controle total sobre as tabelas de apoio do sistema —
// categorias de peça e formas de pagamento (criar, renomear quando aplicável,
// excluir). Modelos de moto continuam com cadastro rápido embutido no
// formulário de Estoque/Vendas — não precisam de uma tela dedicada por ora.
// Layout em abas: cada seção ocupa a largura toda em vez de disputar espaço
// num grid apertado — reduz a poluição visual de ter três painéis densos
// (árvores de categoria/moto com drag handle + 4 ícones por linha) abertos
// ao mesmo tempo.
import { useState } from 'react';
import { Settings, Layers, Bike, Wallet, Users, Tag } from 'lucide-react';
import { cn } from '../../utils';
import { usePermissao } from '../../hooks/usePermissao';
import { useCatalogos } from '../../hooks/useCatalogos';
import { ManageListSection } from './ManageListSection';
import { CategoriaTreeManager } from './CategoriaTreeManager';
import { MotoTreeManager } from './MotoTreeManager';
import { UsuariosView } from '../usuarios/UsuariosView';
import { PromocoesView } from '../promocoes/PromocoesView';

type Aba = 'categorias' | 'motos' | 'pagamento' | 'promocoes' | 'usuarios';

export function ConfiguracoesView() {
  const { isAdmin } = usePermissao();
  const {
    categorias,
    modelos,
    formasPagamento,
    criarCategoria,
    renomearCategoria,
    moverCategoria,
    reordenarCategorias,
    excluirCategoria,
    criarNoMoto,
    criarMotoRapido,
    renomearMoto,
    moverMoto,
    reordenarMotos,
    excluirMoto,
    criarFormaPagamento,
    renomearFormaPagamento,
    excluirFormaPagamento,
    alternarNaturezaFormaPagamento,
  } = useCatalogos();

  const [aba, setAba] = useState<Aba>('categorias');

  const abas: { id: Aba; label: string; icone: typeof Layers; total?: number }[] = [
    { id: 'categorias', label: 'Categorias de Peça', icone: Layers, total: categorias.length },
    { id: 'motos', label: 'Motos', icone: Bike, total: modelos.length },
    { id: 'pagamento', label: 'Formas de Pagamento', icone: Wallet, total: formasPagamento.length },
    { id: 'promocoes', label: 'Promoções', icone: Tag },
    ...(isAdmin ? [{ id: 'usuarios' as Aba, label: 'Usuários', icone: Users }] : []),
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-accent/10 rounded-2xl">
          <Settings className={'text-accent'} size={28} />
        </div>
        <div>
          <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', 'text-text-primary')}>Configurações</h2>
          <p className="text-sm text-text-muted">Categorias, motos e formas de pagamento do sistema</p>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center gap-1 p-1.5 rounded-2xl border overflow-x-auto',
          'bg-surface-card border-border-subtle'
        )}
      >
        {abas.map((item) => {
          const Icone = item.icone;
          const ativo = aba === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold transition-colors shrink-0',
                ativo
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-raised'
              )}
            >
              <Icone size={16} />
              {item.label}
              {item.total !== undefined && (
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    ativo ? 'bg-white/20 text-white' : 'bg-surface-raised text-text-muted'
                  )}
                >
                  {item.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {aba === 'categorias' && (
        <CategoriaTreeManager
          categorias={categorias}
          onCriar={criarCategoria}
          onRenomear={renomearCategoria}
          onMover={moverCategoria}
          onReordenar={reordenarCategorias}
          onExcluir={excluirCategoria}
        />
      )}
      {aba === 'motos' && (
        <MotoTreeManager
          modelos={modelos}
          onCriar={criarNoMoto}
          onCriarRapido={criarMotoRapido}
          onRenomear={renomearMoto}
          onMover={moverMoto}
          onReordenar={reordenarMotos}
          onExcluir={excluirMoto}
        />
      )}
      {aba === 'pagamento' && (
        <ManageListSection
          titulo="Formas de Pagamento"
          icone={Wallet}
          itens={formasPagamento}
          onCriar={criarFormaPagamento}
          onRenomear={renomearFormaPagamento}
          onExcluir={excluirFormaPagamento}
          toggle={{
            rotulo: 'Fiado',
            ativo: (item) => item.natureza === 'fiado',
            onAlternar: (item) => alternarNaturezaFormaPagamento(item.id, item.natureza === 'fiado' ? 'avista' : 'fiado'),
          }}
        />
      )}
      {aba === 'promocoes' && <PromocoesView />}
      {aba === 'usuarios' && isAdmin && <UsuariosView />}
    </div>
  );
}
