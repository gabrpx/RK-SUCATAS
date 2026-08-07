// Adapta o OrgChart genérico (src/components/OrgChart.tsx) pra árvore de
// categorias: card com nome + contagem, e um botão dedicado de
// expandir/recolher separado do card em si — clicar no card só dispara
// `onSelecionar` (quando informado; em Configurações não é, então o card não
// é clicável, só visual). A contagem também é injetada por quem chama: em
// Configurações é estrutural (nº de subcategorias abaixo, mesmo cálculo do
// modal de exclusão do CategoriaTreeManager); no Estoque é nº de peças.
import { ChevronDown, ChevronRight } from 'lucide-react';
import { OrgChart } from '../../components/OrgChart';
import { cn } from '../../utils';
import { getDescendantIds, type CategoriaNode } from './categoriaTree';
import type { Categoria } from '../../types/catalog';

interface CategoriaOrgChartProps {
  categorias: Categoria[];
  arvore: CategoriaNode[];
  /** Default: contagem estrutural de subcategorias abaixo do nó. */
  contar?: (id: string) => number;
  rotuloContagem?: (n: number) => string;
  /** Quando informado, clicar no card dispara isso (ex: filtrar Estoque). Ausente = só visual. */
  onSelecionar?: (id: string) => void;
  forceExpandedIds?: Set<string> | null;
  emptyMessage?: string;
}

export function CategoriaOrgChart({
  categorias,
  arvore,
  contar,
  rotuloContagem,
  onSelecionar,
  forceExpandedIds,
  emptyMessage,
}: CategoriaOrgChartProps) {
  const contarFn = contar ?? ((id: string) => getDescendantIds(id, categorias).length - 1);
  const rotuloFn = rotuloContagem ?? ((n: number) => (n === 1 ? 'subcategoria' : 'subcategorias'));

  return (
    <OrgChart
      nodes={arvore}
      forceExpandedIds={forceExpandedIds}
      emptyMessage={emptyMessage}
      renderNode={(node, { hasChildren, expanded, toggle }) => {
        const contagem = contarFn(node.id);
        const cardClasse = cn(
          'flex flex-col items-center gap-1 rounded-card border border-border-subtle bg-surface-card px-4 py-3 min-w-[132px] max-w-[184px]',
          onSelecionar && 'hover:border-border-default transition-colors'
        );
        const conteudo = (
          <>
            <p className="text-sm font-medium text-text-primary truncate max-w-full" title={node.nome}>
              {node.nome}
            </p>
            <p className="text-[20px] font-medium text-text-primary leading-none tabular-nums mt-1">{contagem}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-text-faint mt-0.5">{rotuloFn(contagem)}</p>
          </>
        );

        return (
          <div className="flex flex-col items-center gap-1.5">
            {onSelecionar ? (
              <button type="button" onClick={() => onSelecionar(node.id)} className={cardClasse}>
                {conteudo}
              </button>
            ) : (
              <div className={cardClasse}>{conteudo}</div>
            )}
            {hasChildren && (
              <button
                type="button"
                onClick={toggle}
                className="flex items-center gap-1 text-[10px] font-semibold text-text-faint hover:text-text-secondary transition-colors"
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {node.children.length}
              </button>
            )}
          </div>
        );
      }}
    />
  );
}
