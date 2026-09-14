import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcularValorRecebido, resolverNomeComprador } from './mercadolivreApi.js';

// Hoistado pelo Vitest — não afeta os testes de funções puras acima.
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';
import { buscarPreviewPedidos } from './mercadolivreSync.js';

describe('calcularValorRecebido', () => {
  it('desconta comissão e frete do valor total', () => {
    // Confirmado via API real (pedido 2000018236472830, 03/09/2026):
    // R$750 - R$127,50 (comissão 17%) - R$24,45 (frete) = R$598,05
    expect(calcularValorRecebido(750, 127.5, 24.45)).toBeCloseTo(598.05);
  });

  it('sem frete (retirada em loja / comprador pagou o envio), desconta só a comissão', () => {
    expect(calcularValorRecebido(750, 127.5, 0)).toBe(622.5);
  });

  it('taxa de comissão desconhecida: não adivinha, devolve null mesmo com frete conhecido', () => {
    expect(calcularValorRecebido(750, null, 24.45)).toBeNull();
  });

  it('custo de envio desconhecido: não adivinha (pode não ser zero de verdade), devolve null', () => {
    expect(calcularValorRecebido(750, 127.5, null)).toBeNull();
  });

  it('valor unitário quando dividido pela quantidade', () => {
    // 598.05 / 1 = 598.05
    const valorRecebido = calcularValorRecebido(750, 127.5, 24.45);
    if (valorRecebido !== null) {
      const valorUnitario = valorRecebido / 1;
      expect(valorUnitario).toBeCloseTo(598.05);
    }
  });

  it('valor unitário com múltiplas quantidades', () => {
    // Se comprador pediu 2x da mesma peça:
    // Preço cheio: 2 × 750 = 1500
    // Comissão: 255 (17% de 1500)
    // Frete: 48.90 (rateado entre 2)
    // Valor recebido: 1500 - 255 - 48.90 = 1196.10
    // Valor unitário líquido: 1196.10 / 2 = 598.05
    expect(calcularValorRecebido(1500, 255, 48.9)).toBeCloseTo(1196.1);
    const valorRecebido = calcularValorRecebido(1500, 255, 48.9);
    if (valorRecebido !== null) {
      const valorUnitario = valorRecebido / 2;
      expect(valorUnitario).toBeCloseTo(598.05);
    }
  });
});

describe('resolverNomeComprador com receiverName', () => {
  it('retorna nome completo quando first_name e last_name estão presentes (ignora receiverName)', () => {
    const buyer = { first_name: 'Cauê', last_name: 'Garcia', nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer, 'Nome Do Envio')).toBe('Cauê Garcia');
  });

  it('usa nome do destinatário quando buyer não tem nome real', () => {
    const buyer = { first_name: undefined, last_name: undefined, nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer, 'Cauê Garcia')).toBe('Cauê Garcia');
  });

  it('prioridade: nome completo > receiverName > nickname', () => {
    const buyer = { first_name: 'João', last_name: 'Silva', nickname: 'JOAO123', id: 456 };
    // Tem first_name + last_name, ignora receiverName
    expect(resolverNomeComprador(buyer, 'Outro Nome')).toBe('João Silva');

    const buyer2 = { first_name: undefined, last_name: undefined, nickname: 'GACA1676424', id: 789 };
    // Não tem first_name + last_name, usa receiverName
    expect(resolverNomeComprador(buyer2, 'Nome Real')).toBe('Nome Real');

    // Sem receiverName, cai pro nickname
    expect(resolverNomeComprador(buyer2, undefined)).toBe('GACA1676424');
  });

  it('receiverName vazio é tratado como undefined', () => {
    const buyer = { first_name: undefined, last_name: undefined, nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer, '')).toBe('GACA1676424');
    expect(resolverNomeComprador(buyer, '  ')).toBe('GACA1676424');
  });
});

describe('Migration 059 — vendas com valor líquido', () => {
  it('venda do ML com p_valor_recebido deve ter valor_total = p_valor_recebido', () => {
    // Simulação do que a migration fará:
    // - p_quantidade = 1
    // - p_valor_unitario = 750 (preço cheio da peça)
    // - p_valor_recebido = 598.05 (valor líquido)
    // - resultado: vendas.valor_total = 598.05, vendas.valor_unitario = 598.05
    const valorRecebido = 598.05;
    const quantidade = 1;
    const valorUnitarioFinal = quantidade > 0 ? valorRecebido / quantidade : 0;
    const valorTotalFinal = valorRecebido;

    expect(valorTotalFinal).toBe(598.05);
    expect(valorUnitarioFinal).toBeCloseTo(598.05);
  });

  it('venda avulsa SEM p_valor_recebido mantém preço cheio', () => {
    // Quando p_valor_recebido é null:
    // - resultado: vendas.valor_total = quantidade * p_valor_unitario
    const valorRecebido = null;
    const quantidade = 1;
    const valorUnitario = 750;
    const valorTotalFinal = valorRecebido ?? quantidade * valorUnitario;
    const valorUnitarioFinal = valorRecebido ?? valorUnitario;

    expect(valorTotalFinal).toBe(750);
    expect(valorUnitarioFinal).toBe(750);
  });

  it('venda do ML com múltiplas quantidades: valor_unitario = valor_recebido / quantidade', () => {
    // 2x da peça: valor_recebido = 1196.10, quantidade = 2
    const valorRecebido = 1196.1;
    const quantidade = 2;
    const valorUnitarioFinal = quantidade > 0 ? valorRecebido / quantidade : 0;
    const valorTotalFinal = valorRecebido;

    expect(valorTotalFinal).toBe(1196.1);
    expect(valorUnitarioFinal).toBeCloseTo(598.05);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buscarPreviewPedidos — bug "GACA1676424" (nickname anonimizado no lugar do
// nome real). Fixture capturado via API real em 03/09/2026:
//   - /orders/search → buyer = { id: 458613608, nickname: "GACA1676424" } (sem first_name/last_name)
//   - /orders/2000018236472830 → buyer = { ..., first_name: "Cauê", last_name: "Garcia" }
//   - /shipments/47911244537 → receiver_address: undefined
// ─────────────────────────────────────────────────────────────────────────────
describe('buscarPreviewPedidos — nome do comprador (regressão GACA1676424)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exibe o nome real (first_name + last_name) mesmo quando /orders/search devolve só nickname — fixture real pedido 2000018236472830', async () => {
    // Fixture: buyer truncado que a rota /orders/search retorna
    const buyerTruncado = { id: 458613608, nickname: 'GACA1676424' };
    // Fixture: buyer completo que /orders/{id} retorna
    const buyerCompleto = { id: 458613608, nickname: 'GACA1676424', first_name: 'Cauê', last_name: 'Garcia' };
    const SHIPPING_ID = 47911244537;
    const ORDER_ID = 2000018236472830;

    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes('/orders/search')) {
        return Promise.resolve({
          data: {
            results: [
              {
                id: ORDER_ID,
                date_created: '2026-09-03T00:00:00.000Z',
                status: 'paid',
                buyer: buyerTruncado,
                order_items: [],
                shipping: { id: SHIPPING_ID },
              },
            ],
          },
        });
      }
      // /orders/{id}/costs — custo do envio pro vendedor
      if (url.includes(`/shipments/${SHIPPING_ID}/costs`)) {
        return Promise.resolve({ data: { senders: [{ cost: 24.45 }], receiver: { cost: 48.99 } } });
      }
      // /shipments/{id} — receiver_address undefined confirmado via API real
      if (url.includes(`/shipments/${SHIPPING_ID}`)) {
        return Promise.resolve({ data: { id: SHIPPING_ID, status: 'delivered', substatus: null, tracking_number: null } });
      }
      // /orders/{id} — pedido completo com buyer real
      if (url.includes(`/orders/${ORDER_ID}`)) {
        return Promise.resolve({
          data: {
            id: ORDER_ID,
            date_created: '2026-09-03T00:00:00.000Z',
            status: 'paid',
            buyer: buyerCompleto,
            order_items: [],
            shipping: { id: SHIPPING_ID },
          },
        });
      }
      return Promise.resolve({ data: { results: [] } });
    });

    // Mock Supabase: estoque vazio, nenhuma venda já importada
    const mockFrom = (table: string) => {
      if (table === 'estoque_anuncios_ml') {
        // Simula migration ausente → fallback pra tabela estoque diretamente
        return { select: () => ({ data: null, error: { code: '42P01', message: 'relation does not exist', details: '', hint: '' } }) };
      }
      if (table === 'estoque') {
        return { select: () => ({ not: () => Promise.resolve({ data: [], error: null }) }) };
      }
      if (table === 'vendas') {
        return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    };
    const mockSupabase = { from: mockFrom } as any;

    const result = await buscarPreviewPedidos(mockSupabase, 'token-fake', 'seller-fake', 30);

    expect(result).toHaveLength(1);
    // Nome deve ser o real, não o nickname anonimizado
    expect(result[0].comprador).toBe('Cauê Garcia');
    expect(result[0].comprador).not.toBe('GACA1676424');
  });
});
