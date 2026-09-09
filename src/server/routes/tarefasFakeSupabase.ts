// Supabase fake com estado em memória, compartilhado pelos testes de rota de
// tarefas.ts (tarefas.todos.test.ts, tarefas.participantes.route.test.ts,
// etc). Cobre só as tabelas/chains que o router de tarefas realmente usa
// (usuarios/tarefas/tarefa_itens/tarefa_participantes), mas de forma
// genérica o bastante pra aceitar qualquer combinação de .eq/.in/.order/
// .single/.maybeSingle/.select().single()/update()/insert(), e materializa
// os joins de SELECT_COM_JOINS na mão (atribuido/criador/itens/participantes)
// igual o supabase real faria pelas FKs — assim o teste prova que a query
// monta o objeto certo. Router() do Express é só uma função (req,res,next)
// invocável direto, sem precisar de supertest/servidor HTTP de verdade.
type Filtro = { tipo: 'eq'; col: string; val: any } | { tipo: 'in'; col: string; vals: any[] };

export function criarSupabaseFake(usuariosSeed: any[] = []) {
  const tabelas: Record<string, any[]> = {
    usuarios: usuariosSeed.map((u) => ({ ...u })),
    tarefas: [],
    tarefa_itens: [],
    tarefa_participantes: [],
    tarefa_imagens: [],
  };
  const contadores: Record<string, number> = {};
  function novoId(tabela: string) {
    contadores[tabela] = (contadores[tabela] ?? 0) + 1;
    return `${tabela.replace(/^tarefa_/, '')}-${contadores[tabela]}`;
  }

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
    const participantes = tabelas.tarefa_participantes
      .filter((p) => p.tarefa_id === row.id)
      .map((p) => ({
        id: p.id,
        usuario_id: p.usuario_id,
        concluido: p.concluido,
        concluido_em: p.concluido_em,
        lida: p.lida,
        usuario: usuarioResumo(p.usuario_id),
      }));
    const imagens = tabelas.tarefa_imagens
      .filter((i) => i.tarefa_id === row.id)
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({ id: i.id, url: i.url, ordem: i.ordem }));
    return {
      ...row,
      atribuido: usuarioResumo(row.atribuido_para),
      criador: usuarioResumo(row.criado_por),
      cliente: null,
      itens,
      participantes,
      imagens,
    };
  }

  function aplicaFiltros(linhas: any[], filtros: Filtro[]) {
    return linhas.filter((row) =>
      filtros.every((f) => (f.tipo === 'eq' ? row[f.col] === f.val : f.vals.includes(row[f.col])))
    );
  }

  function criarSelectQuery(tabela: string, cols: string, opts?: { count?: string; head?: boolean }) {
    const filtros: Filtro[] = [];
    let ordenarPor: string | null = null;
    const comJoinTarefa =
      tabela === 'tarefas' &&
      typeof cols === 'string' &&
      (cols.includes('atribuido:usuarios') ||
        cols.includes('participantes:tarefa_participantes') ||
        cols.includes('itens:tarefa_itens') ||
        cols.includes('imagens:tarefa_imagens'));
    const materializa = () => {
      let arr = aplicaFiltros(tabelas[tabela], filtros);
      if (ordenarPor) arr = arr.slice().sort((a, b) => String(a[ordenarPor as string]).localeCompare(String(b[ordenarPor as string])));
      return comJoinTarefa ? arr.map(tarefaJoined) : arr;
    };
    const q: any = {
      eq(col: string, val: any) {
        filtros.push({ tipo: 'eq', col, val });
        return q;
      },
      in(col: string, vals: any[]) {
        filtros.push({ tipo: 'in', col, vals });
        return q;
      },
      order(col: string) {
        ordenarPor = col;
        return q;
      },
      single() {
        const arr = materializa();
        return Promise.resolve(arr.length ? { data: arr[0], error: null } : { data: null, error: { message: 'não encontrada' } });
      },
      maybeSingle() {
        const arr = materializa();
        return Promise.resolve({ data: arr[0] ?? null, error: null });
      },
      then(resolve: any, reject: any) {
        if (opts?.head) {
          return Promise.resolve({ count: aplicaFiltros(tabelas[tabela], filtros).length, data: null, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: materializa(), error: null }).then(resolve, reject);
      },
    };
    return q;
  }

  function criarUpdateQuery(tabela: string, patch: any) {
    const filtros: Filtro[] = [];
    const alvo = () => aplicaFiltros(tabelas[tabela], filtros);
    const q: any = {
      eq(col: string, val: any) {
        filtros.push({ tipo: 'eq', col, val });
        return q;
      },
      select() {
        return {
          single() {
            const linhas = alvo();
            linhas.forEach((row) => Object.assign(row, patch));
            const linha = linhas[0];
            if (!linha) return Promise.resolve({ data: null, error: { message: 'não encontrada' } });
            return Promise.resolve({ data: tabela === 'tarefas' ? tarefaJoined(linha) : linha, error: null });
          },
        };
      },
      then(resolve: any, reject: any) {
        const linhas = alvo();
        linhas.forEach((row) => Object.assign(row, patch));
        return Promise.resolve({ data: linhas, error: null }).then(resolve, reject);
      },
    };
    return q;
  }

  function criarDeleteQuery(tabela: string) {
    const filtros: Filtro[] = [];
    const q: any = {
      eq(col: string, val: any) {
        filtros.push({ tipo: 'eq', col, val });
        return q;
      },
      in(col: string, vals: any[]) {
        filtros.push({ tipo: 'in', col, vals });
        return q;
      },
      then(resolve: any, reject: any) {
        const removidos = new Set(aplicaFiltros(tabelas[tabela], filtros));
        tabelas[tabela] = tabelas[tabela].filter((row) => !removidos.has(row));
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      },
    };
    return q;
  }

  function criarInsertQuery(tabela: string, payload: any) {
    const linhas = Array.isArray(payload) ? payload : [payload];
    const inseridos = linhas.map((l) => {
      const defaults: any = { id: novoId(tabela), criado_em: new Date().toISOString() };
      if (tabela === 'tarefas') Object.assign(defaults, { status: 'pendente', concluida_em: null, atualizado_em: new Date().toISOString() });
      if (tabela === 'tarefa_itens') Object.assign(defaults, { concluido: false, concluido_em: null, concluido_por: null });
      if (tabela === 'tarefa_participantes') Object.assign(defaults, { concluido: false, concluido_em: null, lida: false });
      const row = { ...defaults, ...l };
      tabelas[tabela].push(row);
      return row;
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
  }

  return {
    _tabelas: tabelas,
    from(tabela: string) {
      if (!(tabela in tabelas)) throw new Error(`tabela inesperada no fake: ${tabela}`);
      return {
        select(cols: string, opts?: { count?: string; head?: boolean }) {
          return criarSelectQuery(tabela, cols, opts);
        },
        insert(payload: any) {
          return criarInsertQuery(tabela, payload);
        },
        update(patch: any) {
          return criarUpdateQuery(tabela, patch);
        },
        delete() {
          return criarDeleteQuery(tabela);
        },
      };
    },
  };
}

export const ADMIN = { id: 'admin-1', roles: ['admin'], permissoes: {} };

export function usuarioExecutor(id: string, nome: string, ativo = true) {
  return { id, nome_exibicao: nome, ativo, roles: [], permissoes: { tarefas: { ver: true, concluir: true } } };
}
export function usuarioGerente(id: string, nome: string, ativo = true) {
  return { id, nome_exibicao: nome, ativo, roles: [], permissoes: { tarefas: { ver: true, criar: true } } };
}
export function usuarioSemPermissao(id: string, nome: string, ativo = true) {
  return { id, nome_exibicao: nome, ativo, roles: [], permissoes: { tarefas: { ver: true } } };
}

export function criarReq(overrides: Record<string, any> = {}) {
  return { method: 'POST', url: '/', headers: {}, body: {}, params: {}, query: {}, usuario: ADMIN, ...overrides };
}

export function criarRes() {
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

export async function dispatch(router: any, req: any) {
  const res = criarRes();
  let naoCasou = false;
  router(req, res, () => {
    naoCasou = true;
  });
  if (naoCasou) throw new Error(`Nenhuma rota casou pra ${req.method} ${req.url}`);
  await res._pronta();
  return res;
}
