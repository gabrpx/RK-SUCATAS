// Testes do router de gavetas — dispara o router de verdade (gavetasRouter)
// contra um Supabase fake, sem supertest: Router() do Express é só uma
// função (req,res,next) invocável direto (mesmo padrão de
// tarefas.todos.test.ts).
import { describe, it, expect, beforeEach } from 'vitest';
import { gavetasRouter } from './gavetas';

// ---------------------------------------------------------------------------
// Supabase fake com estado em memória — cobre só as tabelas/chains que o
// router de gavetas realmente usa (gavetas/estoque).
// ---------------------------------------------------------------------------
function criarSupabaseFake(gavetasSeed: any[] = [], estoqueSeed: any[] = []) {
  const tabelas: Record<string, any[]> = {
    gavetas: gavetasSeed.map((g) => ({ ...g })),
    estoque: estoqueSeed.map((e) => ({ ...e })),
  };
  let proximoId = 1;

  function criarQuery(tabela: string) {
    const filtros: [string, any][] = [];
    let ordenarPor: string | null = null;
    let modoUpdate: any = null;
    let modoDelete = false;

    const linhasFiltradas = () => tabelas[tabela].filter((row) => filtros.every(([c, v]) => row[c] === v));

    const dados = () => {
      let arr = linhasFiltradas();
      if (ordenarPor) arr = arr.slice().sort((a, b) => String(a[ordenarPor as string]).localeCompare(String(b[ordenarPor as string])));
      return arr;
    };

    const executar = () => {
      if (modoDelete) {
        const alvo = new Set(linhasFiltradas());
        tabelas[tabela] = tabelas[tabela].filter((row) => !alvo.has(row));
        return { data: null, error: null };
      }
      if (modoUpdate) {
        linhasFiltradas().forEach((row) => Object.assign(row, modoUpdate));
        return { data: dados(), error: null };
      }
      return { data: dados(), error: null };
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
      select() {
        return q;
      },
      single() {
        const arr = dados();
        return Promise.resolve(arr.length ? { data: arr[0], error: null } : { data: null, error: { message: 'não encontrada' } });
      },
      then(resolve: any, reject: any) {
        return Promise.resolve(executar()).then(resolve, reject);
      },
    };
    return q;
  }

  return {
    _tabelas: tabelas,
    from(tabela: string) {
      if (!(tabela in tabelas)) throw new Error(`tabela inesperada no fake: ${tabela}`);
      return {
        select(_cols: string) {
          return criarQuery(tabela);
        },
        insert(payload: any) {
          const linhas = Array.isArray(payload) ? payload : [payload];
          const inseridos = linhas.map((l) => {
            const row = { id: `gaveta-${proximoId++}`, ...l };
            tabelas[tabela].push(row);
            return row;
          });
          const resultado = Array.isArray(payload) ? inseridos : inseridos[0];
          return {
            select() {
              return { single: () => Promise.resolve({ data: resultado, error: null }) };
            },
          };
        },
        update(payload: any) {
          const filtrosDoQ: [string, any][] = [];
          const linhasAlvo = () => tabelas[tabela].filter((row) => filtrosDoQ.every(([c, v]) => row[c] === v));
          const wrapped: any = {
            eq(col: string, val: any) {
              filtrosDoQ.push([col, val]);
              return wrapped;
            },
            select() {
              return {
                single: () => {
                  const alvo = linhasAlvo();
                  alvo.forEach((row) => Object.assign(row, payload));
                  return Promise.resolve({ data: alvo[0] ?? null, error: alvo[0] ? null : { message: 'não encontrada' } });
                },
              };
            },
            then(resolve: any, reject: any) {
              return Promise.resolve()
                .then(() => {
                  const alvo = linhasAlvo();
                  alvo.forEach((row) => Object.assign(row, payload));
                  return { data: alvo, error: null };
                })
                .then(resolve, reject);
            },
          };
          return wrapped;
        },
        delete() {
          const filtrosDoQ: [string, any][] = [];
          const wrapped: any = {
            eq(col: string, val: any) {
              filtrosDoQ.push([col, val]);
              return wrapped;
            },
            then(resolve: any, reject: any) {
              return Promise.resolve()
                .then(() => {
                  tabelas[tabela] = tabelas[tabela].filter((row) => !filtrosDoQ.every(([c, v]) => row[c] === v));
                  return { data: null, error: null };
                })
                .then(resolve, reject);
            },
          };
          return wrapped;
        },
      };
    },
  };
}

const ADMIN = { id: 'admin-1', roles: ['admin'], permissoes: {} };

function criarReq(overrides: Record<string, any> = {}) {
  return { method: 'GET', url: '/', headers: {}, body: {}, params: {}, query: {}, usuario: ADMIN, ...overrides };
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

describe('gavetasRouter', () => {
  beforeEach(() => {});

  it('GET / retorna a lista de gavetas', async () => {
    const fake = criarSupabaseFake([
      { id: 'g1', nome: 'Gaveta A', categoria_id: null, icone: null },
      { id: 'g2', nome: 'Gaveta B', categoria_id: null, icone: null },
    ]);
    const router = gavetasRouter(fake as any);

    const res = await dispatch(router, criarReq({ method: 'GET', url: '/' }));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('POST / com nome vazio -> 400, sem chamar insert', async () => {
    const fake = criarSupabaseFake();
    const router = gavetasRouter(fake as any);

    const res = await dispatch(router, criarReq({ method: 'POST', url: '/', body: { nome: '   ' } }));

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(fake._tabelas.gavetas).toHaveLength(0);
  });

  it('POST / com nome válido cria a gaveta (chama insert)', async () => {
    const fake = criarSupabaseFake();
    const router = gavetasRouter(fake as any);

    const res = await dispatch(router, criarReq({ method: 'POST', url: '/', body: { nome: 'Gaveta Nova' } }));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fake._tabelas.gavetas).toHaveLength(1);
    expect(fake._tabelas.gavetas[0].nome).toBe('Gaveta Nova');
  });

  it('DELETE /:id solta as peças (estoque.gaveta_id = null) antes de excluir a gaveta', async () => {
    const fake = criarSupabaseFake(
      [{ id: 'g1', nome: 'Gaveta A', categoria_id: null, icone: null }],
      [
        { id: 'e1', nome: 'Peça 1', gaveta_id: 'g1' },
        { id: 'e2', nome: 'Peça 2', gaveta_id: 'g1' },
        { id: 'e3', nome: 'Peça 3', gaveta_id: 'outra' },
      ],
    );
    const router = gavetasRouter(fake as any);

    const res = await dispatch(router, criarReq({ method: 'DELETE', url: '/g1', params: { id: 'g1' } }));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // nenhuma peça foi apagada, só desvinculada da gaveta excluída
    expect(fake._tabelas.estoque).toHaveLength(3);
    expect(fake._tabelas.estoque.find((e: any) => e.id === 'e1').gaveta_id).toBeNull();
    expect(fake._tabelas.estoque.find((e: any) => e.id === 'e2').gaveta_id).toBeNull();
    expect(fake._tabelas.estoque.find((e: any) => e.id === 'e3').gaveta_id).toBe('outra');

    // a gaveta em si foi excluída
    expect(fake._tabelas.gavetas).toHaveLength(0);
  });
});
