import { CalendarClock, PackageSearch, SearchCheck, ShieldAlert } from 'lucide-react';
import type { ClientesResumoOperacional } from '../operacaoTypes';

export type ClientesMetricFilter = 'busca' | 'peca_disponivel' | 'visitas' | 'reservas';

interface ClientesMetricStripProps {
  resumo: ClientesResumoOperacional;
  onSelect: (filter: ClientesMetricFilter) => void;
}

const cards = (resumo: ClientesResumoOperacional) => [
  {
    id: 'busca' as const,
    label: 'Pedidos em busca',
    value: (resumo.pedidos_por_status.nova ?? 0) + (resumo.pedidos_por_status.em_busca ?? 0) + (resumo.pedidos_por_status.aguardando ?? 0),
    detail: 'Pedidos novos ou sendo procurados',
    Icon: SearchCheck,
    tone: 'text-accent-soft-fg bg-accent-soft-bg',
    disabled: false,
  },
  {
    id: 'peca_disponivel' as const,
    label: 'Peças disponíveis',
    value: resumo.pedidos_por_status.peca_disponivel ?? 0,
    detail: 'Clientes que precisam ser avisados',
    Icon: PackageSearch,
    tone: 'text-positive bg-positive-bg',
    disabled: false,
  },
  {
    id: 'visitas' as const,
    label: 'Próximas visitas',
    value: '—',
    detail: resumo.capabilities.visitas ? 'Agenda será exibida nesta etapa' : 'Ative a etapa de visitas para acompanhar',
    Icon: CalendarClock,
    tone: 'text-info bg-info-bg',
    disabled: !resumo.capabilities.visitas,
  },
  {
    id: 'reservas' as const,
    label: 'Reservas vencendo',
    value: '—',
    detail: resumo.capabilities.reservas ? 'Reservas serão exibidas nesta etapa' : 'Ative a etapa de reservas para acompanhar',
    Icon: ShieldAlert,
    tone: 'text-warning bg-warning-bg',
    disabled: !resumo.capabilities.reservas,
  },
];

export function ClientesMetricStrip({ resumo, onSelect }: ClientesMetricStripProps) {
  return (
    <section aria-label="Indicadores de clientes" className="relative snap-x snap-mandatory overflow-x-auto overflow-y-hidden pr-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-surface-page after:to-transparent sm:overflow-visible sm:pr-0 sm:after:hidden">
      <div className="flex min-w-0 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {cards(resumo).map(({ id, label, value, detail, Icon, tone, disabled }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(id)}
            className="min-h-[132px] min-w-[84%] snap-start cursor-pointer rounded-card border border-border-default bg-surface-card p-4 text-left shadow-[var(--elevation-1)] transition-[border-color,box-shadow] duration-200 hover:border-accent/35 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-border-default disabled:hover:shadow-[var(--elevation-1)] sm:min-w-0"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</span>
              <span className={`grid size-8 place-items-center rounded-control ${tone}`}><Icon aria-hidden="true" size={16} /></span>
            </span>
            <strong className="mt-3 block text-[28px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">{value}</strong>
            <span className="mt-3 block border-t border-border-subtle pt-2 text-xs leading-4 text-text-muted">{detail}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-muted sm:hidden">Deslize para ver todos os indicadores.</p>
    </section>
  );
}
