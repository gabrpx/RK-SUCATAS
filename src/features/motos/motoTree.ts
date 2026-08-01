// Utilitário puro pra árvore de modelos de moto (adjacency list: cada linha só
// guarda o próprio parent_id) — mesmo formato de src/features/categorias/categoriaTree.ts,
// duplicado em vez de generalizado por genéricos porque são dois domínios
// diferentes (peça vs. moto) e o arquivo é pequeno. Compartilhado entre
// backend (validação de ciclo/subárvore) e frontend (montar a árvore, filtro
// por descendentes, breadcrumb).
import type { ModeloMoto } from '../../types/catalog';

export interface ModeloMotoNode extends ModeloMoto {
  children: ModeloMotoNode[];
}

export function buildTree(modelos: ModeloMoto[]): ModeloMotoNode[] {
  const porId = new Map<string, ModeloMotoNode>();
  modelos.forEach((m) => porId.set(m.id, { ...m, children: [] }));

  const raizes: ModeloMotoNode[] = [];
  porId.forEach((node) => {
    if (node.parent_id && porId.has(node.parent_id)) {
      porId.get(node.parent_id)!.children.push(node);
    } else {
      raizes.push(node);
    }
  });

  const ordenarRecursivo = (nodes: ModeloMotoNode[]) => {
    nodes.sort((a, b) => a.ordem - b.ordem);
    nodes.forEach((n) => ordenarRecursivo(n.children));
  };
  ordenarRecursivo(raizes);

  return raizes;
}

// Inclui o próprio id no resultado — usado tanto pro filtro de estoque
// ("essa marca/cilindrada e tudo abaixo dela") quanto pra checagem de exclusão.
export function getDescendantIds(id: string, modelos: ModeloMoto[]): string[] {
  const filhosPorPai = new Map<string | null, string[]>();
  modelos.forEach((m) => {
    const lista = filhosPorPai.get(m.parent_id) ?? [];
    lista.push(m.id);
    filhosPorPai.set(m.parent_id, lista);
  });

  const resultado: string[] = [id];
  const pilha = [id];
  while (pilha.length > 0) {
    const atual = pilha.pop()!;
    const filhos = filhosPorPai.get(atual) ?? [];
    filhos.forEach((filhoId) => {
      resultado.push(filhoId);
      pilha.push(filhoId);
    });
  }
  return resultado;
}

// Do nó até a raiz, ex: [Honda, 150, Bros NXR 150].
export function getAncestorChain(id: string, modelos: ModeloMoto[]): ModeloMoto[] {
  const porId = new Map(modelos.map((m) => [m.id, m]));
  const cadeia: ModeloMoto[] = [];
  let atual = porId.get(id);
  while (atual) {
    cadeia.unshift(atual);
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
  }
  return cadeia;
}

export function getDepth(id: string, modelos: ModeloMoto[]): number {
  return getAncestorChain(id, modelos).length - 1;
}

// true se `possivelDescendenteId` está na subárvore de `id` (ou é o próprio
// id) — usado pra bloquear mover um modelo pra dentro dele mesmo.
export function ehDescendenteOuIgual(id: string, possivelDescendenteId: string, modelos: ModeloMoto[]): boolean {
  return getDescendantIds(id, modelos).includes(possivelDescendenteId);
}
