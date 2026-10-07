// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const apiMocks = vi.hoisted(() => ({ resumoOperacional: vi.fn(), listarOperacao: vi.fn(), listar: vi.fn() }));
vi.mock('./api', () => ({ clientesApi: apiMocks }));

import { useClientesOperacao } from './useClientesOperacao';

const resumo = (base: boolean) => ({
  success: true,
  data: {
    total_clientes: 0, pedidos_por_status: {}, pendencias_por_idade: { ate_2_dias: 0, de_3_a_7_dias: 0, mais_de_7_dias: 0 },
    respostas_acima_48h: 0, reservas_sem_decisao: 0, visitas_vencidas: 0, decisoes_duplicidade: 0,
    capabilities: { base, visitas: false, reservas: false, matches: false }, visitas: [], reservas: [], matches: [],
  },
});

describe('useClientesOperacao', () => {
  afterEach(cleanup);

  it('mantém o cadastro acessível quando a capability operacional ainda não está aplicada', async () => {
    apiMocks.resumoOperacional.mockResolvedValue(resumo(false));
    apiMocks.listar.mockResolvedValue({ success: true, data: [{ id: 'cliente-1', nome: 'Ana Souza', telefone: null, instagram_usuario: null, preferencia_contato: null, origem: null, cidade: null, estado: null, ativo: true, banido: false, criado_em: '2026-10-01T12:00:00.000Z', atualizado_em: '2026-10-01T12:00:00.000Z' }] });
    const { result } = renderHook(() => useClientesOperacao());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.capabilityUnavailable).toBe(true);
    expect(result.current.itens).toHaveLength(1);
    expect(apiMocks.listarOperacao).not.toHaveBeenCalled();
    expect(apiMocks.listar).toHaveBeenCalledWith(true);
  });

  it('carrega resumo e primeira página quando a capability está disponível', async () => {
    apiMocks.resumoOperacional.mockResolvedValue(resumo(true));
    apiMocks.listarOperacao.mockResolvedValue({ success: true, data: { itens: [{ id: 'cliente-1' }], proximo_cursor: null } });
    const { result } = renderHook(() => useClientesOperacao());
    await waitFor(() => expect(result.current.itens).toHaveLength(1));
    expect(apiMocks.listarOperacao).toHaveBeenCalledWith({ limit: 50 });
  });

  it('mantém a lista disponível quando apenas o resumo operacional falha', async () => {
    apiMocks.resumoOperacional.mockResolvedValue({ success: false, error: 'Resumo indisponível' });
    apiMocks.listarOperacao.mockResolvedValue({ success: true, data: { itens: [{ id: 'cliente-1' }], proximo_cursor: null } });

    const { result } = renderHook(() => useClientesOperacao());

    await waitFor(() => expect(result.current.itens).toHaveLength(1));
    expect(result.current.resumo).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('anexa a próxima página sem substituir os clientes já carregados', async () => {
    apiMocks.resumoOperacional.mockResolvedValue(resumo(true));
    apiMocks.listarOperacao
      .mockResolvedValueOnce({ success: true, data: { itens: [{ id: 'cliente-1' }], proximo_cursor: 'cursor-1' } })
      .mockResolvedValueOnce({ success: true, data: { itens: [{ id: 'cliente-2' }], proximo_cursor: null } });

    const { result } = renderHook(() => useClientesOperacao());
    await waitFor(() => expect(result.current.itens).toHaveLength(1));

    await act(async () => { await result.current.loadMore(); });

    expect(result.current.itens.map((item) => item.id)).toEqual(['cliente-1', 'cliente-2']);
    expect(apiMocks.listarOperacao).toHaveBeenLastCalledWith({ limit: 50, cursor: 'cursor-1' });
  });
});
