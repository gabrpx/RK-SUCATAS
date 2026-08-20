// MetricCard: bloco de KPI usado em dashboards e resumos de tela.
// Segue a regra do design system (ver CLAUDE.md): o valor numérico é o
// elemento mais forte do card, o label é só um rótulo secundário.
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';

export type MetricTone = 'positive' | 'neutral' | 'negative';

// Cada tom mapeia pra um par cor/fundo do theme.css — nunca hex direto.
// 'neutral' usa o accent, porque um card neutro ainda pode representar
// uma métrica "de destaque" (ex: total de itens) sem carregar juízo de
// valor positivo/negativo. O chip do ícone leva um degradê sutil + glow
// na mesma cor do tom (em vez de fundo chapado) — é o tratamento visual
// que diferencia o ícone de um <Icon/> solto.
const TONE_CLASSES: Record<MetricTone, { badgeGradient: string; badgeFg: string; badgeRing: string; glow: string }> = {
  positive: { badgeGradient: 'from-positive/30 to-positive/5', badgeFg: 'text-positive', badgeRing: 'ring-positive/20', glow: 'shadow-positive/20' },
  neutral: { badgeGradient: 'from-accent-bright/35 to-accent/10', badgeFg: 'text-accent-soft-fg', badgeRing: 'ring-accent/25', glow: 'shadow-accent/25' },
  negative: { badgeGradient: 'from-negative/30 to-negative/5', badgeFg: 'text-negative', badgeRing: 'ring-negative/20', glow: 'shadow-negative/20' },
};

export interface MetricCardProps {
  /** Ícone exibido no badge quadrado */
  icone: LucideIcon;
  /** Rótulo curto da métrica (renderizado em caixa alta) */
  label: string;
  /** Valor principal — já formatado pelo chamador (moeda, unidade, etc.) */
  valor: string;
  /** Linha de apoio abaixo do valor, ex: "12 vendas este mês" */
  contexto?: string;
  /** Define a cor semântica do badge do ícone */
  tom?: MetricTone;
}

export function MetricCard({ icone: Icone, label, valor, contexto, tom = 'neutral' }: MetricCardProps) {
  const toneClasses = TONE_CLASSES[tom];

  return (
    <div className="group relative overflow-hidden bg-surface-card border border-border-subtle rounded-card p-5 flex flex-col gap-4 transition-[transform,border-color,box-shadow] duration-base hover:-translate-y-1 hover:border-border-default hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-surface-edge" />

      <div
        className={cn(
          'size-11 rounded-control flex items-center justify-center shrink-0 bg-gradient-to-br ring-1 shadow-lg transition-transform duration-base group-hover:scale-110',
          toneClasses.badgeGradient,
          toneClasses.badgeFg,
          toneClasses.badgeRing,
          toneClasses.glow
        )}
      >
        <Icone size={20} strokeWidth={1.75} />
      </div>

      <div>
        <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-text-faint">{label}</p>
        <p className="text-3xl font-semibold text-text-primary leading-none mt-2 tabular-nums tracking-tight">{valor}</p>
        {contexto && <p className="text-xs text-text-faint mt-2 truncate">{contexto}</p>}
      </div>
    </div>
  );
}
