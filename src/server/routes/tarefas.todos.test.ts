// Testes de POST /api/tarefas com atribuido_para: 'todos' — cria uma linha de
// `tarefas` (com seu próprio checklist) por responsável elegível, em vez de
// uma linha compartilhada com um flag (ver Approach no plano da Tarefa 2:
// docs .superpowers/sdd/2026-09-01-5-features-plan/task-2-brief.md). Dispara
// o router de verdade (tarefasRouter) contra um Supabase fake — sem
// supertest: Router() do Express é só uma função (req,res,next) invocável
// direto, sem precisar montar um app/servidor HTTP de verdade.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/pushNotificationService.js', () => ({
  notificarUsuario: vi.fn(() => Promise.resolve()),
}));

import { notificarUsuario } from '../../services/pushNotificationService.js';
import { tarefasRouter, SELECT_COM_JOINS } from './tarefas';

// ---------------------------------------------------------------------------
// Supabase fake com estado em memória — cobre só as tabelas/chains que o
// router de tarefas realmente usa (usuarios/tarefas/tarefa_itens), mas de
// forma genérica o bastante pra aceitar qualquer combinação de .eq/.order/
// .single/.maybeSingle, e materializa o join de SELECT_COM_JOINS na mão
// (atribuido/criador/itens.concluido_por_usuario) igual o supabase real faria
// pela FK — assim o teste prova que a query monta o objeto certo.
// ---------------------------------------------------------------------------
function criarSupabaseFake(usuariosSeed: any[] = []) {
  const tabelas: Record<string, any[]> = {
    usuarios: usuariosSeed.map((u) => ({ ...u })),
    tarefas: [],
    tarefa_itens: [],
  };
  let proximoIdTarefa = 1;
  let proximoIdItem = 1;

  function usuarioResumo(id: string | null): { id: string; nome_exibicao: string } | null {
    if (!id) return null;
    const u = tabelas.usuarios.find((x) => x.id === id);
    return u ? { id: u.id, nome_exibicao: u.nome_exibicao } : null;
  }

  function tarefaJoined(row: any) {
    const itens = tabelas.tarefa_itens
      .filter((i) => i.tarefa_id === row.id)
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({
        id: i.id,
        texto: i.texto,
        concluido: i.concluido,
        ordem: i.ordem,
        concluido_em: i.concluido_em,
        concluido_por: i.concluido_por,
        concluido_por_usuario: usuarioResumo(i.concluido_por),
      }));
    return {
      ...row,
      atribuido: usuarioResumo(row.atribuido_para),
      criador: usuarioResumo(row.criado_por),
      cliente: null,
      itens,
    };
  }

  function criarQuery(tabela: string, comJoin: boolean) {
    const filtros: [string, any][] = [];
    let ordenarPor: string | null = null;
    const dados = () => {
      let arr = tabelas[tabela].filter((row) => filtros.every(([c, v]) => row[c] === v));
      if (ordenarPor) arr = arr.slice().sort((a, b) => String(a[ordenarPor as string]).localeCompare(String(b[ordenarPor as string])));
      return comJoin && tabela === 'tarefas' ? arr.map(tarefaJoined) : arr;
    };
    const q: any = {
      eq(col: string, val: any) {
        filtros.push([col, val]);
        return q;
      },
      order(col: string) {
        ordenarPor = col;
        return q;
      },
      single() {
        const arr = dados();
        return Promise.resolve(arr.length ? { data: arr[0], error: null } : { data: null, error: { message: 'não encontrada' } });
      },
      maybeSingle() {
        const arr = dados();
        return Promise.resolve({ data: arr[0] ?? null, error: null });
      },
      then(resolve: any, reject: any) {
        return Promise.resolve({ data: dados(), error: null }).then(resolve, reject);
      },
    };
    return q;
  }

  return {
    _tabelas: tabelas,
    from(tabela: string) {
      if (!(tabela in tabelas)) throw new Error(`tabela inesperada no fake: ${tabela}`);
      return {
        select(cols: string) {
          const comJoin = typeof cols === 'string' && cols.includes('atribuido:usuarios');
          return criarQuery(tabela, comJoin);
        },
        insert(payload: any) {
          const linhas = Array.isArray(payload) ? payload : [payload];
          const inseridos = linhas.map((l) => {
            if (tabela === 'tarefas') {
              const row = {
                id: `tarefa-${proximoIdTarefa++}`,
                status: 'pendente',
                concluida_em: null,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
                ...l,
              };
              tabelas.tarefas.push(row);
              return row;
            }
            if (tabela === 'tarefa_itens') {
              const row = { id: `item-${proximoIdItem++}`, concluido: false, concluido_em: null, concluido_por: null, ...l };
              tabelas.tarefa_itens.push(row);
              return row;
            }
            throw new Error(`insert não suportado no fake pra ${tabela}`);
          });
          const resultado = Array.isArray(payload) ? inseridos : inseridos[0];
          return {
            select() {
              return { single: () => Promise.resolve({ data: tabela === 'tarefas' ? tarefaJoined(resultado) : resultado, error: null }) };
            },
            then(resolve: any, reject: any) {
              return Promise.resolve({ data: resultado, error: null }).then(resolve, reject);
            },
          };
        },
      };
    },
  };
}

const ADMIN = { id: 'admin-1', roles: ['admin'], permissoes: {} };

function usuarioExecutor(id: string, nome: string, ativo = true) {
  return { id, nome_exibicao: nome, ativo, roles: [], permissoes: { tarefas: { ver: true, concluir: true } } };
}
function usuarioGerente(id: string, nome: string, ativo = true) {
  return { id, nome_exibicao: nome, ativo, roles: [], permissoes: { tarefas: { ver: true, criar: true } } };
}
function usuarioSemPermissao(id: string, nome: string, ativo = true) {
  return { id, nome_exibicao: nome, ativo, roles: [], permissoes: { tarefas: { ver: true } } };
}

function criarReq(overrides: Record<string, any> = {}) {
  return { method: 'POST', url: '/', headers: {}, body: {}, params: {}, query: {}, usuario: ADMIN, ...overrides };
}

function criarRes() {
  const res: any = { statusCode: 200 };
  let resolverFn: () => void;
  const pronta = new Promise<void>((resolve) => {
    resolverFn = resolve;
  });
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: any) => {
    res.body = body;
    resolverFn();
    return res;
  };
  res._pronta = () => pronta;
  return res;
}

async function dispatch(router: any, req: any) {
  const res = criarRes();
  let naoCasou = false;
  router(req, res, () => {
    naoCasou = true;
  });
  if (naoCasou) throw new Error(`Nenhuma rota casou pra ${req.method} ${req.url}`);
  await res._pronta();
  return res;
}

describe('POST /api/tarefas com atribuido_para "todos"', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria uma linha por responsável elegível, cada uma com seu próprio checklist independente', async () => {
    const fake = criarSupabaseFake([
      usuarioExecutor('u-bianca', 'Bianca'),
      usuarioGerente('u-carlos', 'Carlos'),
      usuarioSemPermissao('u-diego', 'Diego'),
      usuarioExecutor('u-ana', 'Ana', false), // inativa — fica de fora
    ]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(
      router,
      criarReq({
        body: { titulo: 'Reunião geral', atribuido_para: 'todos', itens: [{ texto: 'Item A' }, { texto: 'Item B' }] },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const tarefasCriadas = fake._tabelas.tarefas;
    // Só Bianca (executora) e Carlos (gerente) são elegíveis — Diego não tem
    // permissão nenhuma de tarefas e Ana está inativa.
    expect(tarefasCriadas).toHaveLength(2);
    expect(tarefasCriadas.map((t: any) => t.atribuido_para).sort()).toEqual(['u-bianca', 'u-carlos']);

    // Devolve a primeira tarefa em ordem alfabética por nome_exibicao (Bianca
    // antes de Carlos) — só pra satisfazer o contrato ApiResult<Tarefa>, o
    // frontend refetch() a lista inteira de qualquer jeito.
    expect(res.body.data.atribuido_para).toBe('u-bianca');

    // Cada linha ganhou sua PRÓPRIA cópia dos itens — ids diferentes, não uma
    // linha compartilhada (conclusão de checklist é por pessoa).
    const tarefaBianca = tarefasCriadas.find((t: any) => t.atribuido_para === 'u-bianca');
    const tarefaCarlos = tarefasCriadas.find((t: any) => t.atribuido_para === 'u-carlos');
    const itensBianca = fake._tabelas.tarefa_itens.filter((i: any) => i.tarefa_id === tarefaBianca.id);
    const itensCarlos = fake._tabelas.tarefa_itens.filter((i: any) => i.tarefa_id === tarefaCarlos.id);
    expect(itensBianca).toHaveLength(2);
    expect(itensCarlos).toHaveLength(2);
    expect(itensBianca.map((i: any) => i.texto)).toEqual(['Item A', 'Item B']);
    expect(itensCarlos.map((i: any) => i.texto)).toEqual(['Item A', 'Item B']);
    expect(itensBianca.map((i: any) => i.id)).not.toEqual(itensCarlos.map((i: any) => i.id));

    // Notifica os dois — o criador (admin) não está entre os elegíveis, então
    // ninguém é pulado por autoatribuição.
    expect(notificarUsuario).toHaveBeenCalledTimes(2);
    const idsNotificados = vi.mocked(notificarUsuario).mock.calls.map((c) => c[1]).sort();
    expect(idsNotificados).toEqual(['u-bianca', 'u-carlos']);
  });

  it('não notifica quem criou, mesmo se essa pessoa também for elegível pra "todos"', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);

    await dispatch(router, criarReq({ body: { titulo: 'Lembrete geral', atribuido_para: 'todos' } }));

    expect(fake._tabelas.tarefas).toHaveLength(2); // admin também é elegível e recebe a sua própria linha
    expect(notificarUsuario).toHaveBeenCalledTimes(1); // mas não se autonotifica
    expect(vi.mocked(notificarUsuario).mock.calls[0][1]).toBe('u-bianca');
  });

  it('zero responsáveis elegíveis -> 400, sem criar nenhuma linha', async () => {
    const fake = criarSupabaseFake([usuarioSemPermissao('u-diego', 'Diego'), usuarioExecutor('u-ana', 'Ana', false)]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ body: { titulo: 'Reunião geral', atribuido_para: 'todos' } }));

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Nenhum responsável elegível para receber a tarefa' });
    expect(fake._tabelas.tarefas).toHaveLength(0);
    expect(notificarUsuario).not.toHaveBeenCalled();
  });

  it('atribuição normal (não "todos") continua criando só uma linha, sem mudança de comportamento', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ body: { titulo: 'Buscar peça', atribuido_para: 'u-bianca' } }));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fake._tabelas.tarefas).toHaveLength(1);
    expect(fake._tabelas.tarefas[0].atribuido_para).toBe('u-bianca');
  });
});

describe('SELECT_COM_JOINS traz quem concluiu cada item do checklist', () => {
  it('embute concluido_por_usuario via o FK tarefa_itens.concluido_por -> usuarios', () => {
    expect(SELECT_COM_JOINS).toContain('concluido_por_usuario:usuarios!concluido_por(id, nome_exibicao)');
  });
});
