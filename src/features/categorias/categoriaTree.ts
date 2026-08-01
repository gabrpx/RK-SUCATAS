// Utilitário puro pra árvore de categorias (adjacency list: cada linha só
// guarda o próprio parent_id). Compartilhado entre backend (validação de
// ciclo/subárvore) e frontend (montar a árvore, filtro por descendentes,
// breadcrumb). Sem dependência de React nem de Node — só arrays em memória,
// então funciona dos dois lados sem duplicar a lógica.
import type { Categoria } from '../../types/catalog';

export interface CategoriaNode extends Categoria {
  children: CategoriaNode[];
}

// `compare` decide a ordem dos irmãos em cada nível — default é a ordem
// manual (drag-and-drop). Passe um comparador por nome pra ordenação
// alfabética sem mexer no campo `ordem` persistido.
export function buildTree(categorias: Categoria[], compare: (a: Categoria, b: Categoria) => number = (a, b) => a.ordem - b.ordem): CategoriaNode[] {
  const porId = new Map<string, CategoriaNode>();
  categorias.forEach((c) => porId.set(c.id, { ...c, children: [] }));

  const raizes: CategoriaNode[] = [];
  porId.forEach((node) => {
    if (node.parent_id && porId.has(node.parent_id)) {
      porId.get(node.parent_id)!.children.push(node);
    } else {
      raizes.push(node);
    }
  });

  const ordenarRecursivo = (nodes: CategoriaNode[]) => {
    nodes.sort(compare);
    nodes.forEach((n) => ordenarRecursivo(n.children));
  };
  ordenarRecursivo(raizes);

  return raizes;
}

function normalizarTexto(texto: string) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Filtra a árvore já montada por um termo de busca: se o nó bate, mantém ele
// com a subárvore original inteira (busca "Farol" mostra tudo dentro de
// Farol); se não bate, mantém só se algum descendente bater (preserva o
// caminho até o resultado).
export function filterTree(nodes: CategoriaNode[], termo: string): CategoriaNode[] {
  const alvo = normalizarTexto(termo);
  if (!alvo) return nodes;

  const resultado: CategoriaNode[] = [];
  for (const node of nodes) {
    if (normalizarTexto(node.nome).includes(alvo)) {
      resultado.push(node);
      continue;
    }
    const filhosFiltrados = filterTree(node.children, termo);
    if (filhosFiltrados.length > 0) {
      resultado.push({ ...node, children: filhosFiltrados });
    }
  }
  return resultado;
}

// Inclui o próprio id no resultado — usado tanto pro filtro de estoque
// ("essa categoria e tudo abaixo dela") quanto pra checagem de exclusão.
export function getDescendantIds(id: string, categorias: Categoria[]): string[] {
  const filhosPorPai = new Map<string | null, string[]>();
  categorias.forEach((c) => {
    const lista = filhosPorPai.get(c.parent_id) ?? [];
    lista.push(c.id);
    filhosPorPai.set(c.parent_id, lista);
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

// Do nó até a raiz, ex: [Farol, Farol completo, Bloco do farol].
export function getAncestorChain(id: string, categorias: Categoria[]): Categoria[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const cadeia: Categoria[] = [];
  let atual = porId.get(id);
  while (atual) {
    cadeia.unshift(atual);
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
  }
  return cadeia;
}

export function getDepth(id: string, categorias: Categoria[]): number {
  return getAncestorChain(id, categorias).length - 1;
}

// true se `possivelDescendenteId` está na subárvore de `id` (ou é o próprio
// id) — usado pra bloquear mover uma categoria pra dentro dela mesma.
export function ehDescendenteOuIgual(id: string, possivelDescendenteId: string, categorias: Categoria[]): boolean {
  return getDescendantIds(id, categorias).includes(possivelDescendenteId);
}
