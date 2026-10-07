import { describe, expect, it, vi } from 'vitest';
import { clientesOperacaoRouter } from './clientesOperacao';
import { criarReq, dispatch } from '../tarefasFakeSupabase';

interface Chamada {
  tabela?: string;
  operacao: string;
  colunas?: string;
  payload?: unknown;
  filtros: Array<{ tipo: string; campo?: string; valor: unknown }>;
  opcoes?: unknown;
  rpc?: string;
}

function criarSupabaseFake(
  responder: (chamada: Chamada) => { data?: unknown; error?: unknown; count?: number | null }
) {
  const chamadas: Chamada[] = [];

  const criarQuery = (tabela: string, operacao = 'select', payload?: unknown) => {
    const chamada: Chamada = { tabela, operacao, payload, filtros: [] };
    let finalizada = false;
    const finalizar = () => {
      if (!finalizada) {
        chamadas.push(chamada);
        finalizada = true;
      }
      return Promise.resolve({ data: null, error: null, ...responder(chamada) });
    };
    const query: any = {
      select(colunas: string, opcoes?: unknown) {
        chamada.colunas = colunas;
        chamada.opcoes = opcoes;
        return query;
      },
      eq(campo: string, valor: unknown) {
        chamada.filtros.push({ tipo: 'eq', campo, valor });
        return query;
      },
      ilike(campo: string, valor: unknown) {
        chamada.filtros.push({ tipo: 'ilike', campo, valor });
        return query;
      },
      in(campo: string, valor: unknown) {
        chamada.filtros.push({ tipo: 'in', campo, valor });
        return query;
      },
      is(campo: string, valor: unknown) {
        chamada.filtros.push({ tipo: 'is', campo, valor });
        return query;
      },
      not(campo: string, operador: string, valor: unknown) {
        chamada.filtros.push({ tipo: `not:${operador}`, campo, valor });
        return query;
      },
      or(valor: unknown) {
        chamada.filtros.push({ tipo: 'or', valor });
        return query;
      },
      order(campo: string, valor: unknown) {
        chamada.filtros.push({ tipo: 'order', campo, valor });
        return query;
      },
      limit(valor: unknown) {
        chamada.filtros.push({ tipo: 'limit', valor });
        return query;
      },
      lte(campo: string, valor: unknown) {
        chamada.filtros.push({ tipo: 'lte', campo, valor });
        return query;
      },
      lt(campo: string, valor: unknown) {
        chamada.filtros.push({ tipo: 'lt', campo, valor });
        return query;
      },
      single: finalizar,
      maybeSingle: finalizar,
      then(resolve: any, reject: any) {
        return finalizar().then(resolve, reject);
      },
    };
    return query;
  };

  return {
    _chamadas: chamadas,
    from(tabela: string) {
      return {
        select(colunas: string, opcoes?: unknown) {
          return criarQuery(tabela).select(colunas, opcoes);
        },
        insert(payload: unknown) {
          return criarQuery(tabela, 'insert', payload);
        },
        update(payload: unknown) {
          return criarQuery(tabela, 'update', payload);
        },
      };
    },
    rpc(nome: string, payload: unknown) {
      const chamada: Chamada = { operacao: 'rpc', rpc: nome, payload, filtros: [] };
      chamadas.push(chamada);
      return Promise.resolve({ data: null, error: null, ...responder(chamada) });
    },
  };
}

const clienteValido = {
  nome: 'Ana Souza',
  telefone: '(83) 9 9999-9999',
  instagram_usuario: '',
  preferencia_contato: 'whatsapp',
  origem: 'balcao',
  cidade: 'Campina Grande',
  estado: 'PB',
};

const pedidoValido = {
  descricao: 'Farol',
  moto_modelo_texto: 'CG 160',
  responsavel_id: '11111111-1111-4111-8111-111111111111',
  idempotency_key: 'pedido-operacao-001',
};
const PEDIDO_ID = '33333333-3333-4333-8333-333333333333';

describe('clientesOperacaoRouter', () => {
  it('procura duplicidades por telefone normalizado, Instagram e nome sem gravar nada', async () => {
    const supabase = criarSupabaseFake((chamada) => {
      const filtro = chamada.filtros.find((item) => ['eq', 'ilike'].includes(item.tipo));
      if (filtro?.campo === 'telefone') {
        return { data: [{ id: 'c1', nome: 'Ana Souza', telefone: '83999999999', instagram_usuario: 'ana.motos', cidade: 'Campina Grande', estado: 'PB' }] };
      }
      if (filtro?.campo === 'instagram_usuario') {
        return { data: [{ id: 'c1', nome: 'Ana Souza', telefone: '83999999999', instagram_usuario: 'ana.motos', cidade: 'Campina Grande', estado: 'PB' }] };
      }
      return { data: [{ id: 'c2', nome: 'Ana Sousa', telefone: null, instagram_usuario: 'outra', cidade: 'João Pessoa', estado: 'PB' }] };
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({ method: 'POST', url: '/duplicidades', body: { nome: 'Ana Sou', telefone: '(83) 9 9999-9999', instagram_usuario: '@ANA.MOTOS' } })
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: 'c1', criterios: ['whatsapp', 'instagram'] }),
      expect.objectContaining({ id: 'c2', criterios: ['nome'] }),
    ]);
    expect(supabase._chamadas.every((chamada) => chamada.operacao === 'select')).toBe(true);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('registra cliente novo e pedido em uma única RPC atômica', async () => {
    const retorno = { cliente: { id: 'c1', nome: 'Ana Souza' }, pedido: { id: 'p1', status: 'nova' } };
    const supabase = criarSupabaseFake((chamada) => chamada.rpc === 'registrar_cliente_com_pedido' ? { data: retorno } : {});

    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({ method: 'POST', url: '/pedidos', body: { cliente: clienteValido, pedido: pedidoValido } })
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual(retorno);
    expect(supabase._chamadas).toHaveLength(1);
    expect(supabase._chamadas[0]).toMatchObject({ operacao: 'rpc', rpc: 'registrar_cliente_com_pedido' });
  });

  it('registra pedido para cliente existente pela mesma RPC', async () => {
    const supabase = criarSupabaseFake((chamada) => chamada.rpc === 'registrar_cliente_com_pedido'
      ? { data: { cliente: { id: '11111111-1111-4111-8111-111111111112' }, pedido: { id: 'p2', status: 'nova' } } }
      : {});
    const cliente = { ...clienteValido, id: '11111111-1111-4111-8111-111111111112' };

    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({ method: 'POST', url: '/pedidos', body: { cliente, pedido: pedidoValido } })
    );

    expect(res.statusCode).toBe(200);
    expect(supabase._chamadas[0].payload).toMatchObject({ p_cliente: expect.objectContaining({ id: cliente.id }) });
  });

  it('mantém pedidos no nome esperado pela ficha de cliente', async () => {
    const clienteId = '11111111-1111-4111-8111-111111111112';
    const supabase = criarSupabaseFake((chamada) => {
      if (chamada.tabela === 'clientes') return { data: { id: clienteId, nome: 'Ana', pecas_procuradas: [{ id: 'pedido-1' }] } };
      return { data: [] };
    });

    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({ method: 'GET', url: `/clientes/${clienteId}` })
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.data.pecas_procuradas).toEqual([{ id: 'pedido-1' }]);
    const colunas = supabase._chamadas.find((chamada) => chamada.tabela === 'clientes')?.colunas;
    expect(colunas).toContain('pecas_procuradas:pecas_procuradas');
    expect(colunas).toContain('comprovantes_pix:comprovantes_pix');
  });

  it('não permite que clientes.criar altere um cliente existente', async () => {
    const supabase = criarSupabaseFake(() => ({}));
    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({
        method: 'POST',
        url: '/pedidos',
        body: { cliente: { ...clienteValido, id: '11111111-1111-4111-8111-111111111112' }, pedido: pedidoValido },
        usuario: { id: '11111111-1111-4111-8111-111111111111', roles: [], permissoes: { clientes: { ver: true, criar: true } } },
      })
    );
    expect(res.statusCode).toBe(403);
    expect(supabase._chamadas).toHaveLength(0);
  });

  it('não permite que clientes.editar crie um cliente novo', async () => {
    const supabase = criarSupabaseFake(() => ({}));
    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({
        method: 'POST',
        url: '/pedidos',
        body: { cliente: clienteValido, pedido: pedidoValido },
        usuario: { id: '11111111-1111-4111-8111-111111111111', roles: [], permissoes: { clientes: { ver: true, editar: true } } },
      })
    );
    expect(res.statusCode).toBe(403);
    expect(supabase._chamadas).toHaveLength(0);
  });

  it('não reporta sucesso parcial quando a RPC falha', async () => {
    const supabase = criarSupabaseFake((chamada) => chamada.rpc === 'registrar_cliente_com_pedido'
      ? { error: { code: 'P0001', message: 'falha interna detalhada' } }
      : {});
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({ method: 'POST', url: '/pedidos', body: { cliente: clienteValido, pedido: pedidoValido } })
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Não foi possível registrar o pedido' });
    expect(supabase._chamadas).toHaveLength(1);
    consoleSpy.mockRestore();
  });

  it('resumo usa quantidade fixa de consultas e degrada somente módulos futuros ausentes', async () => {
    const supabase = criarSupabaseFake((chamada) => {
      if (chamada.tabela === 'clientes') return { count: 12, data: [] };
      if (chamada.tabela === 'pecas_procuradas') return { data: [{ id: 'p1', status: 'em_busca', criado_em: '2026-09-20T12:00:00Z', proxima_acao_em: null }] };
      if (chamada.tabela === 'clientes_eventos') return { count: 1, data: [] };
      return { data: null, error: { code: 'PGRST205', message: 'tabela ausente' } };
    });

    const res = await dispatch(clientesOperacaoRouter(supabase as any), criarReq({ method: 'GET', url: '/resumo' }));

    expect(res.statusCode).toBe(200);
    expect(supabase._chamadas).toHaveLength(6);
    expect(res.body.data).toMatchObject({
      total_clientes: 12,
      pedidos_por_status: { em_busca: 1 },
      pendencias_por_idade: expect.objectContaining({ mais_de_7_dias: 1 }),
      respostas_acima_48h: 0,
      reservas_sem_decisao: 0,
      visitas_vencidas: 0,
      decisoes_duplicidade: 1,
      capabilities: { base: true, visitas: false, reservas: false, matches: false },
      visitas: [],
      reservas: [],
      matches: [],
    });
    expect(JSON.stringify(res.body.data)).not.toMatch(/logradouro|numero|complemento|bairro|cep/);
  });

  it('degrada sondagens opcionais quando o PostgREST omite o código do erro', async () => {
    const supabase = criarSupabaseFake((chamada) => {
      if (chamada.tabela === 'clientes') return { count: 45, data: [] };
      if (chamada.tabela === 'pecas_procuradas' || chamada.tabela === 'clientes_eventos') return { data: [] };
      return { data: null, error: { message: '' } };
    });

    const res = await dispatch(clientesOperacaoRouter(supabase as any), criarReq({ method: 'GET', url: '/resumo' }));

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      total_clientes: 45,
      capabilities: { base: true, visitas: false, reservas: false, matches: false },
      visitas: [],
      reservas: [],
      matches: [],
    });
  });

  it('não mascara erro inesperado de um módulo futuro', async () => {
    const supabase = criarSupabaseFake((chamada) => {
      if (chamada.tabela === 'clientes') return { count: 1, data: [] };
      if (chamada.tabela === 'pecas_procuradas' || chamada.tabela === 'clientes_eventos') return { data: [] };
      if (chamada.tabela === 'tarefas') return { error: { code: 'XX000', message: 'pane' } };
      return { error: { code: 'PGRST205', message: 'ausente' } };
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await dispatch(clientesOperacaoRouter(supabase as any), criarReq({ method: 'GET', url: '/resumo' }));

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Não foi possível carregar o resumo de clientes');
    consoleSpy.mockRestore();
  });

  it('lista clientes com cursor/limite sem selecionar endereço residencial completo', async () => {
    const linhas = [
      { id: 'c2', nome: 'Bia', criado_em: '2026-10-03T12:00:00Z' },
      { id: 'c1', nome: 'Ana', criado_em: '2026-10-02T12:00:00Z' },
    ];
    const supabase = criarSupabaseFake(() => ({ data: linhas }));

    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({ method: 'GET', url: '/clientes?limit=1&cidade=Campina%20Grande', query: { limit: '1', cidade: 'Campina Grande' } })
    );

    expect(res.body.data.itens).toEqual([linhas[0]]);
    expect(res.body.data.proximo_cursor).toBeTruthy();
    const select = supabase._chamadas[0].colunas ?? '';
    expect(select).not.toMatch(/logradouro|numero|complemento|bairro|cep/);
    expect(supabase._chamadas[0].filtros).toContainEqual({ tipo: 'eq', campo: 'cidade', valor: 'Campina Grande' });
  });

  it('aplica semijoin por responsável e anti-join para clientes sem pendências', async () => {
    const responsavel = '11111111-1111-4111-8111-111111111111';
    const supabase = criarSupabaseFake(() => ({ data: [] }));

    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({
        method: 'GET',
        url: `/clientes?responsavel=${responsavel}&semPendencias=true`,
        query: { responsavel, semPendencias: 'true' },
      })
    );

    expect(res.statusCode).toBe(200);
    expect(supabase._chamadas[0].colunas).toContain('pedidos:pecas_procuradas!inner');
    expect(supabase._chamadas[0].colunas).toContain('pedidos_ativas:pecas_procuradas!left');
    expect(supabase._chamadas[0].filtros).toEqual(expect.arrayContaining([
      { tipo: 'eq', campo: 'pedidos.responsavel_id', valor: responsavel },
      { tipo: 'is', campo: 'pedidos_ativas', valor: null },
    ]));
  });

  it.each(['cliente_avisado', 'cliente_desistiu', 'aguardando_resposta', 'vai_buscar', 'nao_quer_mais']) (
    'registra a ação %s somente pela RPC transacional',
    async (acao) => {
      const supabase = criarSupabaseFake((chamada) => chamada.rpc === 'registrar_acao_pedido'
        ? { data: { id: PEDIDO_ID, ultima_acao: acao } }
        : {});
      const res = await dispatch(
        clientesOperacaoRouter(supabase as any),
        criarReq({ method: 'POST', url: `/pedidos/${PEDIDO_ID}/acao`, params: { pedidoId: PEDIDO_ID }, body: { acao, motivo: acao.includes('desistiu') || acao === 'nao_quer_mais' ? 'Cliente decidiu' : undefined } })
      );
      expect(res.statusCode).toBe(200);
      expect(supabase._chamadas).toHaveLength(1);
      expect(supabase._chamadas[0]).toMatchObject({ rpc: 'registrar_acao_pedido' });
    }
  );

  it('nega ação operacional sem clientes.editar', async () => {
    const supabase = criarSupabaseFake(() => ({}));
    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({
        method: 'POST',
        url: `/pedidos/${PEDIDO_ID}/acao`,
        params: { pedidoId: PEDIDO_ID },
        body: { acao: 'cliente_avisado' },
        usuario: { id: 'u1', roles: [], permissoes: { clientes: { ver: true } } },
      })
    );
    expect(res.statusCode).toBe(403);
    expect(supabase._chamadas).toHaveLength(0);
  });

  it('troca a moto principal pela RPC com lock/transação', async () => {
    const supabase = criarSupabaseFake((chamada) => chamada.rpc === 'definir_moto_principal'
      ? { data: { id: '22222222-2222-4222-8222-222222222222', principal: true } }
      : {});
    const res = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({
        method: 'PATCH',
        url: '/clientes/11111111-1111-4111-8111-111111111111/moto-principal',
        params: { clienteId: '11111111-1111-4111-8111-111111111111' },
        body: { moto_id: '22222222-2222-4222-8222-222222222222' },
      })
    );
    expect(res.statusCode).toBe(200);
    expect(supabase._chamadas[0]).toMatchObject({ rpc: 'definir_moto_principal' });
  });

  it('protege correção histórica de origem com clientes.administrar', async () => {
    const supabase = criarSupabaseFake((chamada) => chamada.rpc === 'corrigir_origem_cliente'
      ? { data: { id: '11111111-1111-4111-8111-111111111111', origem: 'indicacao' } }
      : {});
    const semAdmin = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({
        method: 'PATCH',
        url: '/clientes/11111111-1111-4111-8111-111111111111/origem',
        params: { clienteId: '11111111-1111-4111-8111-111111111111' },
        body: { origem: 'indicacao', motivo: 'Correção' },
        usuario: { id: 'u1', roles: [], permissoes: { clientes: { ver: true, editar: true } } },
      })
    );
    expect(semAdmin.statusCode).toBe(403);

    const comAdmin = await dispatch(
      clientesOperacaoRouter(supabase as any),
      criarReq({
        method: 'PATCH',
        url: '/clientes/11111111-1111-4111-8111-111111111111/origem',
        params: { clienteId: '11111111-1111-4111-8111-111111111111' },
        body: { origem: 'indicacao', motivo: 'Corrigir cadastro antigo' },
      })
    );
    expect(comAdmin.statusCode).toBe(200);
    expect(supabase._chamadas.at(-1)).toMatchObject({ rpc: 'corrigir_origem_cliente' });
  });
});
