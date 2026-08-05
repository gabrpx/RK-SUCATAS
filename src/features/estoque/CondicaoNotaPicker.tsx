// Grid de 1 a 10 pra nota de condição, cor por tomCondicaoNota — usado no
// form do item (nota da peça) e no form de unidade (nota própria, com opção
// de herdar a da peça). Extraído de EstoqueView.tsx pra não duplicar a grid.
import { cn } from '../../utils';
import { tomCondicaoNota } from './condicaoNota';

interface CondicaoNotaPickerProps {
  valor: number | null;
  onChange: (nota: number | null) => void;
  label: string;
  /** Texto do botão de limpar — "Limpar" no item, "Usar a nota da peça" na unidade */
  textoLimpar?: string;
  ajuda?: string;
}

export function CondicaoNotaPicker({ valor, onChange, label, textoLimpar = 'Limpar', ajuda }: CondicaoNotaPickerProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</label>
        {valor != null && (
          <button type="button" onClick={() => onChange(null)} className="text-[11px] font-medium text-text-faint hover:text-text-secondary">
            {textoLimpar}
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selecionado = valor === n;
          const tom = tomCondicaoNota(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                'py-2 rounded-control font-semibold text-xs border transition-all tabular-nums',
                selecionado
                  ? tom === 'danger'
                    ? 'bg-danger border-danger text-surface-page'
                    : tom === 'warning'
                    ? 'bg-warning border-warning text-surface-page'
                    : 'bg-positive border-positive text-surface-page'
                  : 'border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg'
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {ajuda && <p className="text-[11px] text-text-faint mt-1.5">{ajuda}</p>}
    </div>
  );
}
