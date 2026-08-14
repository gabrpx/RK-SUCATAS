import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./pushNotificationService.js', () => ({ notificarUsuarios: vi.fn(() => Promise.resolve()) }));

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
import { notificarUsuarios } from './pushNotificationService.js';
import { processarPedidosPendentes } from './mercadolivreSync.js';

// Fila em memória: cada teste declara as linhas pendentes e inspeciona o que
// o consumidor escreveu de volta.
function criarSupabaseFake(opts: {
  pendentes: { id: string; topic: string; resource: string; tentativas: number; recebido_em?: string }[];
  estoquePorMlb?: Record<string, { id: string; nome: string }>;
  formaPagamentoId?: string | null;
  registrarVenda?: (params: any) => { data: any; error: any };
  erroUpdateVenda?: any; // falha do update pós-RPC (canal/ml_order_id)
  variacoes?: Record<string, string>; // ml_variation_id -> unidade_id
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
          update: () => ({ eq: () => Promise.resolve({ error: opts.erroUpdateVenda ?? null }) }),
        };
      }
      if (tabela === 'usuarios') {
        return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: [{ id: 'user-1' }], error: null }) }) }) };
      }
      if (tabela === 'estoque_anuncios_ml_variacoes') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) =>
              Promise.resolve({
                data: ids.filter((id) => opts.variacoes?.[id]).map((id) => ({ ml_variation_id: id, unidade_id: opts.variacoes![id] })),
                error: null,
              }),
          }),
        };
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

  it('pedido ainda não pago (pix/boleto pendente) fica na fila em vez de queimar a linha', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({ ...pedidoPago, status: 'payment_required' } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0, recebido_em: new Date().toISOString() }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(resultado.aguardandoPagamento).toBe(1);
    expect(supabase.vendasRegistradas).toHaveLength(0);
    // A linha NÃO pode ser tocada: o pagamento pode ser aprovado depois e o
    // upsert de webhook/polling é ON CONFLICT DO NOTHING (não reabre a linha).
    expect(supabase.atualizacoes).toHaveLength(0);
  });

  it('pedido pendente de pagamento há mais de 7 dias desiste, com erro explicando', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({ ...pedidoPago, status: 'payment_in_process' } as any);
    const oitoDiasAtras = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0, recebido_em: oitoDiasAtras }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(supabase.vendasRegistradas).toHaveLength(0);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
    expect(supabase.atualizacoes[0].erro).toMatch(/nunca foi pago/i);
    expect(resultado.ignorados).toBe(1);
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

  it('duas unidades do mesmo anúncio no mesmo pedido: importa a primeira e avisa sobre a segunda', async () => {
    // No ML order_items é por variação: duas fichas do mesmo MLB viram duas
    // entradas com item.id idêntico. A dedupe é (ml_order_id, ml_item_id), sem
    // variação, então a segunda seria descartada em silêncio.
    vi.mocked(buscarPedido).mockResolvedValue({
      ...pedidoPago,
      order_items: [
        { item: { id: 'MLB111', title: 'Lanterna Traseira', variation_id: 900123 }, quantity: 1, unit_price: 120 },
        { item: { id: 'MLB111', title: 'Lanterna Traseira', variation_id: 900456 }, quantity: 1, unit_price: 120 },
      ],
    } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      variacoes: { '900123': 'unidade-7', '900456': 'unidade-8' },
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(1);
    expect(supabase.vendasRegistradas).toHaveLength(1);
    expect(resultado.semMatch).toHaveLength(1);
    expect(resultado.semMatch[0].motivo).toMatch(/2 unidades do mesmo anúncio/i);
    const corpos = vi.mocked(notificarUsuarios).mock.calls.map((c) => c[2].corpo);
    expect(corpos.some((c) => /mesmo anúncio/i.test(c))).toBe(true);
  });

  it('falha do update pós-venda NÃO é retentada — retry duplicaria a venda e a baixa de estoque', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      erroUpdateVenda: { message: 'conexão caiu no meio' },
    });

    await processarPedidosPendentes(supabase);

    // A RPC já rodou: o estoque foi decrementado. Se a linha voltasse pra fila,
    // o pré-check não acharia nada (ml_order_id ficou NULL) e a venda sairia de
    // novo. Melhor uma linha marcada com erro pra um humano olhar.
    expect(supabase.vendasRegistradas).toHaveLength(1);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
    expect(supabase.atualizacoes[0].erro).toContain('conexão caiu no meio');
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

  it('pedido de uma variação registra a venda na ficha de unidade correspondente', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({
      ...pedidoPago,
      order_items: [{ item: { id: 'MLB111', title: 'Lanterna Traseira', variation_id: 900123 }, quantity: 1, unit_price: 120 }],
    } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      variacoes: { '900123': 'unidade-7' },
    });

    await processarPedidosPendentes(supabase);

    expect(supabase.vendasRegistradas[0]).toMatchObject({ p_estoque_id: 'peca-1', p_unidade_id: 'unidade-7' });
  });

  it('variação desconhecida (migration 043 sem o vínculo) registra a venda sem ficha, em vez de falhar', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({
      ...pedidoPago,
      order_items: [{ item: { id: 'MLB111', title: 'Lanterna Traseira', variation_id: 900999 }, quantity: 1, unit_price: 120 }],
    } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      variacoes: {},
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(1);
    expect(supabase.vendasRegistradas[0].p_unidade_id).toBeNull();
  });

  it('avisa a equipe quando importou, dizendo quantas peças saíram', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    await processarPedidosPendentes(supabase);

    expect(notificarUsuarios).toHaveBeenCalledWith(supabase, ['user-1'], expect.objectContaining({ url: '/mercadolivre' }));
    const payload = vi.mocked(notificarUsuarios).mock.calls[0][2];
    expect(payload.corpo).toContain('Lanterna Traseira');
  });

  it('avisa separadamente o pedido que não casou com peça nenhuma', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: {},
    });

    await processarPedidosPendentes(supabase);

    const corpos = vi.mocked(notificarUsuarios).mock.calls.map((c) => c[2].corpo);
    expect(corpos.some((c) => /não casou|não encontrada/i.test(c))).toBe(true);
  });

  it('ciclo sem novidade não dispara push nenhum', async () => {
    const supabase = criarSupabaseFake({ pendentes: [] });

    await processarPedidosPendentes(supabase);

    expect(notificarUsuarios).not.toHaveBeenCalled();
  });
});
