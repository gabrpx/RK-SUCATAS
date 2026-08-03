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
import { useCatalogos } from '../../hooks/useCatalogos';
import { ManageListSection } from './ManageListSection';
import { CategoriaTreeManager } from './CategoriaTreeManager';
import { MotoTreeManager } from './MotoTreeManager';
import { UsuariosView } from '../usuarios/UsuariosView';
import { PromocoesView } from '../promocoes/PromocoesView';

type Aba = 'categorias' | 'motos' | 'pagamento' | 'promocoes' | 'usuarios';

export function ConfiguracoesView({ theme, userRole }: { theme: 'light' | 'dark'; userRole?: string }) {
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
  } = useCatalogos();

  const [aba, setAba] = useState<Aba>('categorias');

  const abas: { id: Aba; label: string; icone: typeof Layers; total?: number }[] = [
    { id: 'categorias', label: 'Categorias de Peça', icone: Layers, total: categorias.length },
    { id: 'motos', label: 'Motos', icone: Bike, total: modelos.length },
    { id: 'pagamento', label: 'Formas de Pagamento', icone: Wallet, total: formasPagamento.length },
    { id: 'promocoes', label: 'Promoções', icone: Tag },
    ...(userRole === 'admin' ? [{ id: 'usuarios' as Aba, label: 'Usuários', icone: Users }] : []),
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-zinc-500/10 rounded-2xl">
          <Settings className={theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'} size={28} />
        </div>
        <div>
          <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Configurações</h2>
          <p className="text-sm text-zinc-500">Categorias, motos e formas de pagamento do sistema</p>
        </div>
      </div>

      <div
        className={cn(
          'flex items-center gap-1 p-1.5 rounded-2xl border overflow-x-auto',
          theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-100/70 border-zinc-200'
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
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shrink-0',
                ativo
                  ? 'bg-violet-600 text-white shadow-sm'
                  : theme === 'dark'
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-white'
              )}
            >
              <Icone size={16} />
              {item.label}
              {item.total !== undefined && (
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    ativo ? 'bg-white/20 text-white' : theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
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
          theme={theme}
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
          theme={theme}
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
          theme={theme}
          titulo="Formas de Pagamento"
          icone={Wallet}
          itens={formasPagamento}
          onCriar={criarFormaPagamento}
          onRenomear={renomearFormaPagamento}
          onExcluir={excluirFormaPagamento}
        />
      )}
      {aba === 'promocoes' && <PromocoesView />}
      {aba === 'usuarios' && userRole === 'admin' && <UsuariosView />}
    </div>
  );
}
