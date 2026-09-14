// Chips de categoria (T01): "Todas" + 1 por categoria com gaveta cadastrada.
// Seleção controlada e única (radio-like) — null = "Todas". Scroll horizontal
// próprio, nunca a página inteira.
import { cn } from '../../../utils';
import { FILTROS_RAPIDOS, type FiltroRapido } from './buscaGavetas';

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
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" role="tablist" aria-label="Filtrar por categoria">
      <button
        type="button"
        role="tab"
        aria-selected={selecionado === null}
        onClick={() => onSelecionar(null)}
        className={cn(
          'flex-none h-8 px-3.5 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors',
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
            'flex-none h-8 px-3.5 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors',
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

// Filtros rápidos por estado (T03) — chips de alternância múltipla (não é
// radio). Cada chip é um toggle independente; combinar filtros aplica AND.
interface FiltrosRapidosChipsProps {
  ativos: Set<FiltroRapido>;
  onAlternar: (id: FiltroRapido) => void;
}

export function FiltrosRapidosChips({ ativos, onAlternar }: FiltrosRapidosChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none" role="group" aria-label="Filtrar por estado">
      {FILTROS_RAPIDOS.map((f) => {
        const ativo = ativos.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => onAlternar(f.id)}
            className={cn(
              'flex-none h-8 px-3.5 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors border',
              ativo
                ? 'bg-accent-soft-bg border-accent text-accent-soft-fg'
                : 'bg-surface-card border-border-subtle text-text-secondary hover:text-text-primary'
            )}
          >
            {f.nome}
          </button>
        );
      })}
    </div>
  );
}
