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
  // Só conta ficha com preço próprio, ainda disponível (não vendida); ficha
  // de avaria sem preço continua valendo o preço normal e não muda a conta.
  const comPrecoProprio = (item.unidades ?? []).filter((u) => u.valor !== null && u.valor !== undefined && !u.vendida_em);

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
  return (item.unidades ?? []).some((u) => u.avaria && !u.vendida_em);
}

export function contarAvarias(item: Estoque): number {
  return (item.unidades ?? []).filter((u) => u.avaria && !u.vendida_em).length;
}

// Mesmo padrão de herança de valorDaUnidade — undefined é tratado igual a
// null porque o backend pode devolver a ficha sem essa chave quando a coluna
// condicao_nota ainda não existe em produção (migration_024 pendente).
export function condicaoNotaDaUnidade(unidade: EstoqueUnidade, notaPadrao: number | null): number | null {
  return unidade.condicao_nota === null || unidade.condicao_nota === undefined ? notaPadrao : unidade.condicao_nota;
}

// Quantas fichas de unidade AINDA DISPONÍVEIS existem pra essa peça —
// independente de terem avaria ou não. Fichas já vendidas (ver
// migration_038/vendida_em) não contam aqui: o badge "X fichas" na listagem
// deve refletir o que ainda dá pra escolher na hora de vender, não o
// histórico completo. Ver temAvaria/contarAvarias pra contagem de avaria.
export function contarFichas(item: Estoque): number {
  return (item.unidades ?? []).filter((u) => !u.vendida_em).length;
}

// Quantas fichas DISPONÍVEIS sobram além do que existe fisicamente. Antes de
// migration_038, isso acontecia sempre que uma unidade era vendida (o sistema
// não sabia qual ficha saiu, então sobrava uma órfã pra quem cataloga apagar
// na mão). Agora que dá pra vender uma ficha específica (ela vira
// vendida_em automaticamente), esse aviso só deveria aparecer pra vendas
// antigas/genéricas que não apontaram ficha nenhuma.
export function unidadesExcedentes(item: Estoque): number {
  const disponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em).length;
  return Math.max(0, disponiveis - (Number(item.quantidade) || 0));
}

// Critério único de "estoque baixo" — usado tanto no filtro da tela de
// Estoque quanto no alerta do Dashboard, pra nunca discordarem entre si.
// Zerado não conta aqui de propósito: esse caso já aparece descrito como
// "esgotado" em outro lugar da tela, ficar baixo é sobre o que ainda dá pra vender.
export function isEstoqueBaixo(item: Estoque): boolean {
  return item.quantidade > 0 && item.quantidade <= 2;
}
