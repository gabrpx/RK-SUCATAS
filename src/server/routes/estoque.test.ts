// O join do estoque lista colunas explícitas da categoria. Toda coluna nova
// de `categorias` que o frontend precisa tem que ser adicionada aqui à mão —
// esquecer disso foi exatamente o bug da predefinição de categoria do
// Mercado Livre (o toggle salvava, mas o valor nunca voltava pro formulário).
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { SELECT_COM_JOINS, estoqueRouter, montarPayload } from './estoque.js';
import { criarReq, dispatch } from './tarefasFakeSupabase';

describe('SELECT_COM_JOINS', () => {
  it('traz a categoria padrão do Mercado Livre junto da categoria da peça', () => {
    expect(SELECT_COM_JOINS).toContain('mercadolivre_categoria_id_padrao');
  });

  it('continua trazendo id e nome da categoria', () => {
    expect(SELECT_COM_JOINS).toMatch(/categoria:categorias\([^)]*id[^)]*nome[^)]*\)/);
  });
});

describe('transferência da listagem de estoque', () => {
  it('entrega Brotli quando o cliente aceita Brotli e gzip, preservando o JSON', async () => {
    const app = express();
    app.use((req, _res, next) => { (req as any).usuario = { id: 'admin-1', roles: ['admin'], permissoes: {} }; next(); });
    app.use('/api/estoque', estoqueRouter(criarSupabaseMatchLegado() as any));
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', () => resolve()));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/estoque`, { headers: { 'Accept-Encoding': 'br, gzip' } });
      expect(response.headers.get('content-encoding')).toBe('br');
      expect(await response.json()).toEqual({ success: true, data: [] });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('SELECT_COM_JOINS (família)', () => {
  it('não embute estoque_familias no select principal', () => {
    // O select principal não deve tentar embutir estoque_familias — isso
    // quebraria a listagem inteira se a migration_056 não tiver rodado
    // ainda, o mesmo motivo pelo qual unidades/compatibilidades também
    // ficam fora do SELECT_COM_JOINS. Ver anexarFamilias (consulta separada).
    expect(SELECT_COM_JOINS).not.toContain('estoque_familias');
  });
});

describe('SELECT_COM_JOINS (gaveta)', () => {
  it('traz o join da gaveta com id, nome e icone', () => {
    expect(SELECT_COM_JOINS).toMatch(/gaveta:gavetas\([^)]*id[^)]*nome[^)]*icone[^)]*\)/);
  });
});

describe('montarPayload (gaveta_id)', () => {
  it('inclui gaveta_id no payload quando enviado (mover peça pra gaveta)', () => {
    expect(montarPayload({ gaveta_id: 'g1' })).toEqual({ gaveta_id: 'g1' });
  });

  it('normaliza null explícito pra null (soltar a peça da gaveta)', () => {
    expect(montarPayload({ gaveta_id: null })).toEqual({ gaveta_id: null });
  });

  it('normaliza string vazia pra null', () => {
    expect(montarPayload({ gaveta_id: '' })).toEqual({ gaveta_id: null });
  });

  it('omite gaveta_id quando o campo não veio no body', () => {
    expect(montarPayload({ nome: 'Tanque' })).not.toHaveProperty('gaveta_id');
  });
});

describe('montarPayload (familia_id)', () => {
  it('mantém um uuid válido de familia_id', () => {
    expect(montarPayload({ familia_id: 'f1' })).toEqual({ familia_id: 'f1' });
  });

  it('normaliza string vazia pra null (desvincula da família)', () => {
    expect(montarPayload({ familia_id: '' })).toEqual({ familia_id: null });
  });

  it('normaliza null explícito pra null', () => {
    expect(montarPayload({ familia_id: null })).toEqual({ familia_id: null });
  });

  it('omite familia_id quando o campo não veio no body', () => {
    expect(montarPayload({ nome: 'Tanque' })).not.toHaveProperty('familia_id');
  });
});

function criarSupabaseMatchLegado() {
  const tabelas: Record<string, any[]> = {
    estoque: [],
    pecas_procuradas: [
      {
        id: 'procura-1',
        cliente_id: 'cliente-1',
        cliente_nome: 'Ana',
        descricao: 'Farol da CG',
        categoria_id: null,
        modelo_moto_id: 'modelo-cg',
        status: 'aguardando',
        criado_por: 'atendente-1',
      },
    ],
    estoque_modelos_compativeis: [],
    estoque_familias: [],
    estoque_anuncios_ml: [],
    estoque_anuncios_shopee: [],
    promocoes: [],
    tarefas: [],
  };

  const filtrar = (linhas: any[], filtros: Array<[string, any]>) =>
    linhas.filter((linha) => filtros.every(([campo, valor]) => linha[campo] === valor));

  const consulta = (tabela: string) => {
    const filtros: Array<[string, any]> = [];
    const query: any = {
      eq(campo: string, valor: any) {
        filtros.push([campo, valor]);
        return query;
      },
      in() {
        return query;
      },
      lte() {
        return query;
      },
      order() {
        return query;
      },
      single() {
        return Promise.resolve({ data: filtrar(tabelas[tabela] ?? [], filtros)[0] ?? null, error: null });
      },
      then(resolve: any, reject: any) {
        return Promise.resolve({ data: filtrar(tabelas[tabela] ?? [], filtros), error: null }).then(resolve, reject);
      },
    };
    return query;
  };

  return {
    _tabelas: tabelas,
    rpc: () => Promise.resolve({ data: null, error: null }),
    from(tabela: string) {
      if (!(tabela in tabelas)) tabelas[tabela] = [];
      return {
        select: () => consulta(tabela),
        insert(payload: any) {
          const entradas = Array.isArray(payload) ? payload : [payload];
          const inseridas = entradas.map((entrada, indice) => ({
            id: entrada.id ?? `${tabela}-${tabelas[tabela].length + indice + 1}`,
            ...entrada,
          }));
          tabelas[tabela].push(...inseridas);
          const resultado = Array.isArray(payload) ? inseridas : inseridas[0];
          const retorno: any = {
            select: () => ({ single: () => Promise.resolve({ data: Array.isArray(resultado) ? resultado[0] : resultado, error: null }) }),
            then: (resolve: any, reject: any) => Promise.resolve({ data: resultado, error: null }).then(resolve, reject),
          };
          return retorno;
        },
        update(patch: any) {
          const filtros: Array<[string, any]> = [];
          const retorno: any = {
            eq(campo: string, valor: any) {
              filtros.push([campo, valor]);
              return retorno;
            },
            then(resolve: any, reject: any) {
              const alteradas = filtrar(tabelas[tabela], filtros);
              alteradas.forEach((linha) => Object.assign(linha, patch));
              return Promise.resolve({ data: alteradas, error: null }).then(resolve, reject);
            },
          };
          return retorno;
        },
      };
    },
  };
}

describe('match legado entre estoque e peças procuradas', () => {
  it('caracteriza que a chegada da peça muda aguardando para atendida', async () => {
    const supabase = criarSupabaseMatchLegado();
    const router = estoqueRouter(supabase as any);

    const res = await dispatch(
      router,
      criarReq({
        method: 'POST',
        url: '/',
        usuario: { id: 'estoquista-1', roles: ['admin'], permissoes: {} },
        body: {
          nome: 'Farol CG 160',
          condicao: 'original',
          quantidade: 1,
          valor: 180,
          modelo_moto_id: 'modelo-cg',
        },
      })
    );

    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => {
      expect(supabase._tabelas.pecas_procuradas[0]).toMatchObject({
        status: 'atendida',
        atendida_em: expect.any(String),
      });
    });
    expect(supabase._tabelas.tarefas).toEqual([
      expect.objectContaining({
        cliente_id: 'cliente-1',
        atribuido_para: 'atendente-1',
        prioridade: 'alta',
      }),
    ]);
  });
});
