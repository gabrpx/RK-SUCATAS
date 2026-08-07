// Adapta o OrgChart genérico (src/components/OrgChart.tsx) pra árvore de
// modelos de moto: card com miniatura (imagem_url, fallback ícone Bike) +
// nome + ano + contagem, e botão dedicado de expandir/recolher separado do
// card — mesmo padrão de CategoriaOrgChart.tsx. Card compacto (thumbnail ao
// lado do texto, não em cima como no grid de EstoqueByMoto/MotoCard) pra não
// estourar a largura horizontal do organograma.
import { Bike, ChevronDown, ChevronRight } from 'lucide-react';
import { OrgChart } from '../../components/OrgChart';
import { cn } from '../../utils';
import { getDescendantIds, type ModeloMotoNode } from './motoTree';
import type { ModeloMoto } from '../../types/catalog';

interface MotoOrgChartProps {
  modelos: ModeloMoto[];
  arvore: ModeloMotoNode[];
  /** Default: contagem estrutural de sub-níveis abaixo do nó. */
  contar?: (id: string) => number;
  rotuloContagem?: (n: number) => string;
  /** Quando informado, clicar no card dispara isso (ex: filtrar Estoque). Ausente = só visual. */
  onSelecionar?: (id: string) => void;
  forceExpandedIds?: Set<string> | null;
  emptyMessage?: string;
}

export function MotoOrgChart({ modelos, arvore, contar, rotuloContagem, onSelecionar, forceExpandedIds, emptyMessage }: MotoOrgChartProps) {
  const contarFn = contar ?? ((id: string) => getDescendantIds(id, modelos).length - 1);
  const rotuloFn = rotuloContagem ?? ((n: number) => (n === 1 ? 'sub-nível' : 'sub-níveis'));

  return (
    <OrgChart
      nodes={arvore}
      forceExpandedIds={forceExpandedIds}
      emptyMessage={emptyMessage}
      renderNode={(node, { hasChildren, expanded, toggle }) => {
        const contagem = contarFn(node.id);
        const cardClasse = cn(
          'flex items-center gap-2.5 rounded-card border border-border-subtle bg-surface-card px-3 py-2.5 min-w-[168px] max-w-[212px] text-left',
          onSelecionar && 'hover:border-border-default transition-colors'
        );
        const conteudo = (
          <>
            <div className="size-9 rounded-control overflow-hidden shrink-0 bg-surface-inset flex items-center justify-center">
              {node.imagem_url ? (
                <img src={node.imagem_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Bike size={16} className="text-text-faint" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate" title={node.nome}>
                {node.nome}
                {node.ano && <span className="text-text-muted font-normal"> ({node.ano})</span>}
              </p>
              <p className="text-[16px] font-medium text-text-primary leading-none tabular-nums mt-1.5">{contagem}</p>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mt-0.5">{rotuloFn(contagem)}</p>
            </div>
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
