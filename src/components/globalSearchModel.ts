export type GlobalSearchFilter = "todos" | "estoque" | "tarefas" | "vendas";

export type SearchableStock = {
  id: string;
  nome: string;
  codigo: string;
  categoria?: { nome?: string | null } | null;
  quantidade: number;
  valor: number | string;
};

export type SearchableSale = {
  id: string;
  nome_item: string;
  cliente_nome?: string | null;
  valor_total: number | string;
  data: string;
  forma_pagamento?: { nome?: string | null } | null;
};

export type GlobalSearchResult =
  | {
      kind: "estoque";
      id: string;
      label: string;
      description: string;
      score: number;
      data: SearchableStock;
    }
  | {
      kind: "venda";
      id: string;
      label: string;
      description: string;
      score: number;
      data: SearchableSale;
    }
  | {
      kind: "tarefa";
      id: "open-tasks";
      label: "Abrir tarefas";
      description: string;
      score: number;
    };

type SearchInput = {
  estoque: SearchableStock[];
  vendas: SearchableSale[];
  query: string;
  filter: GlobalSearchFilter;
};

function normalizarTexto(texto: string) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(label: string, searchable: string, query: string) {
  if (!query) return 1;
  if (normalizarTexto(label) === query) return 16;
  if (normalizarTexto(label).startsWith(query)) return 12;
  return searchable.includes(query) ? 6 : 0;
}

function matchesQuery(searchable: string, query: string) {
  if (!query) return true;
  return query.split(" ").filter(Boolean).every((word) => searchable.includes(word));
}

export function buildGlobalSearchResults({ estoque, vendas, query, filter }: SearchInput): GlobalSearchResult[] {
  const normalizedQuery = normalizarTexto(query);
  const results: GlobalSearchResult[] = [];

  if (filter === "todos" || filter === "tarefas") {
    const taskSearchable = "abrir tarefas fila operacional meu turno pendencias";
    if (matchesQuery(taskSearchable, normalizedQuery)) {
      results.push({ kind: "tarefa", id: "open-tasks", label: "Abrir tarefas", description: "Fila operacional, pendências e execução do turno", score: scoreMatch("Abrir tarefas", taskSearchable, normalizedQuery) });
    }
  }

  if (filter === "todos" || filter === "estoque") {
    estoque.forEach((item) => {
      const searchable = normalizarTexto(`${item.nome} ${item.codigo} ${item.categoria?.nome ?? ""}`);
      if (!matchesQuery(searchable, normalizedQuery)) return;
      results.push({ kind: "estoque", id: item.id, label: item.nome, description: `${item.codigo} · ${item.categoria?.nome ?? "Sem categoria"} · ${item.quantidade} un.`, score: scoreMatch(item.nome, searchable, normalizedQuery), data: item });
    });
  }

  if (filter === "todos" || filter === "vendas") {
    vendas.forEach((item) => {
      const searchable = normalizarTexto(`${item.nome_item} ${item.cliente_nome ?? ""} ${item.forma_pagamento?.nome ?? ""}`);
      if (!matchesQuery(searchable, normalizedQuery)) return;
      results.push({ kind: "venda", id: item.id, label: item.nome_item, description: `${item.cliente_nome ?? "Cliente não informado"} · ${item.forma_pagamento?.nome ?? "Forma não informada"}`, score: scoreMatch(item.nome_item, searchable, normalizedQuery), data: item });
    });
  }

  return results.sort((first, second) => second.score - first.score || first.label.localeCompare(second.label, "pt-BR"));
}

export function getSearchResultCounts(results: GlobalSearchResult[]) {
  return results.reduce(
    (counts, result) => {
      counts.todos += 1;
      if (result.kind === "estoque") counts.estoque += 1;
      if (result.kind === "tarefa") counts.tarefas += 1;
      if (result.kind === "venda") counts.vendas += 1;
      return counts;
    },
    { todos: 0, estoque: 0, tarefas: 0, vendas: 0 }
  );
}
