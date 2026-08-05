// Valor de uma linha de estoque quando unidades da mesma peça podem ter
// preços diferentes (ver migration_014). Multiplicar preço × quantidade
// deixou de ser correto: se 1 dos 5 TBI está amassado e sai por R$ 400 em vez
// de R$ 600, o estoque vale R$ 2.800 e não R$ 3.000.
//
// Função pura — usada no total do estoque, no resumo do dia e no detalhe da
// peça, pra que os três números nunca discordem entre si.
import type { Estoque, EstoqueUnidade } from './types';

export function valorDaUnidade(unidade: EstoqueUnidade, valorPadrao: number): number {
  return unidade.valor === null || unidade.valor === undefined ? valorPadrao : Number(unidade.valor) || 0;
}

export function valorTotalItem(item: Estoque): number {
  const valorPadrao = Number(item.valor) || 0;
  const quantidade = Number(item.quantidade) || 0;
  // Só conta ficha com preço próprio; ficha de avaria sem preço continua
  // valendo o preço normal e não muda a conta.
  const comPrecoProprio = (item.unidades ?? []).filter((u) => u.valor !== null && u.valor !== undefined);

  // Mais fichas do que unidades em estoque é estado inconsistente (ver
  // `unidadesExcedentes`); aqui a conta não pode estourar, então limita ao
  // que existe de fato.
  const consideradas = comPrecoProprio.slice(0, quantidade);
  const restantes = Math.max(0, quantidade - consideradas.length);

  return consideradas.reduce((soma, u) => soma + (Number(u.valor) || 0), 0) + restantes * valorPadrao;
}

export function valorTotalEstoque(items: Estoque[]): number {
  return items.reduce((soma, item) => soma + valorTotalItem(item), 0);
}

export function temAvaria(item: Estoque): boolean {
  return (item.unidades ?? []).some((u) => u.avaria);
}

export function contarAvarias(item: Estoque): number {
  return (item.unidades ?? []).filter((u) => u.avaria).length;
}

// Mesmo padrão de herança de valorDaUnidade — undefined é tratado igual a
// null porque o backend pode devolver a ficha sem essa chave quando a coluna
// condicao_nota ainda não existe em produção (migration_024 pendente).
export function condicaoNotaDaUnidade(unidade: EstoqueUnidade, notaPadrao: number | null): number | null {
  return unidade.condicao_nota === null || unidade.condicao_nota === undefined ? notaPadrao : unidade.condicao_nota;
}

// Quantas fichas de unidade existem pra essa peça — independente de terem
// avaria ou não. Ver temAvaria/contarAvarias pra contagem específica de avaria.
export function contarFichas(item: Estoque): number {
  return (item.unidades ?? []).length;
}

// Quantas fichas sobram além do que existe fisicamente. Acontece depois de
// vender unidades: `quantidade` cai, mas o sistema não sabe qual unidade
// saiu, então as fichas ficam. Quem cataloga precisa revisar e apagar a que
// já foi embora.
export function unidadesExcedentes(item: Estoque): number {
  return Math.max(0, (item.unidades ?? []).length - (Number(item.quantidade) || 0));
}
