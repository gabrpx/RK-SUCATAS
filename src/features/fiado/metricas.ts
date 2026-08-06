// Funções puras — mesmo padrão de src/features/clientes/metricas.ts: operam
// sobre vendas + fiado_recebimentos já carregados pelo DataContext, sem
// endpoint novo de agregação.
//
// Venda com forma de pagamento de natureza 'fiado' não lança no Caixa na
// hora (ver registrar_venda, migration_031) — só lança quando um
// recebimento é confirmado, podendo ser parcial. O saldo em aberto de cada
// venda é `valor_total - soma dos recebimentos dela`; ela sai da lista "em
// aberto" quando o saldo chega a zero.
import type { Venda } from '../vendas/types';
import type { FiadoRecebimento } from './types';

export interface VendaFiadoEmAberto {
  venda: Venda;
  saldo: number;
  recebido: number;
  diasEmAberto: number;
}

export interface ResumoFiadoCliente {
  clienteId: string | null;
  clienteNome: string;
  vendas: VendaFiadoEmAberto[];
  totalEmAberto: number;
  diasEmAbertoMax: number;
}

const EPSILON = 0.01;

export function saldoPorVenda(venda: Venda, recebimentos: FiadoRecebimento[]): number {
  const recebido = recebimentos.filter((r) => r.venda_id === venda.id).reduce((soma, r) => soma + Number(r.valor), 0);
  return Number(venda.valor_total) - recebido;
}

export function vendasFiadoEmAberto(vendas: Venda[], recebimentos: FiadoRecebimento[], agora: Date = new Date()): VendaFiadoEmAberto[] {
  const recebidoPorVenda = new Map<string, number>();
  for (const r of recebimentos) {
    recebidoPorVenda.set(r.venda_id, (recebidoPorVenda.get(r.venda_id) ?? 0) + Number(r.valor));
  }

  return vendas
    .filter((v) => v.forma_pagamento?.natureza === 'fiado')
    .map((venda) => {
      const recebido = recebidoPorVenda.get(venda.id) ?? 0;
      return { venda, recebido, saldo: Number(venda.valor_total) - recebido };
    })
    .filter((item) => item.saldo > EPSILON)
    .map((item) => ({
      ...item,
      diasEmAberto: Math.floor((agora.getTime() - new Date(`${item.venda.data}T00:00:00`).getTime()) / 86400000),
    }))
    .sort((a, b) => b.diasEmAberto - a.diasEmAberto);
}

// Agrupa por cliente_id quando a venda está vinculada a um cadastro; sem
// vínculo, agrupa por cliente_nome (texto livre) — mesma lógica de "não
// perde a informação só porque não tem cadastro" usada em Vendas/Orçamentos.
export function resumoFiadoPorCliente(vendas: Venda[], recebimentos: FiadoRecebimento[], agora: Date = new Date()): ResumoFiadoCliente[] {
  const emAberto = vendasFiadoEmAberto(vendas, recebimentos, agora);
  const porChave = new Map<string, ResumoFiadoCliente>();

  for (const item of emAberto) {
    const clienteId = item.venda.cliente_id;
    const clienteNome = item.venda.cliente?.nome || item.venda.cliente_nome || 'Sem nome';
    const chave = clienteId ?? `nome:${clienteNome.toLowerCase()}`;

    const atual = porChave.get(chave) ?? { clienteId, clienteNome, vendas: [], totalEmAberto: 0, diasEmAbertoMax: 0 };
    atual.vendas.push(item);
    atual.totalEmAberto += item.saldo;
    atual.diasEmAbertoMax = Math.max(atual.diasEmAbertoMax, item.diasEmAberto);
    porChave.set(chave, atual);
  }

  return Array.from(porChave.values()).sort((a, b) => b.diasEmAbertoMax - a.diasEmAbertoMax);
}
