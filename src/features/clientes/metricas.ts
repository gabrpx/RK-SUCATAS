// Funções puras de RFM/histórico — mesmo padrão de
// src/features/estoque/resumoDoDia.ts: operam sobre os arrays já carregados
// pelo DataContext, sem endpoint novo de agregação.
//
// Histórico/RFM contam SÓ vendas, nunca orçamentos junto — um orçamento
// convertido já vira venda, então somar os dois contaria a mesma compra em
// dobro. Orçamentos em aberto do cliente aparecem à parte, como pendência.
import type { StatusTone } from '../../components/ui/StatusBadge';
import type { Cliente } from './types';
import type { Venda } from '../vendas/types';
import type { Orcamento } from '../orcamentos/types';

export type SegmentoCliente = 'sem_compras' | 'novo' | 'ativo' | 'campeao' | 'em_risco' | 'sumido';

export const SEGMENTO_LABELS: Record<SegmentoCliente, string> = {
  sem_compras: 'Sem compras',
  novo: 'Novo',
  ativo: 'Ativo',
  campeao: 'Campeão',
  em_risco: 'Em risco',
  sumido: 'Sumido',
};

export const SEGMENTO_TONS: Record<SegmentoCliente, StatusTone> = {
  sem_compras: 'neutral',
  novo: 'accent',
  ativo: 'positive',
  campeao: 'positive',
  em_risco: 'warning',
  sumido: 'danger',
};

const DIAS_SUMIDO = 90;
const DIAS_EM_RISCO = 45;
const COMPRAS_CAMPEAO = 5;

export interface HistoricoCliente {
  vendas: Venda[];
  orcamentosAbertos: Orcamento[];
  totalGasto: number;
  quantidadeCompras: number;
  ticketMedio: number;
  ultimaCompraEm: string | null;
  diasDesdeUltimaCompra: number | null;
}

export function calcularHistoricoCliente(clienteId: string, vendas: Venda[], orcamentos: Orcamento[], agora: Date = new Date()): HistoricoCliente {
  const vendasCliente = vendas.filter((v) => v.cliente_id === clienteId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const orcamentosAbertos = orcamentos.filter((o) => o.cliente_id === clienteId && o.status === 'aberto');

  const totalGasto = vendasCliente.reduce((soma, v) => soma + Number(v.valor_total), 0);
  const quantidadeCompras = vendasCliente.length;
  const ticketMedio = quantidadeCompras > 0 ? totalGasto / quantidadeCompras : 0;
  const ultimaCompraEm = vendasCliente[0]?.data ?? null;
  const diasDesdeUltimaCompra = ultimaCompraEm ? Math.floor((agora.getTime() - new Date(`${ultimaCompraEm}T00:00:00`).getTime()) / 86400000) : null;

  return { vendas: vendasCliente, orcamentosAbertos, totalGasto, quantidadeCompras, ticketMedio, ultimaCompraEm, diasDesdeUltimaCompra };
}

export function calcularSegmento(historico: HistoricoCliente): SegmentoCliente {
  const { quantidadeCompras, diasDesdeUltimaCompra } = historico;
  if (quantidadeCompras === 0 || diasDesdeUltimaCompra === null) return 'sem_compras';
  if (diasDesdeUltimaCompra >= DIAS_SUMIDO) return 'sumido';
  if (diasDesdeUltimaCompra >= DIAS_EM_RISCO) return 'em_risco';
  if (quantidadeCompras >= COMPRAS_CAMPEAO) return 'campeao';
  return quantidadeCompras <= 1 ? 'novo' : 'ativo';
}

export function clientesSumidos(clientes: Cliente[], vendas: Venda[], orcamentos: Orcamento[], limiteDias: number = DIAS_SUMIDO, agora: Date = new Date()) {
  return clientes
    .filter((c) => c.ativo)
    .map((c) => ({ cliente: c, historico: calcularHistoricoCliente(c.id, vendas, orcamentos, agora) }))
    .filter(({ historico }) => historico.quantidadeCompras > 0 && (historico.diasDesdeUltimaCompra ?? 0) >= limiteDias)
    .sort((a, b) => (b.historico.diasDesdeUltimaCompra ?? 0) - (a.historico.diasDesdeUltimaCompra ?? 0));
}

export function rankingTopClientes(clientes: Cliente[], vendas: Venda[], orcamentos: Orcamento[], opcoes: { limite?: number; desde?: Date } = {}) {
  const { limite = 5, desde } = opcoes;
  return clientes
    .filter((c) => c.ativo)
    .map((c) => {
      const vendasCliente = vendas.filter((v) => v.cliente_id === c.id && (!desde || new Date(v.data) >= desde));
      const totalGasto = vendasCliente.reduce((soma, v) => soma + Number(v.valor_total), 0);
      return { cliente: c, totalGasto, quantidadeCompras: vendasCliente.length };
    })
    .filter((r) => r.quantidadeCompras > 0)
    .sort((a, b) => b.totalGasto - a.totalGasto)
    .slice(0, limite);
}
