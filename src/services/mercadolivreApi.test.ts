import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

import axios from 'axios';
import { buscarPedido, buscarCustoEnvioVendedor, buscarEnvio, calcularValorRecebido, calcularDescontoVendedor, alocarCustoEnvio, resolverNomeComprador } from './mercadolivreApi.js';

beforeEach(() => vi.clearAllMocks());

describe('buscarPedido', () => {
  it('busca o pedido por id e devolve o corpo da resposta', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { id: 123, status: 'paid', order_items: [] } });

    const pedido = await buscarPedido('token-fake', '123');

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/orders/123'), {
      headers: { Authorization: 'Bearer token-fake' },
    });
    expect(pedido).toEqual({ id: 123, status: 'paid', order_items: [] });
  });

  it('devolve null quando o pedido não existe mais (404), em vez de lançar', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 404 } });

    await expect(buscarPedido('token-fake', '999')).resolves.toBeNull();
  });

  it('propaga erro que não é 404 — token expirado precisa estourar', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });

    await expect(buscarPedido('token-fake', '123')).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('buscarEnvio — receiverName', () => {
  it('extrai receiver_name do formato legado (receiver_address.receiver_name)', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { id: 42, status: 'delivered', substatus: null, tracking_number: 'BR123', receiver_address: { receiver_name: 'Cauê Garcia', contact: {} } },
    });
    const envio = await buscarEnvio('token-fake', '42');
    expect(envio.receiverName).toBe('Cauê Garcia');
  });

  it('extrai nome do formato novo (receiver_address.contact.fname + lname) quando receiver_name está vazio', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { id: 42, status: 'delivered', substatus: null, tracking_number: 'BR123', receiver_address: { receiver_name: '', contact: { fname: 'Cauê', lname: 'Garcia' } } },
    });
    const envio = await buscarEnvio('token-fake', '42');
    expect(envio.receiverName).toBe('Cauê Garcia');
  });

  it('prefere receiver_name quando ambos existem', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { id: 42, status: 'delivered', substatus: null, tracking_number: null, receiver_address: { receiver_name: 'Nome Antigo', contact: { fname: 'Nome', lname: 'Novo' } } },
    });
    const envio = await buscarEnvio('token-fake', '42');
    expect(envio.receiverName).toBe('Nome Antigo');
  });

  it('devolve null quando nenhum campo de nome existe', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { id: 42, status: 'pending', substatus: null, tracking_number: null, receiver_address: {} },
    });
    const envio = await buscarEnvio('token-fake', '42');
    expect(envio.receiverName).toBeNull();
  });
});

// Confirmado via API real (pedido 2000018236472830, 03/09/2026): GET
// /shipments/{id}/costs.senders[].cost é o valor que sai do bolso do
// vendedor (24.45 no exemplo real, com desconto "mandatory" de 50% já
// aplicado) — nem payments[].shipping_cost (veio 0) nem shipping_option de
// GET /shipments/{id} (ausente na resposta) são confiáveis pra isso.
describe('buscarCustoEnvioVendedor', () => {
  it('soma o custo de todos os senders do envio', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { senders: [{ cost: 24.45 }], receiver: { cost: 48.99 } } });

    const custo = await buscarCustoEnvioVendedor('token-fake', '777');

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/shipments/777/costs'), {
      headers: { Authorization: 'Bearer token-fake', 'x-format-new': 'true' },
    });
    expect(custo).toBe(24.45);
  });

  it('devolve null quando a API não devolve nenhum sender (envio ainda não gerado)', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { senders: [], receiver: { cost: 0 } } });

    await expect(buscarCustoEnvioVendedor('token-fake', '777')).resolves.toBeNull();
  });

  it('devolve null quando o recurso não existe (404), em vez de lançar', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 404 } });

    await expect(buscarCustoEnvioVendedor('token-fake', '777')).resolves.toBeNull();
  });

  it('propaga erro que não é 404', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });

    await expect(buscarCustoEnvioVendedor('token-fake', '777')).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('calcularValorRecebido', () => {
  it('desconta a parcela de campanha financiada pelo vendedor', () => {
    expect(calcularDescontoVendedor({ discounts: [{ amounts: { seller: 20 } }, { amounts: { seller: 9 } }] } as any)).toBe(29);
    expect(calcularValorRecebido(290.03, 33.85, 25.45, 29)).toBe(201.73);
  });
  it('desconta comissão e frete do valor total', () => {
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
});

describe('alocarCustoEnvio', () => {
  const pedidoDoisItens = {
    id: 1,
    date_created: '',
    status: 'paid',
    order_items: [
      { item: { id: 'MLB111' }, quantity: 1, unit_price: 300 },
      { item: { id: 'MLB222' }, quantity: 1, unit_price: 100 },
    ],
  } as any;

  it('rateia o custo total do envio proporcional ao valor de cada item do pedido', () => {
    // MLB111 é 75% do total (300/400) do pedido -> fica com 75% dos 20 do frete.
    expect(alocarCustoEnvio(pedidoDoisItens, 20, 'MLB111')).toBeCloseTo(15);
    expect(alocarCustoEnvio(pedidoDoisItens, 20, 'MLB222')).toBeCloseTo(5);
  });

  it('pedido de um item só recebe o custo de envio inteiro', () => {
    const pedido = { id: 2, date_created: '', status: 'paid', order_items: [{ item: { id: 'MLB111' }, quantity: 1, unit_price: 120 }] } as any;

    expect(alocarCustoEnvio(pedido, 24.45, 'MLB111')).toBe(24.45);
  });

  it('item que não está no pedido não recebe rateio', () => {
    expect(alocarCustoEnvio(pedidoDoisItens, 20, 'MLB999')).toBe(0);
  });
});

describe('resolverNomeComprador', () => {
  it('retorna nome completo quando first_name e last_name estão presentes', () => {
    const buyer = { first_name: 'Cauê', last_name: 'Garcia', nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer)).toBe('Cauê Garcia');
  });

  it('retorna nome apenas com first_name quando last_name está ausente', () => {
    const buyer = { first_name: 'Cauê', last_name: undefined, nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer)).toBe('Cauê');
  });

  it('retorna nome apenas com last_name quando first_name está ausente', () => {
    const buyer = { first_name: undefined, last_name: 'Garcia', nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer)).toBe('Garcia');
  });

  it('usa nome do destinatário quando buyer não tem nome real mas receiverName tem (cenário ML real)', () => {
    // Confirmado via API real (pedido 2000018236472830, verificado em 03/09/2026):
    // buyer.first_name e buyer.last_name vêm vazios; receiver_address.receiver_name
    // tem o nome real do comprador. Esse teste simula esse cenário.
    const buyer = { first_name: undefined, last_name: undefined, nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer, 'Cauê Garcia')).toBe('Cauê Garcia');
  });

  it('prioriza nome do buyer sobre receiverName quando ambos estão presentes', () => {
    const buyer = { first_name: 'João', last_name: 'Silva', nickname: 'JOAO123', id: 456 };
    expect(resolverNomeComprador(buyer, 'Outro Nome')).toBe('João Silva');
  });

  it('cai para nickname quando receiverName é vazio/undefined', () => {
    const buyer = { first_name: undefined, last_name: undefined, nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer, undefined)).toBe('GACA1676424');
  });

  it('cai para nickname quando não há primeiro nem último nome', () => {
    const buyer = { first_name: undefined, last_name: undefined, nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer)).toBe('GACA1676424');
  });

  it('retorna null quando não há nenhum dado de nome', () => {
    const buyer = { first_name: undefined, last_name: undefined, nickname: undefined, id: 123 };
    expect(resolverNomeComprador(buyer)).toBeNull();
  });

  it('trata como undefined strings vazias', () => {
    const buyer = { first_name: '', last_name: '', nickname: '', id: 123 };
    expect(resolverNomeComprador(buyer)).toBeNull();
  });

  it('ignora espaços em branco extras', () => {
    const buyer = { first_name: ' Cauê ', last_name: ' Garcia ', nickname: 'GACA1676424', id: 123 };
    expect(resolverNomeComprador(buyer)).toBe('Cauê Garcia');
  });

  it('retorna null quando buyer é undefined', () => {
    expect(resolverNomeComprador(undefined)).toBeNull();
  });

  it('retorna null quando buyer é null', () => {
    expect(resolverNomeComprador(null)).toBeNull();
  });
});
