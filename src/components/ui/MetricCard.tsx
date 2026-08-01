// MetricCard: bloco de KPI usado em dashboards e resumos de tela.
// Segue a regra do design system (ver CLAUDE.md): o valor numérico é o
// elemento mais forte do card, o label é só um rótulo secundário.
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';

export type MetricTone = 'positive' | 'neutral' | 'negative';

// Cada tom mapeia pra um par cor/fundo do theme.css — nunca hex direto.
// 'neutral' usa o accent, porque um card neutro ainda pode representar
// uma métrica "de destaque" (ex: total de itens) sem carregar juízo de
// valor positivo/negativo.
const TONE_CLASSES: Record<MetricTone, { badgeBg: string; badgeFg: string }> = {
  positive: { badgeBg: 'bg-positive-bg', badgeFg: 'text-positive' },
  neutral: { badgeBg: 'bg-accent-soft-bg', badgeFg: 'text-accent-soft-fg' },
  negative: { badgeBg: 'bg-negative-bg', badgeFg: 'text-negative' },
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
    <div className="bg-surface-card border border-border-subtle rounded-card p-4 flex flex-col gap-3">
      <div className={cn('size-9 rounded-control flex items-center justify-center shrink-0', toneClasses.badgeBg, toneClasses.badgeFg)}>
        <Icone size={18} strokeWidth={2} />
      </div>

      <div>
        {/* 10.5px não existe como escala padrão do Tailwind — valor arbitrário exigido pelo spec */}
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint">{label}</p>
        <p className="text-[20px] font-medium text-text-primary leading-tight mt-1">{valor}</p>
        {contexto && <p className="text-[11px] text-text-faint mt-1">{contexto}</p>}
      </div>
    </div>
  );
}
