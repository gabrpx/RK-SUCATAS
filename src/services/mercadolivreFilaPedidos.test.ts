import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./mercadolivreApi.js', () => ({
  obterConexaoAtual: vi.fn(),
  buscarPedido: vi.fn(),
  buscarPedidosRecentes: vi.fn(),
  buscarPerguntas: vi.fn(),
  buscarItensPorIds: vi.fn(),
  obterMargemSincronizacao: vi.fn(),
  atualizarItemML: vi.fn(),
  extrairMlbId: vi.fn((url: string) => url?.match(/MLB\d+/)?.[0] ?? null),
  buscarEnvio: vi.fn(),
  responderPergunta: vi.fn(),
}));

import { obterConexaoAtual, buscarPedido } from './mercadolivreApi.js';
import { processarPedidosPendentes } from './mercadolivreSync.js';

// Fila em memória: cada teste declara as linhas pendentes e inspeciona o que
// o consumidor escreveu de volta.
function criarSupabaseFake(opts: {
  pendentes: { id: string; topic: string; resource: string; tentativas: number }[];
  estoquePorMlb?: Record<string, { id: string; nome: string }>;
  formaPagamentoId?: string | null;
  registrarVenda?: (params: any) => { data: any; error: any };
}) {
  const atualizacoes: Record<string, any>[] = [];
  const vendasRegistradas: any[] = [];

  const supabase: any = {
    atualizacoes,
    vendasRegistradas,
    from(tabela: string) {
      if (tabela === 'mercadolivre_notificacoes') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({ order: () => ({ limit: () => Promise.resolve({ data: opts.pendentes, error: null }) }) }),
            }),
          }),
          update(payload: any) {
            return { eq: (_c: string, id: string) => { atualizacoes.push({ id, ...payload }); return Promise.resolve({ error: null }); } };
          },
        };
      }
      if (tabela === 'formas_pagamento') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.formaPagamentoId === null ? null : { id: opts.formaPagamentoId ?? 'fp-ml' }, error: null }) }) }),
        };
      }
      // construirMapaEstoquePorMlb (já existente em mercadolivreSync.ts) consulta
      // estoque_anuncios_ml SEM .eq() e só cai no fallback de 'estoque' quando esse
      // select devolve erro de migração ausente. O fake espelha isso: devolve as
      // linhas já no formato mlb_id + estoque aninhado, como a query real faz.
      if (tabela === 'estoque_anuncios_ml') {
        const linhas = Object.entries(opts.estoquePorMlb ?? {}).map(([mlb, peca]) => ({
          mlb_id: mlb,
          estoque: {
            id: peca.id, nome: peca.nome, valor: 10, quantidade: 1, condicao: 'original',
            ano: null, modelo_moto: null,
          },
        }));
        return { select: () => Promise.resolve({ data: linhas, error: null }) };
      }
      if (tabela === 'vendas') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (tabela === 'usuarios') {
        return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      throw new Error(`tabela inesperada no fake: ${tabela}`);
    },
    rpc(nome: string, params: any) {
      if (nome !== 'registrar_venda') throw new Error(`rpc inesperada: ${nome}`);
      vendasRegistradas.push(params);
      return Promise.resolve(opts.registrarVenda ? opts.registrarVenda(params) : { data: { id: 'venda-1' }, error: null });
    },
  };
  return supabase;
}

const pedidoPago = {
  id: 555,
  status: 'paid',
  date_created: '2026-08-14T10:00:00.000Z',
  buyer: { nickname: 'comprador1' },
  shipping: { id: 777 },
  order_items: [{ item: { id: 'MLB111', title: 'Lanterna Traseira' }, quantity: 1, unit_price: 120 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterConexaoAtual).mockResolvedValue({ accessToken: 'token-fake', mlUserId: '42' } as any);
});

describe('processarPedidosPendentes', () => {
  it('pedido pago que casa com peça vira venda e marca a linha como processada', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(1);
    expect(supabase.vendasRegistradas[0]).toMatchObject({ p_estoque_id: 'peca-1', p_quantidade: 1, p_valor_unitario: 120, p_forma_pagamento_id: 'fp-ml' });
    expect(supabase.atualizacoes[0]).toMatchObject({ id: 'n1', erro: null });
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('pedido não pago é marcado processado sem virar venda', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({ ...pedidoPago, status: 'cancelled' } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(resultado.ignorados).toBe(1);
    expect(supabase.vendasRegistradas).toHaveLength(0);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('pedido sem peça correspondente não inventa venda — reporta pra avisar o usuário', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: {},
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(resultado.semMatch).toEqual([{ mlOrderId: '555', titulo: 'Lanterna Traseira' }]);
    expect(supabase.vendasRegistradas).toHaveLength(0);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('falha temporária não marca processado — incrementa tentativas pro próximo ciclo', async () => {
    vi.mocked(buscarPedido).mockRejectedValue(new Error('timeout'));
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.falhas).toBe(1);
    expect(supabase.atualizacoes[0]).toMatchObject({ id: 'n1', tentativas: 1, erro: 'timeout' });
    expect(supabase.atualizacoes[0].processado_em).toBeUndefined();
  });

  it('na última tentativa, marca processado preservando o erro pra não travar a fila', async () => {
    vi.mocked(buscarPedido).mockRejectedValue(new Error('timeout'));
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 4 }],
    });

    await processarPedidosPendentes(supabase);

    expect(supabase.atualizacoes[0]).toMatchObject({ id: 'n1', tentativas: 5, erro: 'timeout' });
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('estoque insuficiente vira aviso, não retry infinito', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      registrarVenda: () => ({ data: null, error: { message: 'Estoque insuficiente para o item' } }),
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.semMatch).toHaveLength(1);
    expect(resultado.falhas).toBe(0);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('sem conta conectada, não faz nada', async () => {
    vi.mocked(obterConexaoAtual).mockResolvedValue(null);
    const supabase = criarSupabaseFake({ pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }] });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(buscarPedido).not.toHaveBeenCalled();
  });

  it('sem a forma de pagamento MERCADO LIVRE (migration 044 não rodou), não importa nada', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      formaPagamentoId: null,
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(supabase.vendasRegistradas).toHaveLength(0);
    expect(supabase.atualizacoes).toHaveLength(0);
  });
});
