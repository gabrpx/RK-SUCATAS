// EmptyState: placeholder pra listas/tabelas sem dados (filtro sem resultado,
// tabela recém-criada, etc). A ação é opcional aqui — ao contrário do
// AlertBar, um estado vazio pode ser puramente informativo (ex: "nada por
// enquanto") sem exigir um próximo passo do usuário.
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icone: LucideIcon;
  mensagem: string;
  acaoLabel?: string;
  onAcao?: () => void;
}

export function EmptyState({ icone: Icone, mensagem, acaoLabel, onAcao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
      <div className="size-10 rounded-control bg-surface-inset flex items-center justify-center text-text-faint">
        <Icone size={20} strokeWidth={1.5} />
      </div>
      <p className="text-sm text-text-muted max-w-[24rem]">{mensagem}</p>
      {acaoLabel && onAcao && (
        <button
          type="button"
          onClick={onAcao}
          className="text-xs font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80"
        >
          {acaoLabel}
        </button>
      )}
    </div>
  );
}
