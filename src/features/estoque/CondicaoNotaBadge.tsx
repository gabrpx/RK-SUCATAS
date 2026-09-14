// Badge compacto "N/10" pra nota de condição — mesmo padrão visual do badge
// de avaria na coluna Peça (EstoqueView.tsx), cor sempre pelo tom semântico
// (nunca decorativa, ver tomCondicaoNota).
import { cn } from '../../utils';
import { tomCondicaoNota } from './condicaoNota';

const CLASSES_TOM = {
  danger: 'bg-danger-bg text-danger',
  warning: 'bg-warning-bg text-warning',
  positive: 'bg-positive-bg text-positive',
} as const;

export function CondicaoNotaBadge({ nota }: { nota: number | null | undefined }) {
  if (nota == null) return null;
  return (
    <span
      title={`Condição: ${nota}/10`}
      className={cn('shrink-0 inline-flex items-center rounded-badge px-1.5 py-0.5 text-[10px] font-medium leading-none tabular-nums', CLASSES_TOM[tomCondicaoNota(nota)])}
    >
      {nota}/10
    </span>
  );
}
