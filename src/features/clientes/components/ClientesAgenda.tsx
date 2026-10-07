import { AlertCircle, CalendarDays, RefreshCw, UserRound } from 'lucide-react';
import type { Tarefa } from '../../tarefas/types';

interface ClientesAgendaProps {
  tarefas: Tarefa[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenCliente?: (clienteId: string) => void;
}

function formatarPrazo(prazo: string | null): string {
  if (!prazo) return 'Sem horário definido';
  const data = new Date(prazo);
  if (Number.isNaN(data.getTime())) return 'Sem horário definido';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(data);
}

export function ClientesAgenda({ tarefas, loading = false, error = null, onRetry, onOpenCliente }: ClientesAgendaProps) {
  const visitas = tarefas
    .filter((tarefa) => tarefa.tipo === 'visita')
    .slice()
    .sort((a, b) => {
      const prazoA = a.prazo ? new Date(a.prazo).getTime() : Number.MAX_SAFE_INTEGER;
      const prazoB = b.prazo ? new Date(b.prazo).getTime() : Number.MAX_SAFE_INTEGER;
      return prazoA - prazoB;
    });

  if (loading) {
    return <section role="status" className="rounded-card border border-border-default bg-surface-card p-8 text-sm text-text-muted">Carregando visitas…</section>;
  }

  if (error) {
    return (
      <section role="alert" className="rounded-card border border-danger/30 bg-danger-bg p-5 text-sm text-text-primary">
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-danger" size={18} />
          <div>
            <p className="font-semibold">Não foi possível carregar a agenda de visitas</p>
            <p className="mt-1 text-text-muted">{error}</p>
            {onRetry ? <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-control border border-danger/30 bg-surface-card px-3 font-semibold text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"><RefreshCw aria-hidden="true" size={15} />Tentar novamente</button> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="agenda-clientes-title" className="rounded-card border border-border-default bg-surface-card shadow-[var(--elevation-1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 py-4 sm:px-5">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Tarefas vinculadas</p>
          <h2 id="agenda-clientes-title" className="mt-1 text-lg font-semibold tracking-tight text-text-primary">Agenda de visitas</h2>
          <p className="mt-1 text-sm text-text-muted">Visitas criadas em Tarefas, sem duplicar o atendimento.</p>
        </div>
        <span aria-live="polite" className="text-sm text-text-muted">{visitas.length} {visitas.length === 1 ? 'visita' : 'visitas'}</span>
      </div>

      {visitas.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <CalendarDays aria-hidden="true" className="mx-auto text-text-faint" size={24} />
          <p className="mt-3 text-sm font-semibold text-text-primary">Nenhuma visita agendada</p>
          <p className="mt-1 text-sm text-text-muted">Crie uma tarefa do tipo visita para acompanhar o próximo atendimento.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {visitas.map((visita) => {
            const clienteId = visita.cliente_id || visita.cliente?.id || null;
            const nomeCliente = visita.cliente?.nome || 'Cliente não vinculado';
            return (
              <li key={visita.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{visita.titulo || 'Visita sem título'}</p>
                  <p className="mt-1 text-sm text-text-secondary">{nomeCliente} · {formatarPrazo(visita.prazo)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted"><UserRound aria-hidden="true" size={14} />{visita.atribuido?.nome_exibicao || 'Sem responsável'} · {visita.status === 'concluida' ? 'Concluída' : 'Pendente'}</p>
                </div>
                {clienteId && visita.cliente && onOpenCliente ? <button type="button" onClick={() => onOpenCliente(clienteId)} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-control border border-border-default bg-surface-card px-3 text-sm font-semibold text-text-primary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Abrir cliente {nomeCliente}</button> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
