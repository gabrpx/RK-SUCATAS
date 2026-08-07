// Funções puras sobre vendas já carregadas — mesmo padrão de
// src/features/fiado/metricas.ts e src/features/clientes/metricas.ts.
import type { Venda } from './types';

// Soma de tudo que já foi vendido em partes avulsas (componente_vendido) de
// um item — usada pra sugerir o valor da próxima parte e pra mostrar quanto
// já saiu do conjunto original na tela de estoque.
export function valorVendidoEmPartes(estoqueId: string, vendas: Venda[]): number {
  return vendas
    .filter((v) => v.estoque_id === estoqueId && v.componente_vendido !== null)
    .reduce((soma, v) => soma + Number(v.valor_unitario) * Number(v.quantidade), 0);
}

// Valor restante estimado do conjunto original depois de descontar as partes
// já vendidas — só um cálculo de exibição (a decisão de produto foi: nunca
// alterar estoque.valor no banco por causa disso, é sempre recalculado on-the-fly).
export function valorRestanteEstimado(valorOriginal: number, estoqueId: string, vendas: Venda[]): number {
  return Math.max(0, Number(valorOriginal) - valorVendidoEmPartes(estoqueId, vendas));
}
