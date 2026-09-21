import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGlobalSearchResults,
  getSearchResultCounts,
} from "../../src/components/globalSearchModel.ts";

const estoque = [
  {
    id: "estoque-1",
    nome: "Carenagem ADV 160",
    codigo: "ADV-160",
    categoria: { nome: "Carenagens" },
    quantidade: 2,
    valor: 320,
  },
];

const vendas = [
  {
    id: "venda-1",
    nome_item: "Kit relação CG 160",
    cliente_nome: "Ana",
    valor_total: 155,
    data: "2026-09-17T10:00:00.000Z",
    forma_pagamento: { nome: "Pix" },
  },
];

test("filtra resultados por domínio e preserva o atalho de tarefas", () => {
  const results = buildGlobalSearchResults({
    estoque,
    vendas,
    query: "",
    filter: "tarefas",
  });

  assert.deepEqual(results.map((result) => result.kind), ["tarefa"]);
  assert.equal(results[0]?.label, "Abrir tarefas");
});

test("encontra estoque e vendas por texto normalizado e calcula contagens", () => {
  const allResults = buildGlobalSearchResults({
    estoque,
    vendas,
    query: "",
    filter: "todos",
  });
  const stockResults = buildGlobalSearchResults({
    estoque,
    vendas,
    query: "carenagem adv",
    filter: "estoque",
  });
  const saleResults = buildGlobalSearchResults({
    estoque,
    vendas,
    query: "ana",
    filter: "vendas",
  });

  assert.deepEqual(stockResults.map((result) => result.id), ["estoque-1"]);
  assert.deepEqual(saleResults.map((result) => result.id), ["venda-1"]);
  assert.deepEqual(getSearchResultCounts(allResults), {
    todos: 3,
    estoque: 1,
    tarefas: 1,
    vendas: 1,
  });
});
