// Funções puras — mesmo padrão de src/features/clientes/metricas.ts: operam
// sobre vendas + fiado_baixas já carregados pelo DataContext, sem endpoint
// novo de agregação.
//
// "Em aberto" aqui é só rastreamento informativo: as vendas com forma de
// pagamento de natureza 'fiado' já foram lançadas no Caixa no valor cheio no
// momento da venda (decisão explícita — ver plano da Fase 2). Uma baixa não
// gera nem duplica lançamento nenhum, só tira a venda desta lista.
import type { Venda } from '../vendas/types';
import type { FiadoBaixa } from './types';

export interface VendaFiadoEmAberto {
  venda: Venda;
  diasEmAberto: number;
}

export interface ResumoFiadoCliente {
  clienteId: string | null;
  clienteNome: string;
  vendas: VendaFiadoEmAberto[];
  totalEmAberto: number;
  diasEmAbertoMax: number;
}

export function vendasFiadoEmAberto(vendas: Venda[], baixas: FiadoBaixa[], agora: Date = new Date()): VendaFiadoEmAberto[] {
  const quitadas = new Set(baixas.map((b) => b.venda_id));
  return vendas
    .filter((v) => v.forma_pagamento?.natureza === 'fiado' && !quitadas.has(v.id))
    .map((venda) => ({
      venda,
      diasEmAberto: Math.floor((agora.getTime() - new Date(`${venda.data}T00:00:00`).getTime()) / 86400000),
    }))
    .sort((a, b) => b.diasEmAberto - a.diasEmAberto);
}

// Agrupa por cliente_id quando a venda está vinculada a um cadastro; sem
// vínculo, agrupa por cliente_nome (texto livre) — mesma lógica de "não
// perde a informação só porque não tem cadastro" usada em Vendas/Orçamentos.
export function resumoFiadoPorCliente(vendas: Venda[], baixas: FiadoBaixa[], agora: Date = new Date()): ResumoFiadoCliente[] {
  const emAberto = vendasFiadoEmAberto(vendas, baixas, agora);
  const porChave = new Map<string, ResumoFiadoCliente>();

  for (const item of emAberto) {
    const clienteId = item.venda.cliente_id;
    const clienteNome = item.venda.cliente?.nome || item.venda.cliente_nome || 'Sem nome';
    const chave = clienteId ?? `nome:${clienteNome.toLowerCase()}`;

    const atual = porChave.get(chave) ?? { clienteId, clienteNome, vendas: [], totalEmAberto: 0, diasEmAbertoMax: 0 };
    atual.vendas.push(item);
    atual.totalEmAberto += Number(item.venda.valor_total);
    atual.diasEmAbertoMax = Math.max(atual.diasEmAbertoMax, item.diasEmAberto);
    porChave.set(chave, atual);
  }

  return Array.from(porChave.values()).sort((a, b) => b.diasEmAbertoMax - a.diasEmAbertoMax);
}
