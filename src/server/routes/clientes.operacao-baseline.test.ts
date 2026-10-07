import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientesRouter } from './clientes.js';
import { criarReq, dispatch } from './tarefasFakeSupabase';

const { gerarUrlAssinadaComprovante } = vi.hoisted(() => ({
  gerarUrlAssinadaComprovante: vi.fn(async (path: string) => `https://assinada.local/${path}`),
}));

vi.mock('../../services/storageService.js', () => ({
  gerarUrlAssinadaComprovante,
}));

function queryCom(data: any) {
  const query: any = {
    eq: () => query,
    is: () => query,
    order: () => query,
    maybeSingle: () => Promise.resolve({ data, error: null }),
    single: () => Promise.resolve({ data, error: null }),
    then: (resolve: any, reject: any) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return query;
}

describe('clientesRouter — contratos anteriores ao centro operacional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /:id preserva notas, motos, peças procuradas e comprovantes PIX', async () => {
    const cliente = {
      id: 'cliente-1',
      nome: 'Ana Souza',
      cidade: 'Campina Grande',
      estado: 'PB',
      notas: [{ id: 'nota-1', texto: 'Prefere contato à tarde' }],
      motos: [{ id: 'moto-1', modelo_moto: { id: 'modelo-1', nome: 'CG 160', ano: 2022 } }],
      pecas_procuradas: [{ id: 'procura-1', descricao: 'Farol', status: 'aguardando' }],
    };
    const comprovantes = [
      {
        id: 'pix-1',
        storage_path: 'cliente-1/pix-1.jpg',
        venda: { id: 'venda-1', nome_item: 'Farol', data: '2026-09-30' },
      },
    ];
    const supabase = {
      from(tabela: string) {
        if (tabela === 'clientes') return { select: () => queryCom(cliente) };
        if (tabela === 'comprovantes_pix') return { select: () => queryCom(comprovantes) };
        throw new Error(`Tabela inesperada: ${tabela}`);
      },
    };

    const res = await dispatch(
      clientesRouter(supabase as any),
      criarReq({ method: 'GET', url: '/cliente-1', params: { id: 'cliente-1' } })
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      cidade: 'Campina Grande',
      estado: 'PB',
      notas: cliente.notas,
      motos: cliente.motos,
      pecas_procuradas: cliente.pecas_procuradas,
      comprovantes_pix: [
        expect.objectContaining({
          id: 'pix-1',
          url: 'https://assinada.local/cliente-1/pix-1.jpg',
        }),
      ],
    });
    expect(gerarUrlAssinadaComprovante).toHaveBeenCalledWith('cliente-1/pix-1.jpg');
  });

  it('POST / continua aceitando o cadastro legado sem telefone, cidade ou estado', async () => {
    let payloadInserido: any = null;
    const supabase = {
      from(tabela: string) {
        if (tabela !== 'clientes') throw new Error(`Tabela inesperada: ${tabela}`);
        return {
          insert(payload: any) {
            payloadInserido = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'cliente-2', ...payload }, error: null }),
              }),
            };
          },
        };
      },
    };

    const res = await dispatch(
      clientesRouter(supabase as any),
      criarReq({ method: 'POST', url: '/', body: { nome: '  Cliente legado  ' } })
    );

    expect(res.statusCode).toBe(200);
    expect(payloadInserido).toMatchObject({
      nome: 'Cliente legado',
      telefone: null,
      cidade: null,
      estado: null,
    });
  });

  it('GET / não inclui endereço residencial completo na listagem geral', async () => {
    let colunas = '';
    const supabase = {
      from(tabela: string) {
        if (tabela !== 'clientes') throw new Error(`Tabela inesperada: ${tabela}`);
        return {
          select(selecao: string) {
            colunas = selecao;
            return queryCom([]);
          },
        };
      },
    };

    const res = await dispatch(clientesRouter(supabase as any), criarReq({ method: 'GET', url: '/' }));

    expect(res.statusCode).toBe(200);
    expect(colunas).not.toBe('*');
    expect(colunas).not.toMatch(/cep|logradouro|numero|complemento|bairro/);
  });

  it('PATCH legado de pedido usa a RPC transacional em vez de update direto', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'pedido-1', status: 'cancelada' }, error: null });
    const supabase = { from: vi.fn(), rpc };

    const res = await dispatch(
      clientesRouter(supabase as any),
      criarReq({
        method: 'PATCH',
        url: '/cliente-1/pecas-procuradas/pedido-1',
        params: { id: 'cliente-1', pedidoId: 'pedido-1' },
        body: { status: 'cancelada', motivo: 'Cliente desistiu' },
      })
    );

    expect(res.statusCode).toBe(200);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('transicionar_pedido_busca', expect.objectContaining({
      p_pedido_id: 'pedido-1',
      p_novo_status: 'cancelada',
      p_motivo: 'Cliente desistiu',
    }));
  });

  it('nega bloqueio/desativação para atendente com apenas clientes.editar', async () => {
    const supabase = { from: vi.fn() };
    const res = await dispatch(
      clientesRouter(supabase as any),
      criarReq({
        method: 'PATCH',
        url: '/cliente-1',
        params: { id: 'cliente-1' },
        body: { banido: true },
        usuario: { id: 'u1', roles: [], permissoes: { clientes: { ver: true, editar: true } } },
      })
    );

    expect(res.statusCode).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('permite bloqueio/desativação com clientes.administrar', async () => {
    let payloadAtualizado: any = null;
    const supabase = {
      from(tabela: string) {
        if (tabela !== 'clientes') throw new Error(`Tabela inesperada: ${tabela}`);
        return {
          update(payload: any) {
            payloadAtualizado = payload;
            const query: any = {
              eq: () => query,
              select: () => query,
              maybeSingle: () => Promise.resolve({ data: { id: 'cliente-1', ...payload }, error: null }),
            };
            return query;
          },
        };
      },
    };
    const res = await dispatch(
      clientesRouter(supabase as any),
      criarReq({
        method: 'PATCH',
        url: '/cliente-1',
        params: { id: 'cliente-1' },
        body: { banido: true, ativo: false },
        usuario: { id: 'u1', roles: [], permissoes: { clientes: { ver: true, administrar: true } } },
      })
    );

    expect(res.statusCode).toBe(200);
    expect(payloadAtualizado).toEqual({ ativo: false, banido: true });
  });

  it('rejeita strings em campos administrativos booleanos', async () => {
    const supabase = { from: vi.fn() };
    const res = await dispatch(
      clientesRouter(supabase as any),
      criarReq({
        method: 'PATCH',
        url: '/cliente-1',
        params: { id: 'cliente-1' },
        body: { banido: 'false' },
        usuario: { id: 'u1', roles: [], permissoes: { clientes: { ver: true, administrar: true } } },
      })
    );

    expect(res.statusCode).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('DELETE legado cancela por RPC e preserva o histórico do pedido', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'pedido-1', status: 'cancelada' }, error: null });
    const supabase = { from: vi.fn(), rpc };
    const res = await dispatch(
      clientesRouter(supabase as any),
      criarReq({
        method: 'DELETE',
        url: '/cliente-1/pecas-procuradas/pedido-1',
        params: { id: 'cliente-1', pedidoId: 'pedido-1' },
      })
    );

    expect(res.statusCode).toBe(200);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('registrar_acao_pedido', expect.objectContaining({ p_acao: 'cancelar' }));
  });
});
