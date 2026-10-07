import { describe, expect, it } from 'vitest';
import { calcularSituacaoCliente, ordenarPendencias, podeTransicionarPedido } from './operacaoModel';
import type { ClienteOperacaoEntrada, PedidoBuscaEstadoPersistido } from './operacaoTypes';

const AGORA = new Date('2026-10-02T15:00:00-03:00');

const pedido = (
  status: PedidoBuscaEstadoPersistido,
  extras: Partial<ClienteOperacaoEntrada['pedidos'][number]> = {}
): ClienteOperacaoEntrada['pedidos'][number] => ({
  id: `pedido-${status}`,
  status,
  criadoEm: '2026-09-30T12:00:00-03:00',
  prometidoPara: null,
  proximaAcaoEm: null,
  ...extras,
});

describe('podeTransicionarPedido', () => {
  const estados: PedidoBuscaEstadoPersistido[] = [
    'nova',
    'em_busca',
    'peca_disponivel',
    'aguardando_cliente',
    'vendida',
    'nao_encontrada',
    'cliente_desistiu',
    'cancelada',
    'aguardando',
    'atendida',
  ];

  const permitidas = new Set([
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

  it('fixa toda a matriz de estados aceitos e rejeitados', () => {
    for (const de of estados) {
      for (const para of estados) {
        expect(podeTransicionarPedido(de, para), `${de} → ${para}`).toBe(permitidas.has(`${de}>${para}`));
      }
    }
  });

  it('não permite reabrir venda nem atendimento legado encerrado', () => {
    expect(podeTransicionarPedido('vendida', 'em_busca')).toBe(false);
    expect(podeTransicionarPedido('atendida', 'em_busca')).toBe(false);
  });
});

describe('calcularSituacaoCliente', () => {
  it.each([
    {
      nome: 'visita atrasada',
      entrada: { pedidos: [], reservas: [], visitas: [{ id: 'v1', status: 'agendada' as const, para: '2026-10-01T14:00:00-03:00' }] },
      codigo: 'visita_atrasada',
    },
    {
      nome: 'visita hoje',
      entrada: { pedidos: [], reservas: [], visitas: [{ id: 'v1', status: 'confirmada' as const, para: '2026-10-02T18:00:00-03:00' }] },
      codigo: 'visita_hoje',
    },
    {
      nome: 'promessa vencida',
      entrada: { pedidos: [pedido('em_busca', { prometidoPara: '2026-10-01T18:00:00-03:00' })], reservas: [], visitas: [] },
      codigo: 'promessa_vencida',
    },
    {
      nome: 'reserva vencendo em até 24 horas',
      entrada: { pedidos: [], reservas: [{ id: 'r1', status: 'ativa' as const, reservadaAte: '2026-10-03T14:00:00-03:00' }], visitas: [] },
      codigo: 'reserva_vencendo',
    },
    {
      nome: 'reserva aguardando retirada',
      entrada: { pedidos: [], reservas: [{ id: 'r1', status: 'ativa' as const, reservadaAte: '2026-10-04T18:00:00-03:00' }], visitas: [] },
      codigo: 'aguardando_retirada',
    },
    {
      nome: 'peça disponível',
      entrada: { pedidos: [pedido('peca_disponivel')], reservas: [], visitas: [] },
      codigo: 'peca_disponivel',
    },
    {
      nome: 'resposta atrasada',
      entrada: { pedidos: [pedido('aguardando_cliente', { proximaAcaoEm: '2026-10-02T14:00:00-03:00' })], reservas: [], visitas: [] },
      codigo: 'aguardando_resposta',
    },
    {
      nome: 'busca com próxima ação vencida',
      entrada: { pedidos: [pedido('em_busca', { proximaAcaoEm: '2026-10-01T12:00:00-03:00' })], reservas: [], visitas: [] },
      codigo: 'busca_antiga',
    },
    {
      nome: 'pedido novo',
      entrada: { pedidos: [pedido('nova')], reservas: [], visitas: [] },
      codigo: 'pedido_novo',
    },
    {
      nome: 'sem pendências',
      entrada: { pedidos: [pedido('vendida')], reservas: [], visitas: [] },
      codigo: 'sem_pendencias',
    },
  ])('calcula $nome', ({ entrada, codigo }) => {
    expect(calcularSituacaoCliente(entrada, AGORA)).toMatchObject({ codigo });
  });

  it('mostra somente a situação mais urgente quando o cliente tem várias pendências', () => {
    const entrada: ClienteOperacaoEntrada = {
      pedidos: [
        pedido('nova', { id: 'novo' }),
        pedido('peca_disponivel', { id: 'disponivel' }),
        pedido('em_busca', { id: 'promessa', prometidoPara: '2026-10-01T12:00:00-03:00' }),
      ],
      reservas: [{ id: 'reserva', status: 'ativa', reservadaAte: '2026-10-03T10:00:00-03:00' }],
      visitas: [{ id: 'visita', status: 'agendada', para: '2026-10-02T17:00:00-03:00' }],
    };

    expect(calcularSituacaoCliente(entrada, AGORA).codigo).toBe('visita_hoje');
  });

  it('não consulta o relógio global quando agora é informado', () => {
    const entrada: ClienteOperacaoEntrada = {
      pedidos: [],
      reservas: [],
      visitas: [{ id: 'visita', status: 'agendada', para: '2026-10-02T17:00:00-03:00' }],
    };

    expect(calcularSituacaoCliente(entrada, new Date('2026-10-01T12:00:00-03:00')).codigo).toBe('visita_agendada');
    expect(calcularSituacaoCliente(entrada, new Date('2026-10-02T12:00:00-03:00')).codigo).toBe('visita_hoje');
  });
});

describe('ordenarPendencias', () => {
  it('segue a matriz de prioridade operacional', () => {
    const entradas: ClienteOperacaoEntrada[] = [
      { id: 'sem', pedidos: [], reservas: [], visitas: [] },
      { id: 'novo', pedidos: [pedido('nova')], reservas: [], visitas: [] },
      { id: 'busca', pedidos: [pedido('em_busca', { proximaAcaoEm: '2026-10-01T12:00:00-03:00' })], reservas: [], visitas: [] },
      { id: 'peca', pedidos: [pedido('peca_disponivel')], reservas: [], visitas: [] },
      { id: 'reserva', pedidos: [], reservas: [{ id: 'r1', status: 'ativa', reservadaAte: '2026-10-03T10:00:00-03:00' }], visitas: [] },
      { id: 'promessa', pedidos: [pedido('em_busca', { prometidoPara: '2026-10-01T12:00:00-03:00' })], reservas: [], visitas: [] },
      { id: 'visita', pedidos: [], reservas: [], visitas: [{ id: 'v1', status: 'agendada', para: '2026-10-01T12:00:00-03:00' }] },
    ];

    expect(entradas.sort((a, b) => ordenarPendencias(a, b, AGORA)).map((entrada) => entrada.id)).toEqual([
      'visita',
      'promessa',
      'reserva',
      'peca',
      'busca',
      'novo',
      'sem',
    ]);
  });

  it('desempata clientes na mesma classe pela data mais antiga', () => {
    const antigo: ClienteOperacaoEntrada = {
      id: 'antigo',
      pedidos: [pedido('nova', { criadoEm: '2026-09-20T12:00:00-03:00' })],
      reservas: [],
      visitas: [],
    };
    const recente: ClienteOperacaoEntrada = {
      id: 'recente',
      pedidos: [pedido('nova', { criadoEm: '2026-10-01T12:00:00-03:00' })],
      reservas: [],
      visitas: [],
    };

    expect([recente, antigo].sort((a, b) => ordenarPendencias(a, b, AGORA)).map((entrada) => entrada.id)).toEqual(['antigo', 'recente']);
  });
});
