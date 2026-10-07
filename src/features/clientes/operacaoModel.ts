import { situacaoCopy } from './operacaoCopy';
import type {
  ClienteOperacaoEntrada,
  PedidoBuscaEstadoPersistido,
  SituacaoCliente,
  SituacaoClienteCodigo,
  SituacaoClienteNivel,
} from './operacaoTypes';

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const FUSO_OPERACAO = 'America/Sao_Paulo';

const TRANSICOES_PERMITIDAS = new Set<string>([
  'nova>em_busca',
  'nova>peca_disponivel',
  'nova>nao_encontrada',
  'nova>cancelada',
  'em_busca>peca_disponivel',
  'em_busca>nao_encontrada',
  'em_busca>cancelada',
  'peca_disponivel>em_busca',
  'peca_disponivel>aguardando_cliente',
  'peca_disponivel>cliente_desistiu',
  'peca_disponivel>cancelada',
  'aguardando_cliente>aguardando_cliente',
  'aguardando_cliente>cliente_desistiu',
  'aguardando_cliente>cancelada',
  'aguardando>em_busca',
  'aguardando>peca_disponivel',
  'aguardando>nao_encontrada',
  'aguardando>cancelada',
  'nao_encontrada>em_busca',
  'cliente_desistiu>em_busca',
  'cancelada>em_busca',
]);

const PRIORIDADE: Record<SituacaoClienteCodigo, number> = {
  visita_atrasada: 0,
  visita_hoje: 1,
  promessa_vencida: 10,
  reserva_vencida: 20,
  reserva_vencendo: 21,
  aguardando_retirada: 22,
  aguardando_resposta: 30,
  peca_disponivel: 31,
  busca_antiga: 40,
  visita_agendada: 50,
  pedido_novo: 60,
  procurando_peca: 61,
  sem_pendencias: 100,
};

interface Candidato {
  codigo: SituacaoClienteCodigo;
  nivel: SituacaoClienteNivel;
  quando: string | null;
  desempate: string;
}

function instante(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const timestamp = Date.parse(valor);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function chaveDoDia(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_OPERACAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function compararCandidatos(a: Candidato, b: Candidato): number {
  const porPrioridade = PRIORIDADE[a.codigo] - PRIORIDADE[b.codigo];
  if (porPrioridade !== 0) return porPrioridade;
  const dataA = instante(a.quando) ?? Number.POSITIVE_INFINITY;
  const dataB = instante(b.quando) ?? Number.POSITIVE_INFINITY;
  if (dataA !== dataB) return dataA - dataB;
  return a.desempate.localeCompare(b.desempate);
}

export function podeTransicionarPedido(
  de: PedidoBuscaEstadoPersistido,
  para: PedidoBuscaEstadoPersistido
): boolean {
  return TRANSICOES_PERMITIDAS.has(`${de}>${para}`);
}

export function calcularSituacaoCliente(entrada: ClienteOperacaoEntrada, agora: Date): SituacaoCliente {
  const candidatos: Candidato[] = [];
  const agoraMs = agora.getTime();
  const hoje = chaveDoDia(agora);

  for (const visita of entrada.visitas ?? []) {
    if (!['agendada', 'confirmada', 'reagendada'].includes(visita.status)) continue;
    const paraMs = instante(visita.para);
    if (paraMs === null) continue;
    const diaDaVisita = chaveDoDia(new Date(paraMs));
    candidatos.push(
      diaDaVisita < hoje
        ? { codigo: 'visita_atrasada', nivel: 'critico', quando: visita.para, desempate: visita.id }
        : diaDaVisita === hoje
          ? { codigo: 'visita_hoje', nivel: 'atencao', quando: visita.para, desempate: visita.id }
          : { codigo: 'visita_agendada', nivel: 'informativo', quando: visita.para, desempate: visita.id }
    );
  }

  for (const reserva of entrada.reservas ?? []) {
    if (!['ativa', 'decisao_pendente'].includes(reserva.status)) continue;
    const venceMs = instante(reserva.reservadaAte);
    if (venceMs === null) continue;
    const restante = venceMs - agoraMs;
    candidatos.push(
      restante <= 0
        ? { codigo: 'reserva_vencida', nivel: 'critico', quando: reserva.reservadaAte, desempate: reserva.id }
        : restante <= UM_DIA_MS
          ? { codigo: 'reserva_vencendo', nivel: 'atencao', quando: reserva.reservadaAte, desempate: reserva.id }
          : { codigo: 'aguardando_retirada', nivel: 'atencao', quando: reserva.reservadaAte, desempate: reserva.id }
    );
  }

  for (const pedido of entrada.pedidos ?? []) {
    if (['vendida', 'nao_encontrada', 'cliente_desistiu', 'cancelada', 'atendida'].includes(pedido.status)) continue;

    const promessaMs = instante(pedido.prometidoPara);
    if (promessaMs !== null && promessaMs < agoraMs) {
      candidatos.push({ codigo: 'promessa_vencida', nivel: 'critico', quando: pedido.prometidoPara ?? null, desempate: pedido.id });
    }

    const proximaAcaoMs = instante(pedido.proximaAcaoEm);
    if (pedido.status === 'aguardando_cliente') {
      candidatos.push({
        codigo: 'aguardando_resposta',
        nivel: proximaAcaoMs !== null && proximaAcaoMs <= agoraMs ? 'atencao' : 'informativo',
        quando: pedido.proximaAcaoEm ?? pedido.criadoEm,
        desempate: pedido.id,
      });
    } else if (pedido.status === 'peca_disponivel') {
      candidatos.push({ codigo: 'peca_disponivel', nivel: 'atencao', quando: pedido.criadoEm, desempate: pedido.id });
    } else if (pedido.status === 'nova') {
      candidatos.push({ codigo: 'pedido_novo', nivel: 'informativo', quando: pedido.criadoEm, desempate: pedido.id });
    } else if (proximaAcaoMs !== null && proximaAcaoMs <= agoraMs) {
      candidatos.push({ codigo: 'busca_antiga', nivel: 'atencao', quando: pedido.proximaAcaoEm ?? pedido.criadoEm, desempate: pedido.id });
    } else {
      candidatos.push({ codigo: 'procurando_peca', nivel: 'informativo', quando: pedido.proximaAcaoEm ?? pedido.criadoEm, desempate: pedido.id });
    }
  }

  const principal = candidatos.sort(compararCandidatos)[0] ?? {
    codigo: 'sem_pendencias' as const,
    nivel: 'neutro' as const,
    quando: null,
    desempate: '',
  };

  return {
    codigo: principal.codigo,
    rotulo: situacaoCopy[principal.codigo],
    nivel: principal.nivel,
    proximaAcaoEm: principal.quando,
  };
}

export function ordenarPendencias(a: ClienteOperacaoEntrada, b: ClienteOperacaoEntrada, agora: Date): number {
  const situacaoA = calcularSituacaoCliente(a, agora);
  const situacaoB = calcularSituacaoCliente(b, agora);
  const porPrioridade = PRIORIDADE[situacaoA.codigo] - PRIORIDADE[situacaoB.codigo];
  if (porPrioridade !== 0) return porPrioridade;

  const dataA = instante(situacaoA.proximaAcaoEm) ?? Number.POSITIVE_INFINITY;
  const dataB = instante(situacaoB.proximaAcaoEm) ?? Number.POSITIVE_INFINITY;
  if (dataA !== dataB) return dataA - dataB;
  return (a.id ?? '').localeCompare(b.id ?? '');
}
