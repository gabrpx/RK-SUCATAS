// Agregações puras sobre gavetas/variantes/unidades. Fora da UI de propósito:
// os mesmos números aparecem na listagem (T01) e no detalhe (T02). NÃO
// reaproveita nada do módulo de famílias — só o cálculo de preço por unidade.
import type { Estoque, Gaveta } from '../types';
import { valorDaUnidade } from '../valorEstoque';

export type LinhaGaveta =
  | { tipo: 'gaveta'; id: string; gaveta: Gaveta; itens: Estoque[] }
  | { tipo: 'nao-agrupado'; id: 'nao-agrupado'; itens: Estoque[] };

export function agruparPorGaveta(itens: Estoque[], gavetas: Gaveta[]): LinhaGaveta[] {
  const porGaveta = new Map<string, Estoque[]>();
  const semGaveta: Estoque[] = [];
  for (const item of itens) {
    if (item.gaveta_id) {
      const atual = porGaveta.get(item.gaveta_id) ?? [];
      atual.push(item);
      porGaveta.set(item.gaveta_id, atual);
    } else {
      semGaveta.push(item);
    }
  }
  const linhas: LinhaGaveta[] = gavetas.map((g) => ({
    tipo: 'gaveta', id: g.id, gaveta: g, itens: porGaveta.get(g.id) ?? [],
  }));
  if (semGaveta.length > 0) linhas.push({ tipo: 'nao-agrupado', id: 'nao-agrupado', itens: semGaveta });
  return linhas;
}

// Preços das unidades DISPONÍVEIS (não vendidas), herdando estoque.valor
// quando a unidade não tem valor próprio; peças sem ficha usam estoque.valor.
function precosDisponiveis(item: Estoque): number[] {
  const precos: number[] = [];
  const disponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em);
  for (const u of disponiveis) precos.push(valorDaUnidade(u, item.valor));
  const semFicha = Math.max(0, (Number(item.quantidade) || 0) - disponiveis.length);
  for (let i = 0; i < semFicha; i++) precos.push(Number(item.valor) || 0);
  return precos;
}

export function faixaPrecoVariante(item: Estoque): { min: number; max: number } | null {
  const precos = precosDisponiveis(item);
  if (precos.length === 0) return null;
  return { min: Math.min(...precos), max: Math.max(...precos) };
}

export function faixaPrecoGaveta(itens: Estoque[]): { min: number; max: number } | null {
  const precos = itens.flatMap(precosDisponiveis);
  if (precos.length === 0) return null;
  return { min: Math.min(...precos), max: Math.max(...precos) };
}

export function statsGaveta(itens: Estoque[]) {
  const unidadesDisponiveis = itens.reduce((s, i) => s + precosDisponiveis(i).length, 0);
  const valorTotal = itens.flatMap(precosDisponiveis).reduce((s, p) => s + p, 0);
  return { variantes: itens.length, unidadesDisponiveis, valorTotal, faixa: faixaPrecoGaveta(itens) };
}
