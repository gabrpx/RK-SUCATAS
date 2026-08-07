// Organograma genérico (raiz no topo, ramifica pra baixo, conectores em linha)
// pra qualquer árvore no formato { id, children: T[] } — CategoriaNode e
// ModeloMotoNode (buildTree de categoriaTree.ts/motoTree.ts) já servem sem
// adaptação. Este componente só desenha estrutura + expand/collapse; ele não
// sabe o que é uma categoria ou uma moto — quem chama decide o conteúdo do
// card via `renderNode` e se clicar nele faz alguma coisa ou não.
//
// Os conectores (linhas ligando pai/filhos) são CSS puro em orgchart.css,
// técnica clássica de "pure CSS org chart" com <ul>/<li> aninhados e
// pseudo-elementos — sem lib de grafo, sem canvas/SVG. Ver comentário lá pra
// entender a matemática dos pseudo-elementos, inclusive o tratamento
// dedicado de :only-child (nó com um único filho não deve ganhar barra de
// "irmão" nenhuma).
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../utils';

export interface OrgChartRenderCtx {
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  toggle: () => void;
}

interface OrgChartProps<T extends { id: string; children: T[] }> {
  nodes: T[];
  renderNode: (node: T, ctx: OrgChartRenderCtx) => ReactNode;
  /** Quantos níveis abaixo da(s) raiz(es) já começam expandidos. Default 1 = raiz + 1 nível. */
  initialExpandedDepth?: number;
  /** Quando setado (ex: busca ativa), sobrepõe o estado interno — expande só esses ids. */
  forceExpandedIds?: Set<string> | null;
  className?: string;
  emptyMessage?: string;
}

function coletarExpandidosIniciais<T extends { id: string; children: T[] }>(
  nodes: T[],
  maxDepth: number,
  depth = 0,
  acc: Set<string> = new Set()
): Set<string> {
  if (depth >= maxDepth) return acc;
  nodes.forEach((n) => {
    if (n.children.length > 0) {
      acc.add(n.id);
      coletarExpandidosIniciais(n.children, maxDepth, depth + 1, acc);
    }
  });
  return acc;
}

export function OrgChart<T extends { id: string; children: T[] }>({
  nodes,
  renderNode,
  initialExpandedDepth = 1,
  forceExpandedIds = null,
  className,
  emptyMessage = 'Nada para mostrar.',
}: OrgChartProps<T>) {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => coletarExpandidosIniciais(nodes, initialExpandedDepth));

  const toggle = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const efetivo = forceExpandedIds ?? expandidos;

  if (nodes.length === 0) {
    return <p className="px-3 py-8 text-center text-xs text-text-faint">{emptyMessage}</p>;
  }

  return (
    <div className={cn('org-chart-scroll', className)}>
      <ul className="org-chart">
        {nodes.map((node) => (
          <Fragment key={node.id}>
            <OrgChartLi node={node} depth={0} expandidos={efetivo} toggle={toggle} renderNode={renderNode} />
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

function OrgChartLi<T extends { id: string; children: T[] }>({
  node,
  depth,
  expandidos,
  toggle,
  renderNode,
}: {
  node: T;
  depth: number;
  expandidos: Set<string>;
  toggle: (id: string) => void;
  renderNode: OrgChartProps<T>['renderNode'];
}) {
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && expandidos.has(node.id);

  return (
    <li>
      <div className="org-chart-node">{renderNode(node, { depth, hasChildren, expanded, toggle: () => toggle(node.id) })}</div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <Fragment key={child.id}>
              <OrgChartLi node={child} depth={depth + 1} expandidos={expandidos} toggle={toggle} renderNode={renderNode} />
            </Fragment>
          ))}
        </ul>
      )}
    </li>
  );
}
