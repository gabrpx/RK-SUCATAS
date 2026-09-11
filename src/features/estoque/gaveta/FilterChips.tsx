// Chips de categoria (T01): "Todas" + 1 por categoria com gaveta cadastrada.
// Seleção controlada e única (radio-like) — null = "Todas". Scroll horizontal
// próprio, nunca a página inteira.
import { cn } from '../../../utils';

export interface FilterChipOption {
  id: string;
  nome: string;
}

interface FilterChipsProps {
  opcoes: FilterChipOption[];
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
}

export function FilterChips({ opcoes, selecionado, onSelecionar }: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filtrar por categoria">
      <button
        type="button"
        role="tab"
        aria-selected={selecionado === null}
        onClick={() => onSelecionar(null)}
        className={cn(
          'flex-none h-9 px-4 rounded-pill text-sm font-semibold whitespace-nowrap transition-colors',
          selecionado === null
            ? 'bg-accent text-white'
            : 'bg-surface-card text-text-secondary hover:text-text-primary'
        )}
      >
        Todas
      </button>
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          role="tab"
          aria-selected={selecionado === opcao.id}
          onClick={() => onSelecionar(opcao.id)}
          className={cn(
            'flex-none h-9 px-4 rounded-pill text-sm font-semibold whitespace-nowrap transition-colors',
            selecionado === opcao.id
              ? 'bg-accent text-white'
              : 'bg-surface-card text-text-secondary hover:text-text-primary'
          )}
        >
          {opcao.nome}
        </button>
      ))}
    </div>
  );
}
