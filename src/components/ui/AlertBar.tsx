// AlertBar: aviso inline com ação obrigatória.
// Regra do design system: todo alerta precisa ter uma ação associada,
// nunca só informar — por isso acaoLabel/onAcao não são opcionais.
// Se um caso de uso não tiver ação real, ele não deveria usar AlertBar.
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';

export type AlertTone = 'positive' | 'neutral' | 'negative' | 'warning' | 'danger';

const TONE_CLASSES: Record<AlertTone, { border: string; bg: string; fg: string }> = {
  positive: { border: 'border-l-positive', bg: 'bg-positive-bg', fg: 'text-positive' },
  negative: { border: 'border-l-negative', bg: 'bg-negative-bg', fg: 'text-negative' },
  warning: { border: 'border-l-warning', bg: 'bg-warning-bg', fg: 'text-warning' },
  danger: { border: 'border-l-danger', bg: 'bg-danger-bg', fg: 'text-danger' },
  // 'neutral' cai no accent — usado pra avisos informativos sem carga de risco/sucesso
  neutral: { border: 'border-l-accent', bg: 'bg-accent-soft-bg', fg: 'text-accent-soft-fg' },
};

export interface AlertBarProps {
  /** Cor semântica do alerta — define borda, fundo e cor do texto/ícone */
  tom: AlertTone;
  icone: LucideIcon;
  mensagem: string;
  /** Texto do botão de ação — sempre obrigatório, ver nota acima */
  acaoLabel: string;
  onAcao: () => void;
}

export function AlertBar({ tom, icone: Icone, mensagem, acaoLabel, onAcao }: AlertBarProps) {
  const toneClasses = TONE_CLASSES[tom];

  return (
    <div
      className={cn(
        // Borda arredondada só do lado direito (spec: "0 9px 9px 0") — a esquerda
        // fica reta porque é onde entra a borda-destaque de 2px do tom
        'flex items-center justify-between gap-3 border-l-2 pl-3 pr-2 py-2.5 rounded-[0_9px_9px_0]',
        toneClasses.border,
        toneClasses.bg
      )}
    >
      <div className={cn('flex items-center gap-2 min-w-0', toneClasses.fg)}>
        <Icone size={16} strokeWidth={1.75} className="shrink-0" />
        <span className="text-sm text-text-primary truncate">{mensagem}</span>
      </div>

      <button
        type="button"
        onClick={onAcao}
        className={cn('shrink-0 -my-2 -mr-2 py-2 px-2 rounded-control text-2xs font-semibold uppercase tracking-wide underline underline-offset-2 hover:opacity-80 transition-opacity duration-fast', toneClasses.fg)}
      >
        {acaoLabel}
      </button>
    </div>
  );
}
