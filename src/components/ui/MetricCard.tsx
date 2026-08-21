// MetricCard: bloco de KPI usado em dashboards e resumos de tela.
// Redesenhado no estilo do "statistics-card-1" (21st.dev): rótulo discreto +
// ícone no topo, o VALOR grande logo abaixo com um badge de variação (seta +
// %) ao lado, e uma linha de contexto após uma divisória. Segue a regra do
// design system (ver CLAUDE.md): o número é o elemento mais forte; o rótulo é
// secundário. A API (icone/label/valor/contexto/tom) é a mesma de antes — o
// `tendencia` é opcional, então todos os usos existentes seguem funcionando.
import type { LucideIcon } from 'lucide-react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../utils';

export type MetricTone = 'positive' | 'neutral' | 'negative';

export interface MetricTendencia {
  /** Variação absoluta em % (inteiro). null = sem base de comparação → sem badge. */
  pct: number | null;
  /** Direção real do número, pra escolher a seta ↑/↓. */
  subiu: boolean;
  /** Juízo semântico (bom/ruim) — define a cor do badge, podendo divergir da seta. */
  positivo: boolean;
}

// Cada tom só colore o ícone do topo (o valor é sempre neutro/forte). 'neutral'
// usa o accent porque uma métrica de destaque pode ser neutra sem carregar
// juízo positivo/negativo.
const ICON_TONE: Record<MetricTone, string> = {
  positive: 'text-positive',
  neutral: 'text-accent-soft-fg',
  negative: 'text-negative',
};

export interface MetricCardProps {
  /** Ícone exibido no canto superior direito */
  icone: LucideIcon;
  /** Rótulo curto da métrica (renderizado em caixa alta) */
  label: string;
  /** Valor principal — já formatado pelo chamador (moeda, unidade, etc.) */
  valor: string;
  /** Linha de apoio abaixo do valor, após a divisória (ex: "12 vendas neste mês") */
  contexto?: string;
  /** Define a cor semântica do ícone */
  tom?: MetricTone;
  /** Badge de variação vs. período anterior (opcional). */
  tendencia?: MetricTendencia;
}

export function MetricCard({ icone: Icone, label, valor, contexto, tom = 'neutral', tendencia }: MetricCardProps) {
  const mostraBadge = tendencia && tendencia.pct != null;

  return (
    <div className="group relative overflow-hidden bg-surface-card border border-border-subtle rounded-card p-5 transition-[transform,border-color,box-shadow] duration-base hover:-translate-y-0.5 hover:border-border-default hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-surface-edge" />

      {/* Cabeçalho: rótulo à esquerda, ícone à direita (posição do menu no card original) */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-text-faint leading-tight line-clamp-2">{label}</p>
        <Icone size={16} strokeWidth={1.75} className={cn('shrink-0 mt-px', ICON_TONE[tom])} />
      </div>

      {/* Valor grande + badge de variação. No mobile o número é um degrau menor
          pra caber sem cortar em tela estreita, mas segue dominante sobre o
          label (regra do design system: número > label). */}
      <div className="flex flex-wrap items-center gap-2.5 mt-3">
        <span className="text-2xl sm:text-3xl font-semibold text-text-primary leading-none tabular-nums tracking-tight">{valor}</span>
        {mostraBadge && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-badge px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
              tendencia!.positivo ? 'bg-positive-bg text-positive' : 'bg-negative-bg text-negative'
            )}
          >
            {tendencia!.subiu ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
            {tendencia!.pct}%
          </span>
        )}
      </div>

      {/* Divisória + contexto (até 2 linhas no mobile em vez de cortar) */}
      {contexto && (
        <p className="text-xs text-text-faint mt-3 border-t border-border-subtle pt-2.5 leading-snug line-clamp-2">{contexto}</p>
      )}
    </div>
  );
}
