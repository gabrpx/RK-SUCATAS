// StatusBadge: pílula pequena pra estados curtos (canal ML/FB, categoria,
// prazo de entrega, etc). Não é clicável — é só rótulo visual.
import { cn } from '../../utils';

export type StatusTone = 'accent' | 'positive' | 'neutral' | 'negative' | 'warning' | 'danger';

const TONE_CLASSES: Record<StatusTone, string> = {
  accent: 'bg-accent-soft-bg text-accent-soft-fg',
  positive: 'bg-positive-bg text-positive',
  negative: 'bg-negative-bg text-negative',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  // 'neutral' não é um tom do theme.css — é o estado "sem cor", usado
  // junto com ativo=false ou pra badges que não carregam significado semântico
  neutral: 'bg-surface-inset text-text-muted',
};

export interface StatusBadgeProps {
  texto: string;
  tom?: StatusTone;
  /**
   * Quando false, ignora `tom` e força a aparência neutra/esmaecida —
   * usado pra representar estados desativados (ex: canal desconectado,
   * categoria arquivada) sem precisar de um tom próprio pra isso.
   */
  ativo?: boolean;
}

export function StatusBadge({ texto, tom = 'accent', ativo = true }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-medium leading-none',
        ativo ? TONE_CLASSES[tom] : TONE_CLASSES.neutral
      )}
    >
      {texto}
    </span>
  );
}
