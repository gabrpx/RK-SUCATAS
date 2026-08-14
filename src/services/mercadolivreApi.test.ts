import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

import axios from 'axios';
import { buscarPedido } from './mercadolivreApi.js';

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
