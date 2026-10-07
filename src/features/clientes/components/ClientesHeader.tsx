import { Plus, ReceiptText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../../tarefas-preview/PreviewTabs';

export type ClientesTab = 'painel' | 'todos' | 'agenda';

interface ClientesHeaderProps {
  tab: ClientesTab;
  onTabChange: (tab: ClientesTab) => void;
  canCreate: boolean;
  canRegisterPedido?: boolean;
  onRegistrarPedido: () => void;
  onNovoCliente: () => void;
}

export function ClientesHeader({ tab, onTabChange, canCreate, canRegisterPedido = canCreate, onRegistrarPedido, onNovoCliente }: ClientesHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-[60] -mx-3 border-b border-border-default bg-surface-card/95 pt-[env(safe-area-inset-top)] backdrop-blur sm:-mx-6">
        <div className="mx-auto flex min-w-0 max-w-[1440px] items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded bg-accent text-[10px] font-black text-white">RK</div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold tracking-tight text-text-primary">RK Sucatas</p><p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">Cadastro e atendimento · sistema integrado</p></div>
          </div>
          {canCreate || canRegisterPedido ? <div role="group" aria-label="Ações de clientes" className="ml-auto flex shrink-0 items-center gap-2">{canCreate ? <button type="button" aria-label="Novo cliente" onClick={onNovoCliente} className="grid size-11 cursor-pointer place-items-center rounded-control border border-border-default text-text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:flex sm:h-9 sm:w-auto sm:gap-2 sm:px-3"><Plus aria-hidden="true" size={15} /><span className="hidden sm:inline">Novo cliente</span></button> : null}{canRegisterPedido ? <button type="button" aria-label="Registrar pedido" onClick={onRegistrarPedido} className="grid size-11 cursor-pointer place-items-center rounded-control bg-accent text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:flex sm:h-9 sm:w-auto sm:gap-2 sm:px-3"><ReceiptText aria-hidden="true" size={15} /><span className="hidden sm:inline">Registrar pedido</span></button> : null}</div> : null}
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 border-b border-border-default pb-5 pt-5 min-[480px]:grid-cols-[minmax(0,1fr)_auto] min-[480px]:items-start min-[480px]:gap-x-4 min-[480px]:gap-y-2 lg:items-end">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">Operação de clientes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-text-primary sm:text-4xl">Clientes</h1>
        </div>
        <p className="text-sm leading-relaxed text-text-muted min-[480px]:col-span-2 min-[480px]:row-start-2">Acompanhe pedidos, contatos e próximos atendimentos.</p>
        <div className="-mx-3 flex w-[calc(100%+1.5rem)] justify-end overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[480px]:col-start-2 min-[480px]:row-start-1 min-[480px]:mx-0 min-[480px]:w-full min-[480px]:self-center min-[480px]:px-0 lg:w-fit lg:max-w-full lg:justify-end">
        <Tabs value={tab} onValueChange={(next) => onTabChange(next as ClientesTab)} className="w-fit min-w-max">
          <TabsList className="max-w-full bg-surface-inset">
            <TabsTrigger value="painel" className="min-h-10 px-3 text-sm">Painel</TabsTrigger>
            <TabsTrigger value="todos" className="min-h-10 px-3 text-sm">Todos os clientes</TabsTrigger>
            <TabsTrigger value="agenda" className="min-h-10 px-3 text-sm">Agenda</TabsTrigger>
          </TabsList>
        </Tabs>
        </div>
      </div>
    </>
  );
}
