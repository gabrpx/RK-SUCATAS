// Aba Configurações: controle total sobre as tabelas de apoio do sistema —
// categorias de peça e formas de pagamento (criar, renomear quando aplicável,
// excluir). Modelos de moto continuam com cadastro rápido embutido no
// formulário de Estoque/Vendas — não precisam de uma tela dedicada por ora.
import { Settings, Layers, Wallet } from 'lucide-react';
import { cn } from '../../utils';
import { useCatalogos } from '../../hooks/useCatalogos';
import { ManageListSection } from './ManageListSection';

export function ConfiguracoesView({ theme }: { theme: 'light' | 'dark' }) {
  const { categorias, formasPagamento, criarCategoria, excluirCategoria, criarFormaPagamento, renomearFormaPagamento, excluirFormaPagamento } = useCatalogos();

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-zinc-500/10 rounded-2xl">
          <Settings className={theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'} size={28} />
        </div>
        <div>
          <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Configurações</h2>
          <p className="text-sm text-zinc-500">Categorias e formas de pagamento do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ManageListSection theme={theme} titulo="Categorias de Peça" icone={Layers} itens={categorias} onCriar={criarCategoria} onExcluir={excluirCategoria} />
        <ManageListSection
          theme={theme}
          titulo="Formas de Pagamento"
          icone={Wallet}
          itens={formasPagamento}
          onCriar={criarFormaPagamento}
          onRenomear={renomearFormaPagamento}
          onExcluir={excluirFormaPagamento}
        />
      </div>
    </div>
  );
}
