# Famílias de Peça — Fundação de Dados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer for "famílias de peça" — a new `estoque_familias` table that groups existing `estoque` rows (each keeping its own `modelo_moto_id`) under one name, plus a backend rule that keeps `estoque_unidades` always in sync with `estoque.quantidade` (one row per physical unit, blank when there's nothing to say about it). No UI in this plan — everything here is testable via pure functions, exported route logic, and manual SQL verification, matching how this repo already tests its backend (no HTTP/DB mocking framework exists here — only exported pure functions are unit tested).

**Architecture:** Two new Postgres migrations (`estoque_familias` table + `estoque.familia_id` column; a `sincronizar_unidades_estoque` SQL function + one-time backfill). Backend: a new `anexarFamilias` join-by-hand helper (same graceful-degradation pattern as `anexarCompatibilidades`) wired into the existing `estoque` listing/create/update chain, a `familia_id` field added to the editable-fields allowlist, a `sincronizarUnidades` RPC wrapper called after every quantity change, and a new dedicated `estoqueFamiliasRouter` for família CRUD. Frontend: type additions, a pure aggregation-helpers module (`familiaEstoque.ts`), and thin API client functions — no components yet.

**Tech Stack:** Express + Supabase (Postgres) backend, TypeScript, Vitest for tests (`node` environment, no jsdom needed — this plan touches no React components).

**Spec:** [docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md](../specs/2026-09-02-estoque-familias-de-peca-design.md)

## Global Constraints

- Every new/changed table or column must degrade gracefully when its migration hasn't run yet in a given environment — never let a missing table/function break the existing `/api/estoque` listing. Mirror the exact pattern already used by `anexarUnidades`/`anexarCompatibilidades` in `src/server/routes/estoque.ts` (catch `error.code === '42P01' || error.code === 'PGRST205'`, warn and fall back).
- Família is always optional — an `estoque` row with `familia_id: null` must behave exactly as it does today. Nothing in this plan changes behavior for peças sem família.
- No new npm dependency — everything here uses what's already installed (`@supabase/supabase-js`, `express`, `vitest`).
- Pure logic goes in exported, independently-testable functions (this repo's established pattern — see `src/server/routes/estoque.test.ts` and `src/server/routes/orcamentos.vender.test.ts`, which both test exported functions with zero DB/HTTP mocking, never spin up a server).
- This plan does not touch any React component, `DataContext.tsx`, or `EstoqueView.tsx` — those are Plano C's job. Task 8 here only adds new functions to `src/features/estoque/api.ts`; nothing calls them yet.

---

## File Structure

- Create: `supabase/migration_056_estoque_familias.sql` — new table + FK column.
- Create: `supabase/migration_057_estoque_unidades_explicitas.sql` — sync function + one-time backfill.
- Modify: `src/features/estoque/types.ts` — `EstoqueFamilia`, `EstoqueFamiliaInput`, `Estoque.familia_id`/`familia`, `EstoqueInput` gains `familia_id`.
- Create: `src/features/estoque/familiaEstoque.ts` — pure aggregation helpers (grouping, counts, price range).
- Create: `src/features/estoque/familiaEstoque.test.ts` — tests for the above.
- Modify: `src/server/routes/estoque.ts` — `anexarFamilias`, `familia_id` in `CAMPOS_EDITAVEIS`/`montarPayload`, `sincronizarUnidades` wired into create/update/bulk-quantity routes.
- Modify: `src/server/routes/estoque.test.ts` — extend with a test for the new `familia_id` support.
- Create: `src/server/routes/estoqueFamilias.ts` — CRUD router for `estoque_familias`.
- Create: `src/server/routes/estoqueFamilias.test.ts` — tests for `montarPayloadFamilia`.
- Modify: `server.ts` — mount the new router.
- Modify: `src/features/estoque/api.ts` — `estoqueFamiliasApi` client functions.

---

### Task 1: Migration 056 — `estoque_familias` table

**Files:**
- Create: `supabase/migration_056_estoque_familias.sql`

**Interfaces:**
- Produces: table `estoque_familias(id, nome, categoria_id, descricao, imagem_url, criado_em, atualizado_em)`; column `estoque.familia_id uuid references estoque_familias(id)` (nullable).

- [ ] **Step 1: Write the migration file**

```sql
-- =============================================================================
-- RK Sucatas — Migração 056: famílias de peça
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 055).
--
-- Problema: hoje cada combinação peça+modelo de moto é uma linha
-- independente em `estoque` — "Tanque de Combustível CG 125 Titan 99",
-- "... Today", "... CG 125 Fan" são 3 fichas sem relação estrutural
-- nenhuma além do nome parecido. Ver
-- docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md.
--
-- Solução: `estoque_familias` agrupa N fichas (`estoque`) sob um nome comum
-- ("Tanque de Combustível CG 125"), cada ficha mantendo seu próprio
-- modelo_moto_id — é isso que forma os grupos por modelo/ano dentro do
-- futuro modal de família. `estoque.familia_id` é opcional: peça sem
-- família continua se comportando exatamente como hoje (linha própria na
-- tabela, sem nenhum agrupamento).
--
-- Fusão das duplicatas já cadastradas é sempre assistida (sugestão +
-- confirmação manual) — nunca automática. Essa tela vem num plano à parte.
-- =============================================================================

create table estoque_familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid references categorias(id),
  descricao text,
  imagem_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_estoque_familias_atualizado_em
  before update on estoque_familias
  for each row execute function set_atualizado_em();

alter table estoque_familias enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

alter table estoque add column if not exists familia_id uuid references estoque_familias(id);
create index if not exists idx_estoque_familia on estoque(familia_id);

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Manually verify against a Supabase project**

This repo has no automated migration test harness (every `supabase/migration_*.sql` file is verified by running it in the Supabase SQL editor — see `src/server/routes/estoque.test.ts`'s comment for how missing-migration state is instead handled defensively in application code, not tested here). Run this file in the project's Supabase SQL editor (or a disposable Supabase project/branch if available) and confirm:
- `estoque_familias` exists with the 6 columns above.
- `estoque.familia_id` exists and is nullable.
- Inserting an `estoque` row without `familia_id` still works (no regression).

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_056_estoque_familias.sql
git commit -m "feat(estoque): adiciona tabela estoque_familias e estoque.familia_id"
```

---

### Task 2: Migration 057 — unidades sempre explícitas

**Files:**
- Create: `supabase/migration_057_estoque_unidades_explicitas.sql`

**Interfaces:**
- Consumes: table `estoque_unidades` (migration_014, with `condicao_nota` from migration_024 and `vendida_em` from migration_038 — this migration assumes both already ran, same sequential-dependency convention as `migration_024_condicao_nota_unidade.sql`'s own header comment).
- Produces: SQL function `sincronizar_unidades_estoque(p_estoque_id uuid, p_quantidade_alvo int) returns void`. Task 6 below wraps this from the backend as `sincronizarUnidades(supabase, estoqueId, quantidade): Promise<string | null>`.

- [ ] **Step 1: Write the migration file**

```sql
-- =============================================================================
-- RK Sucatas — Migração 057: unidades físicas sempre explícitas
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 056,
-- incluindo migration_014_unidades_avaria.sql, migration_024_condicao_nota_
-- unidade.sql e migration_038_vendas_unidade.sql já aplicadas).
--
-- Problema: estoque_unidades (migration_014) só ganhava linha pra uma
-- unidade "diferente" das outras — uma peça com 5 unidades idênticas tinha
-- zero fichas. O novo modal de família (ver
-- docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md)
-- mostra um card por unidade física, inclusive as sem diferença nenhuma —
-- então toda unidade física passa a precisar da própria linha.
--
-- Solução: sincronizar_unidades_estoque(p_estoque_id, p_quantidade_alvo)
-- garante que existam exatamente p_quantidade_alvo linhas em
-- estoque_unidades pra aquela peça:
--   - se faltar, cria unidades EM BRANCO (valor/fotos/condicao_nota nulos,
--     avaria false, apelido null) — exibem foto/preço/nota da peça-mãe por
--     herança (mesma lógica de valorDaUnidade/condicaoNotaDaUnidade que já
--     existe em src/features/estoque/valorEstoque.ts), sem precisar
--     preencher nada. Só o formulário manual "Registrar unidade" (fora
--     deste plano) exige foto/preço próprios — essa sincronização
--     automática nunca passa por ali.
--   - se sobrar, apaga só unidades em branco (sem vendida_em, sem apelido,
--     sem avaria, sem valor/condicao_nota/fotos próprios), das mais
--     recentes pras mais antigas. Nunca apaga unidade com dado próprio ou
--     já vendida — se não sobrar unidade em branco suficiente, levanta
--     exceção pedindo que o usuário exclua a unidade certa antes.
--
-- Chamada pelo backend (src/server/routes/estoque.ts) toda vez que
-- POST/PUT/PATCH /api/estoque ou /api/estoque/bulk-update-quantidade grava
-- quantidade — nunca chamada direto pelo frontend.
-- =============================================================================

create or replace function sincronizar_unidades_estoque(p_estoque_id uuid, p_quantidade_alvo int)
returns void as $$
declare
  v_atual int;
  v_faltando int;
  v_sobrando int;
  v_em_branco_disponivel int;
begin
  select count(*) into v_atual from estoque_unidades where estoque_id = p_estoque_id;

  if v_atual < p_quantidade_alvo then
    v_faltando := p_quantidade_alvo - v_atual;
    insert into estoque_unidades (estoque_id, avaria)
    select p_estoque_id, false from generate_series(1, v_faltando);
  elsif v_atual > p_quantidade_alvo then
    v_sobrando := v_atual - p_quantidade_alvo;

    select count(*) into v_em_branco_disponivel
    from estoque_unidades
    where estoque_id = p_estoque_id
      and vendida_em is null
      and apelido is null
      and avaria = false
      and avaria_descricao is null
      and valor is null
      and condicao_nota is null
      and fotos = '[]'::jsonb;

    if v_em_branco_disponivel < v_sobrando then
      raise exception 'Reduza a quantidade excluindo unidades específicas primeiro: só % unidade(s) em branco disponível(is), % precisa(m) sair', v_em_branco_disponivel, v_sobrando;
    end if;

    delete from estoque_unidades
    where id in (
      select id from estoque_unidades
      where estoque_id = p_estoque_id
        and vendida_em is null
        and apelido is null
        and avaria = false
        and avaria_descricao is null
        and valor is null
        and condicao_nota is null
        and fotos = '[]'::jsonb
      order by criado_em desc
      limit v_sobrando
    );
  end if;
end;
$$ language plpgsql;

-- Backfill: cria as unidades em branco faltantes pra todo o estoque já
-- cadastrado — cada peça passa a ter exatamente `quantidade` linhas em
-- estoque_unidades (as fichas que já existiam, mais as que faltavam em
-- branco). Rode isso com cautela: teste num dump/projeto de staging antes
-- de aplicar em produção (ver spec, seção "Modelo de dados").
do $$
declare
  r record;
begin
  for r in select id, quantidade from estoque where quantidade > 0 loop
    perform sincronizar_unidades_estoque(r.id, r.quantidade);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Manually verify against a Supabase project (test the function before the backfill)**

Before running the `do $$ ... $$` backfill block against real data, test `sincronizar_unidades_estoque` in isolation on a disposable/staging project:
1. Create a test `estoque` row with `quantidade = 3` and confirm `select count(*) from estoque_unidades where estoque_id = '<id>'` is 0.
2. Run `select sincronizar_unidades_estoque('<id>', 3);` — confirm 3 blank rows now exist (`valor`, `condicao_nota` null; `fotos = '[]'`; `avaria = false`).
3. Run `select sincronizar_unidades_estoque('<id>', 5);` — confirm 2 more blank rows were added (5 total), none of the original 3 touched.
4. Manually set one row's `apelido` to a non-null value, then run `select sincronizar_unidades_estoque('<id>', 3);` — confirm it removed exactly 2 blank rows and kept the one with the apelido.
5. Set two more rows to have non-blank data (so all 3 remaining are "different"), then run `select sincronizar_unidades_estoque('<id>', 1);` — confirm it raises the `Reduza a quantidade...` exception instead of silently deleting a differentiated unit.
6. Only after these pass, run the full migration (including the backfill) against staging/production, and spot-check a few real peças with `quantidade > 1` to confirm row counts now match.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_057_estoque_unidades_explicitas.sql
git commit -m "feat(estoque): unidades físicas sempre explícitas (sincronizar_unidades_estoque)"
```

---

### Task 3: Types — `EstoqueFamilia`

**Files:**
- Modify: `src/features/estoque/types.ts`

**Interfaces:**
- Produces: `EstoqueFamilia`, `EstoqueFamiliaInput`, `Estoque.familia_id: string | null`, `Estoque.familia?: EstoqueFamilia | null`, `EstoqueInput` gains `familia_id`.

- [ ] **Step 1: Add the `EstoqueFamilia` type, right after the `EstoqueUnidadeInput` type (after line 43)**

```typescript
// Família de peça (migration_056) — agrupa N fichas (Estoque) sob um nome
// comum ("Tanque de Combustível CG 125"), cada ficha mantendo seu próprio
// modelo_moto_id. Opcional: peça sem família (familia_id null) continua se
// comportando exatamente como antes.
export interface EstoqueFamilia {
  id: string;
  nome: string;
  categoria_id: string | null;
  descricao: string | null;
  imagem_url: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type EstoqueFamiliaInput = Pick<EstoqueFamilia, 'nome' | 'categoria_id' | 'descricao' | 'imagem_url'>;
```

- [ ] **Step 2: Add `familia_id`/`familia` to the `Estoque` interface, right after the `modelos_compativeis` field (after line 260)**

```typescript
  // Família de peça (migration_056) — quando preenchido, esta ficha faz
  // parte de um agrupamento maior mostrado como 1 linha só na tabela de
  // Estoque. null = peça avulsa, comportamento idêntico ao que já existia.
  familia_id: string | null;
  // Populado pelo backend via join em estoque_familias (anexarFamilias).
  // Ausente em payloads antigos em cache — sempre tratar como opcional.
  familia?: EstoqueFamilia | null;
```

- [ ] **Step 3: Add `familia_id` to `EstoqueInput`'s `Pick` list**

Find:
```typescript
export type EstoqueInput = Pick<
  Estoque,
  | 'nome'
  | 'categoria_id'
  | 'modelo_moto_id'
  | 'condicao'
  | 'condicao_nota'
  | 'nota_cadastro'
  | 'ano'
  | 'valor'
  | 'quantidade'
  | 'imagens'
  | 'descricao'
  | 'ativo'
  | 'componentes'
  | 'anuncio_fb_url'
> & {
```

Replace with:
```typescript
export type EstoqueInput = Pick<
  Estoque,
  | 'nome'
  | 'categoria_id'
  | 'modelo_moto_id'
  | 'condicao'
  | 'condicao_nota'
  | 'nota_cadastro'
  | 'ano'
  | 'valor'
  | 'quantidade'
  | 'imagens'
  | 'descricao'
  | 'ativo'
  | 'componentes'
  | 'anuncio_fb_url'
  | 'familia_id'
> & {
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: no new TypeScript errors (this is a pure type addition — nothing consumes the new fields yet, so no other file should break).

- [ ] **Step 5: Commit**

```bash
git add src/features/estoque/types.ts
git commit -m "feat(estoque): adiciona tipos EstoqueFamilia e Estoque.familia_id"
```

---

### Task 4: Shared aggregation helpers — `familiaEstoque.ts`

**Files:**
- Create: `src/features/estoque/familiaEstoque.ts`
- Create: `src/features/estoque/familiaEstoque.test.ts`

**Interfaces:**
- Consumes: `Estoque`, `EstoqueUnidade` from `./types`; `valorTotalEstoque`, `valorDaUnidade`, `contarAvarias` from `./valorEstoque`; `extrairAnoOrdenavel` from `../motos/motoTree`.
- Produces (consumed by Plano C's table/modal work): `agruparPorModelo(itens: Estoque[]): GrupoModeloFamilia[]`, `contarModelosFamilia(itens: Estoque[]): number`, `faixaPrecoFamilia(itens: Estoque[]): { min: number; max: number } | null`, `emEstoqueFamilia(itens: Estoque[]): number`, `variacoesFamilia(itens: Estoque[]): number`, `comAvariaFamilia(itens: Estoque[]): number`, `valorEmEstoqueFamilia(itens: Estoque[]): number`, and the `GrupoModeloFamilia` interface.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/estoque/familiaEstoque.test.ts
import { describe, it, expect } from 'vitest';
import {
  agruparPorModelo,
  contarModelosFamilia,
  faixaPrecoFamilia,
  emEstoqueFamilia,
  variacoesFamilia,
  comAvariaFamilia,
  valorEmEstoqueFamilia,
} from './familiaEstoque';
import type { Estoque, EstoqueUnidade } from './types';

function mockUnidade(overrides: Partial<EstoqueUnidade> = {}): EstoqueUnidade {
  return {
    id: 'u1',
    estoque_id: 'e1',
    apelido: null,
    avaria: false,
    avaria_descricao: null,
    fotos: [],
    valor: null,
    condicao_nota: null,
    vendida_em: null,
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockItem(overrides: Partial<Estoque> = {}): Estoque {
  return {
    id: 'e1',
    codigo: 'RK-0001',
    nome: 'Tanque de Combustível',
    categoria_id: null,
    modelo_moto_id: 'm1',
    modelo_moto: { id: 'm1', nome: 'CG 125', parent_id: null, ordem: 0, ano: '2004-2008', criado_em: '2026-01-01T00:00:00Z' } as any,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-01-01T00:00:00Z',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    familia_id: 'f1',
    unidades: [],
    ...overrides,
  };
}

describe('agruparPorModelo', () => {
  it('returns an empty array for no items', () => {
    expect(agruparPorModelo([])).toEqual([]);
  });

  it('groups items with the same modelo_moto_id together', () => {
    const a = mockItem({ id: 'a' });
    const b = mockItem({ id: 'b' });
    const grupos = agruparPorModelo([a, b]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts groups by starting year, oldest first', () => {
    const antigo = mockItem({
      id: 'antigo',
      modelo_moto_id: 'm-antigo',
      modelo_moto: { id: 'm-antigo', nome: 'CG 125 Titan 99', parent_id: null, ordem: 0, ano: '1999', criado_em: '' } as any,
    });
    const novo = mockItem({
      id: 'novo',
      modelo_moto_id: 'm-novo',
      modelo_moto: { id: 'm-novo', nome: 'CG 125 Fan', parent_id: null, ordem: 0, ano: '2009-2013', criado_em: '' } as any,
    });
    const grupos = agruparPorModelo([novo, antigo]);
    expect(grupos.map((g) => g.modeloMotoId)).toEqual(['m-antigo', 'm-novo']);
  });

  it('puts items with no modelo (null ano) last', () => {
    const semModelo = mockItem({ id: 'sem', modelo_moto_id: null, modelo_moto: null });
    const comModelo = mockItem({
      id: 'com',
      modelo_moto_id: 'm1',
      modelo_moto: { id: 'm1', nome: 'CG 125', parent_id: null, ordem: 0, ano: '2010', criado_em: '' } as any,
    });
    const grupos = agruparPorModelo([semModelo, comModelo]);
    expect(grupos.map((g) => g.modeloMotoId)).toEqual(['m1', null]);
  });
});

describe('contarModelosFamilia', () => {
  it('counts distinct modelo_moto_id, ignoring null', () => {
    const a = mockItem({ id: 'a', modelo_moto_id: 'm1' });
    const b = mockItem({ id: 'b', modelo_moto_id: 'm1' });
    const c = mockItem({ id: 'c', modelo_moto_id: 'm2' });
    const d = mockItem({ id: 'd', modelo_moto_id: null });
    expect(contarModelosFamilia([a, b, c, d])).toBe(2);
  });
});

describe('faixaPrecoFamilia', () => {
  it('returns null for an empty family', () => {
    expect(faixaPrecoFamilia([])).toBeNull();
  });

  it('returns the same min/max when every unit costs the same', () => {
    const item = mockItem({ valor: 480, quantidade: 2, unidades: [] });
    expect(faixaPrecoFamilia([item])).toEqual({ min: 480, max: 480 });
  });

  it('spans min/max across different fichas and unit-level overrides', () => {
    const barato = mockItem({ id: 'a', valor: 380, quantidade: 1, unidades: [] });
    const caro = mockItem({
      id: 'b',
      valor: 480,
      quantidade: 1,
      unidades: [mockUnidade({ id: 'u-cara', valor: 520 })],
    });
    expect(faixaPrecoFamilia([barato, caro])).toEqual({ min: 380, max: 520 });
  });
});

describe('emEstoqueFamilia', () => {
  it('sums quantidade across all fichas', () => {
    const a = mockItem({ id: 'a', quantidade: 2 });
    const b = mockItem({ id: 'b', quantidade: 3 });
    expect(emEstoqueFamilia([a, b])).toBe(5);
  });
});

describe('variacoesFamilia', () => {
  it('falls back to quantidade when unidades is not populated yet', () => {
    const item = mockItem({ quantidade: 4, unidades: undefined });
    expect(variacoesFamilia([item])).toBe(4);
  });

  it('counts unidades rows (including sold ones) when populated', () => {
    const item = mockItem({
      quantidade: 1,
      unidades: [mockUnidade({ id: 'u1' }), mockUnidade({ id: 'u2', vendida_em: '2026-01-01T00:00:00Z' })],
    });
    expect(variacoesFamilia([item])).toBe(2);
  });
});

describe('comAvariaFamilia', () => {
  it('sums avaria count across fichas, ignoring sold units', () => {
    const item = mockItem({
      unidades: [
        mockUnidade({ id: 'u1', avaria: true }),
        mockUnidade({ id: 'u2', avaria: true, vendida_em: '2026-01-01T00:00:00Z' }),
      ],
    });
    expect(comAvariaFamilia([item])).toBe(1);
  });
});

describe('valorEmEstoqueFamilia', () => {
  it('sums valorTotalItem across fichas', () => {
    const a = mockItem({ id: 'a', valor: 100, quantidade: 1, unidades: [] });
    const b = mockItem({ id: 'b', valor: 200, quantidade: 1, unidades: [] });
    expect(valorEmEstoqueFamilia([a, b])).toBe(300);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- familiaEstoque`
Expected: FAIL — `Cannot find module './familiaEstoque'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/estoque/familiaEstoque.ts
// Agregações puras sobre as fichas-filhas de uma família de peça (ver
// docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md).
// Vive fora da UI de propósito — os mesmos números precisam bater na linha
// da tabela e no header do modal de família, e outros módulos (Vendas,
// Orçamentos) podem reaproveitar isso mais tarde sem reescrever nada.
import type { Estoque } from './types';
import { valorTotalEstoque, valorDaUnidade, contarAvarias } from './valorEstoque';
import { extrairAnoOrdenavel } from '../motos/motoTree';

export interface GrupoModeloFamilia {
  modeloMotoId: string | null;
  nomeModelo: string;
  ano: string | null;
  itens: Estoque[];
}

// Agrupa as fichas-filhas por modelo_moto_id e ordena os grupos do modelo
// mais antigo pro mais novo (extraindo o 1º ano numérico de modelo_moto.ano
// — ver extrairAnoOrdenavel). Fichas sem modelo (ano indefinido) vão pro
// final.
export function agruparPorModelo(itens: Estoque[]): GrupoModeloFamilia[] {
  const porModelo = new Map<string, GrupoModeloFamilia>();

  for (const item of itens) {
    const chave = item.modelo_moto_id ?? '__sem_modelo__';
    const existente = porModelo.get(chave);
    if (existente) {
      existente.itens.push(item);
    } else {
      porModelo.set(chave, {
        modeloMotoId: item.modelo_moto_id,
        nomeModelo: item.modelo_moto?.nome ?? 'Sem modelo',
        ano: item.modelo_moto?.ano ?? null,
        itens: [item],
      });
    }
  }

  return Array.from(porModelo.values()).sort((a, b) => {
    const anoA = extrairAnoOrdenavel(a.ano);
    const anoB = extrairAnoOrdenavel(b.ano);
    if (anoA === null && anoB === null) return 0;
    if (anoA === null) return 1;
    if (anoB === null) return -1;
    return anoA - anoB;
  });
}

export function contarModelosFamilia(itens: Estoque[]): number {
  const ids = new Set(itens.map((item) => item.modelo_moto_id).filter((id): id is string => !!id));
  return ids.size;
}

// Preço mínimo/máximo entre as unidades DISPONÍVEIS (não vendidas) de todas
// as fichas — reaproveita valorDaUnidade (herança) pra cada unidade fichada
// e o valor padrão da peça pra cada unidade "em branco".
export function faixaPrecoFamilia(itens: Estoque[]): { min: number; max: number } | null {
  const precos: number[] = [];

  for (const item of itens) {
    const disponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em);
    for (const unidade of disponiveis) precos.push(valorDaUnidade(unidade, item.valor));
    const semFicha = Math.max(0, (Number(item.quantidade) || 0) - disponiveis.length);
    for (let i = 0; i < semFicha; i++) precos.push(Number(item.valor) || 0);
  }

  if (precos.length === 0) return null;
  return { min: Math.min(...precos), max: Math.max(...precos) };
}

// "Em estoque" no header do modal — soma de quantidade (já é o número de
// unidades disponíveis: registrar_venda decrementa a cada venda, com ou sem
// ficha vinculada).
export function emEstoqueFamilia(itens: Estoque[]): number {
  return itens.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
}

// "Variações" no header do modal — total de unidades físicas já
// cadastradas (disponíveis + vendidas). Cai pra quantidade quando `unidades`
// ainda não veio populado (ambiente sem a migration_057 rodada).
export function variacoesFamilia(itens: Estoque[]): number {
  return itens.reduce((soma, item) => soma + (item.unidades ? item.unidades.length : Number(item.quantidade) || 0), 0);
}

export function comAvariaFamilia(itens: Estoque[]): number {
  return itens.reduce((soma, item) => soma + contarAvarias(item), 0);
}

export function valorEmEstoqueFamilia(itens: Estoque[]): number {
  return valorTotalEstoque(itens);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- familiaEstoque`
Expected: PASS (all `describe` blocks green).

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/estoque/familiaEstoque.ts src/features/estoque/familiaEstoque.test.ts
git commit -m "feat(estoque): helpers de agregação de família (familiaEstoque.ts)"
```

---

### Task 5: Backend — `anexarFamilias` + `familia_id` editável

**Files:**
- Modify: `src/server/routes/estoque.ts`
- Modify: `src/server/routes/estoque.test.ts`

**Interfaces:**
- Produces: `anexarFamilias(supabase, itens): Promise<any[]>` (attaches `item.familia`), `familia_id` accepted by `montarPayload`/`CAMPOS_EDITAVEIS`.

- [ ] **Step 1: Write the failing test**

```typescript
// Add to src/server/routes/estoque.test.ts
import { describe, it, expect } from 'vitest';
import { SELECT_COM_JOINS, montarPayload } from './estoque.js';

// ...(keep the existing describe('SELECT_COM_JOINS', ...) block above)...

describe('SELECT_COM_JOINS (família)', () => {
  it('não embute estoque_familias no select principal', () => {
    // O select principal não deve tentar embutir estoque_familias — isso
    // quebraria a listagem inteira se a migration_056 não tiver rodado
    // ainda, o mesmo motivo pelo qual unidades/compatibilidades também
    // ficam fora do SELECT_COM_JOINS. Ver anexarFamilias (consulta separada).
    expect(SELECT_COM_JOINS).not.toContain('estoque_familias');
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- estoque.test`
Expected: FAIL — `montarPayload` is not exported yet (`SyntaxError`/`undefined is not a function`), and even once exported, the `familia_id` cases fail because nothing normalizes that field yet.

- [ ] **Step 3: Implement `anexarFamilias`**

In `src/server/routes/estoque.ts`, add this function right after `anexarCompatibilidades` (after line 103):

```typescript
// Família de peça (migration_056) — mesma degradação graciosa de
// anexarCompatibilidades: enquanto a migração não rodar em produção, a
// tabela não existe e o estoque continua funcionando normalmente, cada
// peça simplesmente sem família.
async function anexarFamilias(supabase: SupabaseClient, itens: any[]): Promise<any[]> {
  if (itens.length === 0) return itens;

  const { data, error } = await supabase.from('estoque_familias').select('*');

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('⚠️ Tabela estoque_familias ausente — rode supabase/migration_056_estoque_familias.sql pra habilitar famílias de peça.');
    } else {
      console.error('Erro ao buscar famílias de estoque:', error);
    }
    return itens.map((item) => ({ ...item, familia: null }));
  }

  const porId = new Map<string, any>();
  for (const familia of data ?? []) porId.set(familia.id, familia);

  return itens.map((item) => ({ ...item, familia: item.familia_id ? porId.get(item.familia_id) ?? null : null }));
}
```

- [ ] **Step 4: Wire it into the read/write chains**

In `router.get('/')` (around line 449-455), change:
```typescript
      const comUnidades = await anexarUnidades(supabase, data);
      const comCompatibilidades = await anexarCompatibilidades(supabase, comUnidades);
      const comAnunciosMl = await anexarAnunciosMl(supabase, comCompatibilidades);
```
to:
```typescript
      const comUnidades = await anexarUnidades(supabase, data);
      const comCompatibilidades = await anexarCompatibilidades(supabase, comUnidades);
      const comFamilias = await anexarFamilias(supabase, comCompatibilidades);
      const comAnunciosMl = await anexarAnunciosMl(supabase, comFamilias);
```

In `router.get('/:id')` (around line 466-469), change:
```typescript
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [comUnidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comCompatibilidades]);
```
to:
```typescript
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [comUnidades]);
      const [comFamilias] = await anexarFamilias(supabase, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comFamilias]);
```

In `router.post('/')` (around line 497-499), change:
```typescript
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [{ ...data, unidades: [] }]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comCompatibilidades]);
```
to:
```typescript
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [{ ...data, unidades: [] }]);
      const [comFamilias] = await anexarFamilias(supabase, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comFamilias]);
```

In `atualizarItem` (around line 542-544), change:
```typescript
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [comUnidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comCompatibilidades]);
```
to:
```typescript
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [comUnidades]);
      const [comFamilias] = await anexarFamilias(supabase, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comFamilias]);
```

- [ ] **Step 5: Make `familia_id` editable and export `montarPayload` for testing**

Change `function montarPayload(body: any) {` (line 407) to `export function montarPayload(body: any) {` — needed so Step 1's test can import it directly, same convention as `SELECT_COM_JOINS` already being exported.

In `CAMPOS_EDITAVEIS` (line 390-405), add `'familia_id'` at the end of the array:
```typescript
const CAMPOS_EDITAVEIS = [
  'nome',
  'categoria_id',
  'modelo_moto_id',
  'condicao',
  'condicao_nota',
  'nota_cadastro',
  'ano',
  'valor',
  'quantidade',
  'imagens',
  'descricao',
  'ativo',
  'componentes',
  'anuncio_fb_url',
  'familia_id',
] as const;
```

In `montarPayload` (line 407-428), add right after the `componentes` handling block:
```typescript
  // null explícito desvincula a peça da família (ver rodapé "Excluir" da
  // spec — desvincular em vez de apagar quando há venda no histórico).
  if (payload.familia_id !== undefined) payload.familia_id = payload.familia_id || null;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- estoque.test`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/server/routes/estoque.ts src/server/routes/estoque.test.ts
git commit -m "feat(estoque): anexa família na listagem e permite editar familia_id"
```

---

### Task 6: Backend — `sincronizarUnidades` wiring

**Files:**
- Modify: `src/server/routes/estoque.ts`

**Interfaces:**
- Consumes: SQL function `sincronizar_unidades_estoque` (Task 2).
- Produces: `sincronizarUnidades(supabase, estoqueId, quantidade): Promise<string | null>` (mirrors the existing `sincronizarCompatibilidades` return shape: `null` = ok, `string` = error message to surface as a 400).

- [ ] **Step 1: Implement the wrapper**

In `src/server/routes/estoque.ts`, add this function right after `sincronizarCompatibilidades` (after line 388):

```typescript
// Mantém estoque_unidades com exatamente `quantidade` linhas (ver
// migration_057) — chamada toda vez que a rota grava quantidade. Mesma
// degradação graciosa das demais funções anexar*/sincronizar*: enquanto a
// migração não rodou, a função RPC não existe e isso só avisa no log.
async function sincronizarUnidades(supabase: SupabaseClient, estoqueId: string, quantidade: number): Promise<string | null> {
  const { error } = await supabase.rpc('sincronizar_unidades_estoque', {
    p_estoque_id: estoqueId,
    p_quantidade_alvo: quantidade,
  });
  if (!error) return null;

  if (error.code === '42883' || error.code === 'PGRST202' || error.code === 'PGRST205') {
    console.warn('⚠️ Função sincronizar_unidades_estoque ausente — rode supabase/migration_057_estoque_unidades_explicitas.sql pra habilitar unidades sempre explícitas.');
    return null;
  }
  return error.message;
}
```

- [ ] **Step 2: Wire it into `router.post('/')` (create)**

After the line `const { data, error } = await supabase.from('estoque').insert([payload]).select(SELECT_COM_JOINS).single();` and its `if (error) throw error;` check (around line 489-490), add:

```typescript
      const erroSync = await sincronizarUnidades(supabase, data.id, data.quantidade);
      if (erroSync) return res.status(400).json({ success: false, error: erroSync });
```

- [ ] **Step 3: Wire it into `atualizarItem` (PUT/PATCH)**

Right after `const { data, error } = await supabase.from('estoque').update(payload).eq('id', req.params.id).select(SELECT_COM_JOINS).single();` and its `if (error) throw error;` (around line 530-531), and before the `sincronizarCompatibilidades` call, add:

```typescript
      if (payload.quantidade !== undefined) {
        const erroSync = await sincronizarUnidades(supabase, req.params.id, data.quantidade);
        if (erroSync) return res.status(400).json({ success: false, error: erroSync });
      }
```

(Guarded by `payload.quantidade !== undefined` so an edit that doesn't touch quantity — e.g. only `descricao` — doesn't fire an RPC call every time.)

- [ ] **Step 4: Wire it into `bulk-update-quantidade`**

In the loop inside `router.post('/bulk-update-quantidade', ...)` (around line 1054-1057), change:
```typescript
      for (const item of itens || []) {
        const novaQuantidade = Math.max(0, Number(item.quantidade) + delta);
        const { error: updateError } = await supabase.from('estoque').update({ quantidade: novaQuantidade }).eq('id', item.id);
        if (updateError) throw updateError;
      }
```
to:
```typescript
      for (const item of itens || []) {
        const novaQuantidade = Math.max(0, Number(item.quantidade) + delta);
        const { error: updateError } = await supabase.from('estoque').update({ quantidade: novaQuantidade }).eq('id', item.id);
        if (updateError) throw updateError;

        const erroSync = await sincronizarUnidades(supabase, item.id, novaQuantidade);
        if (erroSync) return res.status(400).json({ success: false, error: `Peça ${item.id}: ${erroSync}` });
      }
```

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verification against a Supabase project with migration_057 applied**

There's no automated test for this — `sincronizarUnidades` is a thin RPC wrapper around SQL logic already verified in Task 2. Verify the wiring end-to-end instead:
1. Start the dev server (`npm run dev`) against a Supabase project with migrations 002-057 applied.
2. `POST /api/estoque` with `quantidade: 3` for a new peça — confirm (via Supabase table editor or `GET /api/estoque/:id/unidades`) that 3 blank `estoque_unidades` rows were created.
3. `PATCH /api/estoque/:id` with `quantidade: 5` — confirm 2 more blank rows appeared.
4. `PATCH /api/estoque/:id` with `quantidade: 2` — confirm 3 blank rows were removed (the newest ones), leaving exactly 2.
5. Manually mark one remaining unit's `apelido` via `PATCH /api/estoque/:id/unidades/:unidadeId`, then `PATCH /api/estoque/:id` with `quantidade: 0` — confirm the response is a 400 with the "Reduza a quantidade..." message, and that no unidade was deleted.

- [ ] **Step 7: Commit**

```bash
git add src/server/routes/estoque.ts
git commit -m "feat(estoque): sincroniza estoque_unidades com quantidade em toda escrita"
```

---

### Task 7: Backend — `estoqueFamiliasRouter` (CRUD)

**Files:**
- Create: `src/server/routes/estoqueFamilias.ts`
- Create: `src/server/routes/estoqueFamilias.test.ts`
- Modify: `server.ts`

**Interfaces:**
- Produces: `estoqueFamiliasRouter(supabase): Router` mounted at `/api/estoque-familias`; exported `montarPayloadFamilia(body): Record<string, any>` for testing.
- Routes: `GET /`, `POST /`, `PUT /:id`, `PATCH /:id`, `DELETE /:id`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/server/routes/estoqueFamilias.test.ts
import { describe, it, expect } from 'vitest';
import { montarPayloadFamilia } from './estoqueFamilias.js';

describe('montarPayloadFamilia', () => {
  it('trims nome when present', () => {
    expect(montarPayloadFamilia({ nome: '  Tanque de Combustível CG 125  ' })).toEqual({ nome: 'Tanque de Combustível CG 125' });
  });

  it('omits nome from the payload when not provided (partial update)', () => {
    expect(montarPayloadFamilia({ descricao: 'nova descrição' })).toEqual({ descricao: 'nova descrição' });
  });

  it('normalizes empty categoria_id/imagem_url to null', () => {
    expect(montarPayloadFamilia({ categoria_id: '', imagem_url: '' })).toEqual({ categoria_id: null, imagem_url: null });
  });

  it('trims descricao and turns empty string into null', () => {
    expect(montarPayloadFamilia({ descricao: '   ' })).toEqual({ descricao: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- estoqueFamilias.test`
Expected: FAIL — `Cannot find module './estoqueFamilias.js'`.

- [ ] **Step 3: Write the router**

```typescript
// src/server/routes/estoqueFamilias.ts
// CRUD de famílias de peça (migration_056) — agrupam N fichas de estoque
// sob um nome comum. Ver
// docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

const VER = exigirPermissao('estoque.ver');
const CRIAR = exigirPermissao('estoque.criar');
const EDITAR = exigirPermissao('estoque.editar');
const DELETAR = exigirPermissao('estoque.deletar');

// Só extrai/normaliza os campos presentes no body — não valida nome
// obrigatório aqui, porque PATCH parcial pode não mandar nome nenhum.
// Cada rota que precisa exigir nome (POST, e PUT/PATCH quando o campo vem)
// valida isso na própria mão, mesmo padrão de montarPayload em estoque.ts.
export function montarPayloadFamilia(body: any): Record<string, any> {
  const payload: Record<string, any> = {};
  if (body?.nome !== undefined) payload.nome = String(body.nome).trim();
  if (body?.categoria_id !== undefined) payload.categoria_id = body.categoria_id || null;
  if (body?.descricao !== undefined) payload.descricao = body.descricao ? String(body.descricao).trim() || null : null;
  if (body?.imagem_url !== undefined) payload.imagem_url = body.imagem_url || null;
  return payload;
}

export function estoqueFamiliasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', VER, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('estoque_familias').select('*').order('nome');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar famílias de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', CRIAR, async (req, res) => {
    try {
      const payload = montarPayloadFamilia(req.body);
      if (!payload.nome) return res.status(400).json({ success: false, error: 'Nome da família é obrigatório' });

      const { data, error } = await supabase.from('estoque_familias').insert([payload]).select('*').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar família de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const atualizarFamilia = async (req: any, res: any) => {
    try {
      const payload = montarPayloadFamilia(req.body);
      if (payload.nome !== undefined && !payload.nome) {
        return res.status(400).json({ success: false, error: 'Nome da família é obrigatório' });
      }

      const { data, error } = await supabase.from('estoque_familias').update(payload).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar família de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  router.put('/:id', EDITAR, atualizarFamilia);
  router.patch('/:id', EDITAR, atualizarFamilia);

  router.delete('/:id', DELETAR, async (req, res) => {
    try {
      // Bloqueia exclusão se qualquer ficha da família já tiver unidade
      // vendida — preserva histórico de venda (ver spec, rodapé "Excluir").
      const { data: fichas, error: erroFichas } = await supabase.from('estoque').select('id').eq('familia_id', req.params.id);
      if (erroFichas) throw erroFichas;

      const idsFichas = (fichas ?? []).map((f: any) => f.id);
      if (idsFichas.length > 0) {
        const { count, error: erroVendidas } = await supabase
          .from('estoque_unidades')
          .select('id', { count: 'exact', head: true })
          .in('estoque_id', idsFichas)
          .not('vendida_em', 'is', null);

        if (erroVendidas && erroVendidas.code !== '42P01' && erroVendidas.code !== 'PGRST205') {
          throw erroVendidas;
        }
        if (!erroVendidas && (count ?? 0) > 0) {
          return res.status(409).json({
            success: false,
            error: 'Esta família tem unidade(s) já vendida(s) — desvincule as peças em vez de excluir, pra preservar o histórico de venda.',
          });
        }
      }

      const { error } = await supabase.from('estoque_familias').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir família de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- estoqueFamilias.test`
Expected: PASS.

- [ ] **Step 5: Mount the router**

In `server.ts`, add the import next to the existing `estoqueRouter` import (line 23):
```typescript
import { estoqueRouter } from './src/server/routes/estoque.js';
import { estoqueFamiliasRouter } from './src/server/routes/estoqueFamilias.js';
```

And mount it right after `app.use('/api/estoque', estoqueRouter(supabase));` (line 325):
```typescript
  app.use('/api/estoque', estoqueRouter(supabase));
  app.use('/api/estoque-familias', estoqueFamiliasRouter(supabase));
```

- [ ] **Step 6: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/server/routes/estoqueFamilias.ts src/server/routes/estoqueFamilias.test.ts server.ts
git commit -m "feat(estoque): CRUD de famílias de peça (/api/estoque-familias)"
```

---

### Task 8: Frontend — `estoqueFamiliasApi`

**Files:**
- Modify: `src/features/estoque/api.ts`

**Interfaces:**
- Produces: `estoqueFamiliasApi.{listar, criar, atualizar, excluir}` — thin 1:1 wrappers around Task 7's routes, following the exact style of the existing `estoqueApi` object. Not consumed by any UI yet (Plano C wires these into components).

- [ ] **Step 1: Add the type import**

In `src/features/estoque/api.ts`, add `EstoqueFamilia` and `EstoqueFamiliaInput` to the existing type import block (lines 4-17):
```typescript
import type {
  Estoque,
  EstoqueInput,
  EstoqueUnidade,
  EstoqueUnidadeInput,
  EstoqueFamilia,
  EstoqueFamiliaInput,
  EstoqueAnuncioMl,
  EstoqueAnuncioMlInput,
  ConfiguracaoAnuncioMlInput,
  ResultadoPublicacaoMl,
  EstatisticasAnuncioMl,
  EstoqueAnuncioShopee,
  ConfiguracaoAnuncioShopeeInput,
  ResultadoPublicacaoShopee,
} from './types';
```

- [ ] **Step 2: Add the API object**

At the end of the file, right after the `estoqueApi` object closes (after line 80, before the `uploadImagemEstoque` function), add:

```typescript
// Famílias de peça (migration_056) — CRUD simples, sem aninhamento (não
// existem fora de /api/estoque-familias, diferente de unidades/anúncios).
export const estoqueFamiliasApi = {
  listar: () => api.get('/api/estoque-familias') as Promise<ApiResult<EstoqueFamilia[]>>,
  criar: (payload: EstoqueFamiliaInput) => api.post('/api/estoque-familias', payload) as Promise<ApiResult<EstoqueFamilia>>,
  atualizar: (id: string, payload: Partial<EstoqueFamiliaInput>) =>
    api.patch(`/api/estoque-familias/${id}`, payload) as Promise<ApiResult<EstoqueFamilia>>,
  excluir: (id: string) => api.delete(`/api/estoque-familias/${id}`) as Promise<ApiResult<null>>,
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/estoque/api.ts
git commit -m "feat(estoque): client HTTP de famílias de peça (estoqueFamiliasApi)"
```

---

## End-to-end verification

After all 8 tasks:

- [ ] Run `npm test` — full suite green (this plan added `familiaEstoque.test.ts` and `estoqueFamilias.test.ts`, and extended `estoque.test.ts`).
- [ ] Run `npm run lint` — no TypeScript errors.
- [ ] Confirm `GET /api/estoque` still returns every existing peça unchanged (each item now additionally carries `familia: null`) — regression check against a Supabase project without migrations 056/057 applied, then again with them applied.
- [ ] Confirm `POST /api/estoque-familias` creates a família, and `PATCH /api/estoque/:id` with a `familia_id` links a peça to it — `GET /api/estoque` then shows that peça's `familia` populated.

This plan deliberately stops here — no table row, no modal, no component. That's Plano C ("Interface de família"), which consumes `familiaEstoque.ts` and the `familia`-aware `/api/estoque` payload built here.
