import { beforeEach, describe, expect, it, vi } from 'vitest';

const chamadas = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  api: chamadas,
}));

import { clientesApi } from './api';

describe('clientesApi operacional', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializa filtros da lista sem enviar valores vazios', async () => {
    chamadas.get.mockResolvedValue({ success: true, data: { itens: [], proximo_cursor: null } });

    await clientesApi.listarOperacao({ limit: 25, cidade: 'Campina Grande', ativo: false, busca: '' });

    expect(chamadas.get).toHaveBeenCalledWith('/api/clientes/operacao/clientes?limit=25&cidade=Campina+Grande&ativo=false');
  });

  it('usa os contratos operacionais para registrar e agir sobre pedidos', async () => {
    chamadas.post.mockResolvedValue({ success: true, data: {} });
    chamadas.patch.mockResolvedValue({ success: true, data: {} });
    const payload = {
      cliente: {
        nome: 'Ana',
        telefone: '83999999999',
        preferencia_contato: 'whatsapp' as const,
        origem: 'balcao' as const,
        cidade: 'Campina Grande',
        estado: 'PB',
      },
      pedido: { descricao: 'Farol', moto_modelo_texto: 'CG 160', idempotency_key: 'pedido-123' },
    };

    await clientesApi.registrarPedido(payload);
    await clientesApi.agirSobrePedido('pedido-1', 'cliente_avisado');
    await clientesApi.transicionarPedido('pedido-1', 'em_busca', 'Retomar busca');

    expect(chamadas.post).toHaveBeenNthCalledWith(1, '/api/clientes/operacao/pedidos', payload);
    expect(chamadas.post).toHaveBeenNthCalledWith(2, '/api/clientes/operacao/pedidos/pedido-1/acao', {
      acao: 'cliente_avisado',
      motivo: undefined,
    });
    expect(chamadas.patch).toHaveBeenCalledWith('/api/clientes/operacao/pedidos/pedido-1/status', {
      status: 'em_busca',
      motivo: 'Retomar busca',
      venda_id: undefined,
    });
  });
});
