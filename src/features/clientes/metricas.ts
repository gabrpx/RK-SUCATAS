// Funções puras de RFM/histórico — mesmo padrão de
// src/features/estoque/resumoDoDia.ts: operam sobre os arrays já carregados
// pelo DataContext, sem endpoint novo de agregação.
//
// Histórico/RFM contam SÓ vendas, nunca orçamentos junto — um orçamento
// convertido já vira venda, então somar os dois contaria a mesma compra em
// dobro. Orçamentos em aberto do cliente aparecem à parte, como pendência.
import type { StatusTone } from '../../components/ui/StatusBadge';
import type { Cliente, PecaProcuradaResumo } from './types';
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

// Badge por moto que o cliente já procurou peça — substitui o uso de "tags"
// livres pra esse fim (que não tinham relação nenhuma com pecas_procuradas).
// Um cliente pode ter procurado a mesma moto mais de uma vez com status
// diferentes: o badge agrega tudo num só, priorizando "atendida" > "aguardando" > "cancelada".
export interface BadgeMotoProcurada {
  modeloMotoId: string;
  nome: string;
  tom: StatusTone;
}

const PRIORIDADE_STATUS: Record<PecaProcuradaResumo['status'], number> = { atendida: 2, aguardando: 1, cancelada: 0 };
const TOM_POR_STATUS: Record<PecaProcuradaResumo['status'], StatusTone> = { atendida: 'positive', aguardando: 'warning', cancelada: 'neutral' };

export function badgesMotoProcurada(clienteId: string, pecasProcuradas: PecaProcuradaResumo[]): BadgeMotoProcurada[] {
  const porModelo = new Map<string, PecaProcuradaResumo>();
  for (const p of pecasProcuradas) {
    if (p.cliente_id !== clienteId || !p.modelo_moto_id || !p.modelo_moto) continue;
    const atual = porModelo.get(p.modelo_moto_id);
    if (!atual || PRIORIDADE_STATUS[p.status] > PRIORIDADE_STATUS[atual.status]) porModelo.set(p.modelo_moto_id, p);
  }
  return Array.from(porModelo.values())
    .map((p) => ({ modeloMotoId: p.modelo_moto_id!, nome: p.modelo_moto!.nome, tom: TOM_POR_STATUS[p.status] }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
}

// Lista de motos distintas presentes em qualquer peça procurada — alimenta o
// dropdown de filtro "por moto procurada" na listagem de clientes.
export function motosDistintasProcuradas(pecasProcuradas: PecaProcuradaResumo[]): { id: string; nome: string }[] {
  const mapa = new Map<string, string>();
  for (const p of pecasProcuradas) {
    if (p.modelo_moto_id && p.modelo_moto) mapa.set(p.modelo_moto_id, p.modelo_moto.nome);
  }
  return Array.from(mapa.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
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
