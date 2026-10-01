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
  buscarCustoEnvioVendedor: vi.fn(),
  responderPergunta: vi.fn(),
  // Puras — mesma implementação da real (ver mercadolivreApi.ts), copiadas
  // aqui só pra não precisar mockar toda a resposta da API por teste.
  encontrarItemPedido: (pedido: any, mlItemId: string) => pedido.order_items.find((linha: any) => linha.item.id === mlItemId) ?? null,
  calcularValorRecebido: (valorTotal: number, saleFee: number | null | undefined, custoEnvio: number | null | undefined, descontoVendedor = 0) =>
    saleFee == null || custoEnvio == null ? null : valorTotal - saleFee - custoEnvio - descontoVendedor,
  calcularDescontoVendedor: (linha: any) => (linha?.discounts ?? []).reduce((total: number, desconto: any) => total + (Number(desconto.amounts?.seller) || 0), 0),
  alocarCustoEnvio: (pedido: any, custoEnvioTotal: number, mlItemId: string) => {
    const linha = pedido.order_items.find((l: any) => l.item.id === mlItemId);
    if (!linha) return 0;
    const totalPedido = pedido.order_items.reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
    if (totalPedido <= 0) return 0;
    return Math.round(custoEnvioTotal * ((linha.quantity * linha.unit_price) / totalPedido) * 100) / 100;
  },
  resolverNomeComprador: (buyer: any) => {
    if (!buyer) return null;
    const primeiroNome = buyer.first_name?.trim();
    const sobrenome = buyer.last_name?.trim();
    const nomesDisponiveis = [primeiroNome, sobrenome].filter(Boolean);
    if (nomesDisponiveis.length > 0) return nomesDisponiveis.join(' ');
    if (buyer.nickname?.trim()) return buyer.nickname.trim();
    return null;
  },
}));

import { obterConexaoAtual, buscarPedido, buscarCustoEnvioVendedor } from './mercadolivreApi.js';
import { buscarPreviewPedidos, importarPedidoComoVenda, corrigirTaxaVendasMlImportadas } from './mercadolivreSync.js';

beforeEach(() => vi.clearAllMocks());

// Supabase fake mínimo — só as tabelas que cada bloco de teste precisa.
function criarSupabaseFake(overrides: Record<string, any> = {}) {
  const chamadasRpc: any[] = [];
  const base: any = {
    chamadasRpc,
    from(tabela: string) {
      if (overrides[tabela]) return overrides[tabela];
      throw new Error(`tabela inesperada no fake: ${tabela}`);
    },
    rpc(nome: string, params: any) {
      if (nome !== 'registrar_venda') throw new Error(`rpc inesperada: ${nome}`);
      chamadasRpc.push(params);
      return Promise.resolve({ data: { id: 'venda-1' }, error: null });
    },
  };
  return base;
}

describe('buscarPreviewPedidos — custo de envio', () => {
  it('pedido de um item só: o item recebe o custo de envio inteiro', async () => {
    vi.mocked(obterConexaoAtual).mockResolvedValue({ accessToken: 'token-fake', mlUserId: '42' } as any);
    const { buscarPedidosRecentes } = await import('./mercadolivreApi.js');
    vi.mocked(buscarPedidosRecentes).mockResolvedValue([
      {
        id: 555,
        date_created: '2026-09-03T10:00:00.000Z',
        status: 'paid',
        buyer: { nickname: 'comprador1' },
        shipping: { id: 777 },
        order_items: [{ item: { id: 'MLB111', title: 'Lanterna' }, quantity: 1, unit_price: 120, sale_fee: 20 }],
      },
    ] as any);
    vi.mocked(buscarCustoEnvioVendedor).mockResolvedValue(24.45);

    const supabase = criarSupabaseFake({
      estoque_anuncios_ml: { select: () => Promise.resolve({ data: [], error: { code: '42P01' } }) },
      estoque: { select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) },
      vendas: { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) },
    });

    const pedidos = await buscarPreviewPedidos(supabase, 'token-fake', '42', 30);

    expect(buscarCustoEnvioVendedor).toHaveBeenCalledWith('token-fake', '777');
    expect(pedidos[0].itens[0].custoEnvio).toBe(24.45);
  });

  it('pedido sem frete (retirada em loja): custoEnvio fica null sem chamar a API de custos', async () => {
    vi.mocked(obterConexaoAtual).mockResolvedValue({ accessToken: 'token-fake', mlUserId: '42' } as any);
    const { buscarPedidosRecentes } = await import('./mercadolivreApi.js');
    vi.mocked(buscarPedidosRecentes).mockResolvedValue([
      {
        id: 556,
        date_created: '2026-09-03T10:00:00.000Z',
        status: 'paid',
        buyer: { nickname: 'comprador1' },
        shipping: { id: null },
        order_items: [{ item: { id: 'MLB111', title: 'Lanterna' }, quantity: 1, unit_price: 120, sale_fee: 20 }],
      },
    ] as any);

    const supabase = criarSupabaseFake({
      estoque_anuncios_ml: { select: () => Promise.resolve({ data: [], error: { code: '42P01' } }) },
      estoque: { select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) },
      vendas: { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) },
    });

    const pedidos = await buscarPreviewPedidos(supabase, 'token-fake', '42', 30);

    expect(buscarCustoEnvioVendedor).not.toHaveBeenCalled();
    expect(pedidos[0].itens[0].custoEnvio).toBe(0);
  });
});

describe('importarPedidoComoVenda — custo de envio', () => {
  it('desconta a taxa do ML E o custo de envio do valor lançado no Caixa', async () => {
    const supabase = criarSupabaseFake({
      vendas: {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      },
    });

    await importarPedidoComoVenda(supabase, {
      estoqueId: 'peca-1',
      quantidade: 1,
      valorUnitario: 750,
      formaPagamentoId: 'fp-ml',
      clienteNome: null,
      data: null,
      mlOrderId: '555',
      mlItemId: 'MLB111',
      mlShippingId: '777',
      mlSaleFee: 127.5,
      mlCustoEnvio: 24.45,
    });

    expect(supabase.chamadasRpc[0].p_valor_recebido).toBeCloseTo(598.05);
  });

  it('não registra valor cheio quando a API ainda não confirmou o custo líquido', async () => {
    const supabase = criarSupabaseFake({
      vendas: {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      },
    });

    await expect(importarPedidoComoVenda(supabase, {
      estoqueId: 'peca-1',
      quantidade: 1,
      valorUnitario: 230.73,
      formaPagamentoId: 'fp-ml',
      clienteNome: null,
      data: null,
      mlOrderId: '556',
      mlItemId: 'MLB222',
      mlShippingId: '778',
      mlSaleFee: 29,
      mlCustoEnvio: null,
    })).rejects.toThrow('valor líquido');

    expect(supabase.chamadasRpc).toHaveLength(0);
  });
});

describe('corrigirTaxaVendasMlImportadas — custo de envio', () => {
  it('não desconta taxa e frete duas vezes quando a venda antiga já foi gravada líquida', async () => {
    vi.mocked(obterConexaoAtual).mockResolvedValue({ accessToken: 'token-fake', mlUserId: '42' } as any);
    vi.mocked(buscarPedido).mockResolvedValue({
      id: 555, date_created: '', status: 'paid', shipping: { id: 777 },
      order_items: [{ item: { id: 'MLB111' }, quantity: 1, unit_price: 290.03, sale_fee: 33.85, discounts: [{ amounts: { seller: 29 } }] }],
    } as any);
    vi.mocked(buscarCustoEnvioVendedor).mockResolvedValue(25.45);
    const atualizacoesCaixa: any[] = [];
    const supabase = criarSupabaseFake({
      vendas: { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'venda-1', valor_total: 230.73, ml_order_id: '555', ml_item_id: 'MLB111' }], error: null }) }) },
      caixa: {
        select: () => ({ in: () => Promise.resolve({ data: [{ id: 'caixa-1', valor: 171.43, venda_id: 'venda-1' }], error: null }) }),
        update(payload: any) { atualizacoesCaixa.push(payload); return { eq: () => Promise.resolve({ error: null }) }; },
      },
    });
    const resultado = await corrigirTaxaVendasMlImportadas(supabase, 'token-fake');
    expect(resultado.sucesso).toBe(1);
    expect(atualizacoesCaixa[0].valor).toBeCloseTo(201.73);
  });

  it('recalcula o Caixa descontando comissão e frete rateado do pedido real', async () => {
    vi.mocked(obterConexaoAtual).mockResolvedValue({ accessToken: 'token-fake', mlUserId: '42' } as any);
    vi.mocked(buscarPedido).mockResolvedValue({
      id: 555,
      date_created: '',
      status: 'paid',
      shipping: { id: 777 },
      order_items: [{ item: { id: 'MLB111' }, quantity: 1, unit_price: 750, sale_fee: 127.5 }],
    } as any);
    vi.mocked(buscarCustoEnvioVendedor).mockResolvedValue(24.45);

    const atualizacoesCaixa: any[] = [];
    const supabase = criarSupabaseFake({
      vendas: { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'venda-1', valor_total: 750, ml_order_id: '555', ml_item_id: 'MLB111' }], error: null }) }) },
      caixa: {
        select: () => ({ in: () => Promise.resolve({ data: [{ id: 'caixa-1', valor: 750, venda_id: 'venda-1' }], error: null }) }),
        update(payload: any) {
          atualizacoesCaixa.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      },
    });

    const resultado = await corrigirTaxaVendasMlImportadas(supabase, 'token-fake');

    expect(resultado.sucesso).toBe(1);
    expect(atualizacoesCaixa[0].valor).toBeCloseTo(598.05);
  });
});
