# Estoque por Gavetas — Fase 1 (Setup + CRUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o estoque existente pelo conceito de **gavetas** (Gaveta → Variante → Unidade), aposentando famílias, sem recadastrar nem duplicar nenhuma peça.

**Architecture:** Gaveta = tabela nova `gavetas` + coluna `estoque.gaveta_id` (null = "não agrupado"). Variante = linha de `estoque` (já existe). Unidade = `estoque_unidades` promovida a item de primeira classe (`apelido`→`nome`, + `descricao`). Backend CRUD novo de gavetas; UI nova em `src/features/estoque/gaveta/` convivendo com a de famílias (nada é apagado nesta fase). Stats computadas no domínio, sem views novas.

**Tech Stack:** React 19 + TypeScript + Vite 6, Tailwind v4 (CSS-first, tokens em `src/styles/theme.css`), Supabase (PostgreSQL + Storage), @tanstack/react-query 5, @tanstack/react-router 1, motion 12, animate-ui, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-estoque-gavetas-fase1-design.md`

## Global Constraints

- **O estoque é o mesmo.** `estoque` e `estoque_unidades` são a fonte da verdade; nada é recadastrado ou duplicado. Nenhuma conversão automática família→gaveta.
- **Nada do conceito de famílias é reaproveitado** em código novo. Não importar de `familiaEstoque.ts`, `estoqueFamilias.ts` ou `EstoqueFamiliaModal`. A UI de famílias **não é apagada** nesta fase.
- **Rename é global e atômico com o deploy:** `estoque_unidades.apelido` → `nome`. Não degrada graciosamente (a coluna some). Migration 061 e a varredura de código sobem juntas. Número da próxima migration: **061**.
- **Preço pertence à UNIDADE.** Variante mostra faixa min~max computada, nunca um preço fixo.
- **Design tokens de `src/styles/theme.css`** — nunca hex cru; classes geradas (`bg-surface-card`, `text-text-primary`, `rounded-card`, `text-positive`, etc.). Máx. 1 botão accent preenchido por tela. Todo alerta tem ação. Hierarquia: número > label.
- **animate-ui** para componentes base (não criar do zero); custom (stats-row, filter-chips, currency-input) via Radix + Motion.
- **Interface pt-BR.** Moeda R$ com milhares `.` e decimal `,` (ex: `R$1.250,00`).
- **Mobile-first 375px.** Desktop (≥768px) fica para a Fase 4 — não bloquear esta fase, mas texto legível e alvos de toque ~40px+ (`h-11`) desde já (memória `mobile-e-desktop-igual`).
- **Backend:** service_role only, RLS habilitada sem policy (padrão do schema). Handlers assíncronos com `try/catch`. Servidor dev **não** recarrega backend sozinho — reiniciar `tsx server.ts` manualmente após mexer em rotas/services (memória `dev-server-manual-restart`).
- **Testes:** rodar de dentro do escopo, nunca `npm test` cru na raiz (contamina com worktrees — memória `npm-test-worktree-contamination`). Usar `npx vitest run <arquivo>`.
- **Fim da entrega:** adicionar item em `src/features/patchnotes/data.ts` (memória `sempre-atualizar-patchnotes`) — Task final.

**Fora de escopo (Fase 1):** venda/seleção de unidade (Fase 2), busca fuzzy (Fase 2), swipe/lote/toasts (Fase 3), tela de Migração T07 / layout desktop (Fase 4), remoção do código de famílias, chaves de permissão `gaveta.*`.

---

### Task 1: Migration 061 — gavetas, gaveta_id, rename apelido→nome, descricao

**Files:**
- Create: `supabase/migration_061_gavetas.sql`

**Interfaces:**
- Produces (no banco, após o dono rodar): tabela `gavetas(id, nome, categoria_id, icone, criado_em, atualizado_em)`; coluna `estoque.gaveta_id uuid` (nullable); `estoque_unidades.nome` (era `apelido`); `estoque_unidades.descricao text`.

Não há ciclo de teste automatizado para SQL — o dono roda no editor SQL do Supabase. Segue exatamente a convenção da migration_056 (trigger `set_atualizado_em`, RLS sem policy, `NOTIFY pgrst`).

- [ ] **Step 1: Escrever o arquivo de migration**

```sql
-- =============================================================================
-- RK Sucatas — Migração 061: gavetas (nova organização de estoque)
-- =============================================================================
-- Rode no editor SQL do Supabase (schema.sql + migrations 002 a 060).
--
-- Substitui o conceito de "famílias" pelo de "gavetas" (ver
-- docs/superpowers/specs/2026-09-10-estoque-gavetas-fase1-design.md).
-- A gaveta agrupa peças semelhantes; peça sem gaveta (gaveta_id null)
-- aparece como "ITENS NÃO AGRUPADOS". Organização 100% manual — nenhuma
-- conversão automática de família → gaveta. Famílias continua existindo em
-- paralelo nesta fase (nada é migrado nem apagado).
--
-- Também promove a unidade física a item de primeira classe: renomeia
-- estoque_unidades.apelido -> nome e adiciona descricao própria.
-- ATENÇÃO: a renomeação NÃO degrada graciosamente — suba o código junto.
-- =============================================================================

create table gavetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                          -- 100% manual, sem autocomplete
  categoria_id uuid references categorias(id) on delete set null,
  icone text,                                  -- emoji opcional (T01)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_gavetas_atualizado_em
  before update on gavetas
  for each row execute function set_atualizado_em();

alter table gavetas enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

alter table estoque add column if not exists gaveta_id uuid
  references gavetas(id) on delete set null;   -- null = item não agrupado
create index if not exists idx_estoque_gaveta on estoque(gaveta_id);

-- Unidade como item de primeira classe: nome próprio (renomeado de apelido) e
-- descricao própria. Demais campos (valor, fotos, avaria, avaria_descricao,
-- condicao_nota) já existem. Opcionais no schema; a UI exige só preço.
alter table estoque_unidades rename column apelido to nome;
alter table estoque_unidades add column if not exists descricao text;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Reler o arquivo e conferir**

Ler `supabase/migration_061_gavetas.sql` e confirmar: FK `categorias` com `on delete set null`; trigger nomeado `trg_gavetas_atualizado_em`; RLS habilitada; rename presente; `NOTIFY` no fim. Não rodar — é o dono quem roda.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_061_gavetas.sql
git commit -m "feat(estoque): migration 061 — gavetas, estoque.gaveta_id, unidade.nome/descricao"
```

---

### Task 2: Rename `apelido → nome` em tipos, backend e services

**Files:**
- Modify: `src/features/estoque/types.ts:21,43` (interface `EstoqueUnidade`, `EstoqueUnidadeInput`)
- Modify: `src/server/routes/estoque.ts:663-688` (`montarPayloadUnidade`)
- Modify: `src/server/routes/vendas.ts:13` (string de select)
- Modify: `src/services/shopeePublicacao.ts:152,215,292,294` (tipo local + selects + map)

**Interfaces:**
- Produces: `EstoqueUnidade.nome: string | null` (era `apelido`); `EstoqueUnidadeInput` inclui `'nome'` no `Pick` no lugar de `'apelido'`. Backend grava coluna `nome`.
- Consumes: nada de tasks anteriores (Task 1 é banco).

- [ ] **Step 1: Renomear no tipo `EstoqueUnidade`**

Em `src/features/estoque/types.ts`, trocar o campo e o comentário:

```ts
  /** Nome próprio desta unidade: "A amassada", "Sem bico injetor" */
  nome: string | null;
```

E em `EstoqueUnidadeInput`:

```ts
export type EstoqueUnidadeInput = Pick<EstoqueUnidade, 'nome' | 'avaria' | 'avaria_descricao' | 'fotos' | 'valor' | 'condicao_nota'>;
```

- [ ] **Step 2: Renomear no backend `montarPayloadUnidade`**

Em `src/server/routes/estoque.ts`, dentro de `montarPayloadUnidade` (linhas ~665-667):

```ts
    // body.nome/avaria_descricao === null (herança/campo limpo) precisa
    // virar null no banco, não a string "null" — String(null) === 'null'.
    if (body?.nome !== undefined) payload.nome = body.nome === null ? null : String(body.nome).trim() || null;
```

- [ ] **Step 3: Renomear no select de vendas**

Em `src/server/routes/vendas.ts:13`, trocar `estoque_unidades(id, apelido, ...)` por:

```ts
  '*, modelo_moto:modelos_moto(id, nome, ano), forma_pagamento:formas_pagamento(id, nome, natureza), cliente:clientes(id, nome, telefone), unidade:estoque_unidades(id, nome, avaria, avaria_descricao, fotos, valor)';
```

- [ ] **Step 4: Renomear em shopeePublicacao.ts**

Em `src/services/shopeePublicacao.ts`: tipo local (`:152`) `nome: string | null;`; select (`:292`) `.select('id, nome, valor, fotos')`; map (`:294`) `nome: u.nome ?? null`; label (`:215`) `unidadesPorId.get(v.unidadeId)!.nome?.trim() || ...`. Ajustar comentários que citam "apelido" para "nome".

- [ ] **Step 5: `tsc --noEmit` (espera erros nos consumidores ainda não migrados)**

Run: `npx tsc --noEmit`
Expected: erros APENAS em arquivos da Task 3 (UI/testes que ainda leem `.apelido`). Backend/types/services limpos. Isso confirma que a Task 3 é a única pendência do rename.

- [ ] **Step 6: Commit**

```bash
git add src/features/estoque/types.ts src/server/routes/estoque.ts src/server/routes/vendas.ts src/services/shopeePublicacao.ts
git commit -m "refactor(estoque): renomeia unidade apelido->nome (tipos, backend, shopee)"
```

---

### Task 3: Rename `apelido → nome` na UI e nos testes; `tsc` limpo

**Files:**
- Modify: `src/features/estoque/EstoqueFamiliaModal.tsx:108,134,149,242,381`
- Modify: `src/features/estoque/UnidadesEstoque.tsx:24,62,97,180,206,293,294,433` (campo do form + leituras)
- Modify: `src/features/estoque/RegistrarUnidadeDialog.tsx:25,34,54,63,73,173,423,424`
- Modify: `src/features/estoque/EstoqueItemExpandido.tsx:43`
- Modify: `src/features/estoque/planilha.ts:299,304`
- Modify: `src/features/vendas/VendasView.tsx:558`
- Modify: `src/features/estoque/EstoquePublicarMlModal.tsx:1149,1172`
- Modify: `src/features/estoque/EstoquePublicarShopeeModal.tsx:483` (linhas 14,463 são comentário/descrição textual — atualizar texto)
- Modify: `src/features/estoque/EstoqueView.tsx:602,873` (strings de `title` — só texto visível)
- Modify: `src/App.tsx:467` (comentário)
- Test: `src/features/estoque/EstoqueFamiliaModal.test.tsx:20`, `RegistrarUnidadeDialog.test.tsx:73,120,122`, `EstoqueItemExpandido.test.tsx:45,50,51`, `familiaEstoque.test.ts:19`

**Interfaces:**
- Consumes: `EstoqueUnidade.nome` da Task 2.

- [ ] **Step 1: Renomear leituras de `.apelido` para `.nome` nos componentes**

Substituir toda leitura de propriedade `unidade.apelido`/`u.apelido` por `.nome` e o fallback textual "Sem apelido" por "Sem nome". Em `UnidadesEstoque.tsx` e `RegistrarUnidadeDialog.tsx` o campo LOCAL do form também vira `nome` (`FORM_VAZIO`, `setForm`, `value=`, `form.nome`). Em `EstoqueFamiliaModal.tsx:381` o confirm vira `"${u.nome ?? 'Padrão'}"`. Manter a lógica intacta — só o nome do campo muda.

- [ ] **Step 2: Atualizar textos visíveis e comentários**

`EstoqueView.tsx:602,873` (title), `EstoquePublicarShopeeModal.tsx:14,463`, `App.tsx:467`, comentários em `UnidadesEstoque.tsx`/`planilha.ts`: onde o texto diz "apelido" como conceito de UI, trocar por "nome". (Não muda comportamento; mantém a base consistente.)

- [ ] **Step 3: Atualizar os mocks de teste**

Em cada `*.test.tsx`/`*.test.ts` listado, trocar a chave `apelido:` dos objetos `EstoqueUnidade` mockados por `nome:`. Ex. em `EstoqueItemExpandido.test.tsx:50`: `nome: 'A amassada'`. Ajustar títulos de `it(...)` que citam "apelido" para "nome".

- [ ] **Step 4: `tsc --noEmit` limpo**

Run: `npx tsc --noEmit`
Expected: PASS — zero erros. Nenhuma referência a `.apelido` restante em código de produção.

- [ ] **Step 5: Rodar os testes de estoque afetados**

Run: `npx vitest run src/features/estoque src/features/vendas`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/estoque src/features/vendas src/App.tsx
git commit -m "refactor(estoque): completa rename apelido->nome na UI e testes"
```

---

### Task 4: Adicionar `descricao` à unidade (tipo + backend)

**Files:**
- Modify: `src/features/estoque/types.ts` (`EstoqueUnidade`, `EstoqueUnidadeInput`)
- Modify: `src/server/routes/estoque.ts` (`montarPayloadUnidade`)
- Test: `src/server/routes/estoque.test.ts` (se existir teste de payload de unidade; senão, cobrir na Task 7 do domínio)

**Interfaces:**
- Produces: `EstoqueUnidade.descricao: string | null`; `EstoqueUnidadeInput` inclui `'descricao'`. Backend grava `descricao` (trim, null se vazio).

- [ ] **Step 1: Adicionar `descricao` ao tipo**

Em `EstoqueUnidade` (após `avaria_descricao`):

```ts
  /** Descrição geral própria da unidade (diferente de avaria_descricao, que é só sobre o defeito). */
  descricao: string | null;
```

E incluir `'descricao'` no `Pick` de `EstoqueUnidadeInput`.

- [ ] **Step 2: Adicionar `descricao` ao payload do backend**

Em `montarPayloadUnidade`, junto dos demais campos texto:

```ts
    if (body?.descricao !== undefined) payload.descricao = body.descricao === null ? null : String(body.descricao).trim() || null;
```

- [ ] **Step 3: `tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: PASS (campo opcional, não quebra chamadores existentes — `EstoqueUnidadeInput` é usado via `Partial` ou objetos completos; conferir `FORM_VAZIO` em `UnidadesEstoque.tsx` e adicionar `descricao: ''` lá se o TS exigir).

- [ ] **Step 4: Commit**

```bash
git add src/features/estoque/types.ts src/server/routes/estoque.ts src/features/estoque/UnidadesEstoque.tsx
git commit -m "feat(estoque): unidade ganha campo descricao proprio"
```

---

### Task 5: Domínio de gavetas — funções puras de agrupamento e stats

**Files:**
- Create: `src/features/estoque/gaveta/gavetaEstoque.ts`
- Test: `src/features/estoque/gaveta/gavetaEstoque.test.ts`

**Interfaces:**
- Produces:
  - `type LinhaGaveta = { tipo: 'gaveta'; id: string; gaveta: Gaveta; itens: Estoque[] } | { tipo: 'nao-agrupado'; id: 'nao-agrupado'; itens: Estoque[] }`
  - `agruparPorGaveta(itens: Estoque[], gavetas: Gaveta[]): LinhaGaveta[]` — uma linha por gaveta (mesmo vazia), mais UMA linha `nao-agrupado` no fim com as peças `gaveta_id == null` (omitida se não houver nenhuma).
  - `faixaPrecoVariante(item: Estoque): { min: number; max: number } | null` — min~max sobre unidades disponíveis (`!vendida_em`), herdando `estoque.valor` quando `unidade.valor` é null; peças sem ficha usam `estoque.valor`.
  - `faixaPrecoGaveta(itens: Estoque[]): { min: number; max: number } | null`
  - `statsGaveta(itens: Estoque[]): { variantes: number; unidadesDisponiveis: number; valorTotal: number; faixa: { min: number; max: number } | null }`
- Consumes: `Estoque`, `EstoqueUnidade` (types.ts); `valorDaUnidade` de `./valorEstoque` (reaproveitar herança de preço já testada — NÃO é código de famílias). `Gaveta` type (definir aqui ou em types.ts, ver Step 1).

Preço/herança já têm lógica pura em `src/features/estoque/valorEstoque.ts` — reusar `valorDaUnidade(unidade, item.valor)`. Isso NÃO é reaproveitar famílias; é reaproveitar o cálculo de preço por unidade, que é ortogonal.

- [ ] **Step 1: Definir o tipo `Gaveta` em `types.ts`**

Em `src/features/estoque/types.ts`:

```ts
// Gaveta (migration_061) — agrupamento manual de peças semelhantes. Substitui
// famílias. Peça sem gaveta (estoque.gaveta_id null) aparece em "itens não agrupados".
export interface Gaveta {
  id: string;
  nome: string;
  categoria_id: string | null;
  categoria?: Categoria | null; // join opcional do backend
  icone: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type GavetaInput = Pick<Gaveta, 'nome' | 'categoria_id' | 'icone'>;
```

E em `Estoque`, adicionar (perto de `familia_id`):

```ts
  // Gaveta (migration_061) — organização nova. null = item não agrupado.
  gaveta_id?: string | null;
  gaveta?: Gaveta | null; // join opcional do backend
```

- [ ] **Step 2: Escrever os testes que falham**

```ts
import { describe, it, expect } from 'vitest';
import { agruparPorGaveta, faixaPrecoVariante, faixaPrecoGaveta, statsGaveta } from './gavetaEstoque';
import type { Estoque, Gaveta } from '../types';

const gaveta = (id: string, nome: string): Gaveta =>
  ({ id, nome, categoria_id: null, icone: null, criado_em: '', atualizado_em: '' });

const peca = (over: Partial<Estoque>): Estoque =>
  ({ id: 'p', codigo: '', nome: '', categoria_id: null, modelo_moto_id: null, condicao: 'original',
     condicao_nota: null, nota_cadastro: null, ano: null, valor: 100, quantidade: 1, imagens: [],
     descricao: null, ativo: true, criado_em: '', atualizado_em: '', anuncio_ml_url: null,
     anuncio_fb_url: null, componentes: null, unidades_incompletas: [], ...over } as Estoque);

const un = (over: Partial<Estoque['unidades'] extends (infer U)[] | undefined ? U : never> = {}) =>
  ({ id: 'u', estoque_id: 'p', nome: null, descricao: null, avaria: false, avaria_descricao: null,
     fotos: [], valor: null, condicao_nota: null, criado_em: '', atualizado_em: '', ...over });

describe('agruparPorGaveta', () => {
  it('separa peças por gaveta e junta as sem gaveta em "não agrupado" no fim', () => {
    const g1 = gaveta('g1', 'Tanque CG 125');
    const itens = [
      peca({ id: 'a', gaveta_id: 'g1' }),
      peca({ id: 'b', gaveta_id: null }),
    ];
    const linhas = agruparPorGaveta(itens, [g1]);
    expect(linhas[0]).toMatchObject({ tipo: 'gaveta', id: 'g1' });
    expect(linhas[0].itens.map((i) => i.id)).toEqual(['a']);
    const naoAgrupado = linhas.find((l) => l.tipo === 'nao-agrupado');
    expect(naoAgrupado?.itens.map((i) => i.id)).toEqual(['b']);
  });

  it('inclui gaveta vazia e omite "não agrupado" quando tudo tem gaveta', () => {
    const g1 = gaveta('g1', 'Vazia');
    const linhas = agruparPorGaveta([peca({ id: 'a', gaveta_id: 'g1' })], [g1, gaveta('g2', 'Sem itens')]);
    expect(linhas.filter((l) => l.tipo === 'gaveta')).toHaveLength(2);
    expect(linhas.some((l) => l.tipo === 'nao-agrupado')).toBe(false);
  });
});

describe('faixaPrecoVariante', () => {
  it('usa min~max das unidades disponíveis, herdando o valor da peça quando null', () => {
    const item = peca({ valor: 100, quantidade: 2, unidades: [un({ id: 'u1', valor: 80 }), un({ id: 'u2', valor: null })] });
    expect(faixaPrecoVariante(item)).toEqual({ min: 80, max: 100 });
  });

  it('ignora unidades vendidas', () => {
    const item = peca({ valor: 100, quantidade: 2, unidades: [un({ id: 'u1', valor: 80, vendida_em: '2026-01-01' }), un({ id: 'u2', valor: 120 })] });
    expect(faixaPrecoVariante(item)).toEqual({ min: 120, max: 120 });
  });
});

describe('statsGaveta', () => {
  it('conta variantes, unidades disponíveis e soma valor', () => {
    const itens = [
      peca({ id: 'a', valor: 100, quantidade: 1, unidades: [un({ id: 'u1', valor: 100 })] }),
      peca({ id: 'b', valor: 50, quantidade: 2, unidades: [un({ id: 'u2', valor: 50 }), un({ id: 'u3', valor: 60 })] }),
    ];
    const s = statsGaveta(itens);
    expect(s.variantes).toBe(2);
    expect(s.unidadesDisponiveis).toBe(3);
    expect(s.faixa).toEqual({ min: 50, max: 100 });
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/features/estoque/gaveta/gavetaEstoque.test.ts`
Expected: FAIL ("agruparPorGaveta is not a function" / módulo inexistente).

- [ ] **Step 4: Implementar `gavetaEstoque.ts`**

```ts
// Agregações puras sobre gavetas/variantes/unidades. Fora da UI de propósito:
// os mesmos números aparecem na listagem (T01) e no detalhe (T02). NÃO
// reaproveita nada do módulo de famílias — só o cálculo de preço por unidade.
import type { Estoque, Gaveta } from '../types';
import { valorDaUnidade } from '../valorEstoque';

export type LinhaGaveta =
  | { tipo: 'gaveta'; id: string; gaveta: Gaveta; itens: Estoque[] }
  | { tipo: 'nao-agrupado'; id: 'nao-agrupado'; itens: Estoque[] };

export function agruparPorGaveta(itens: Estoque[], gavetas: Gaveta[]): LinhaGaveta[] {
  const porGaveta = new Map<string, Estoque[]>();
  const semGaveta: Estoque[] = [];
  for (const item of itens) {
    if (item.gaveta_id) {
      const atual = porGaveta.get(item.gaveta_id) ?? [];
      atual.push(item);
      porGaveta.set(item.gaveta_id, atual);
    } else {
      semGaveta.push(item);
    }
  }
  const linhas: LinhaGaveta[] = gavetas.map((g) => ({
    tipo: 'gaveta', id: g.id, gaveta: g, itens: porGaveta.get(g.id) ?? [],
  }));
  if (semGaveta.length > 0) linhas.push({ tipo: 'nao-agrupado', id: 'nao-agrupado', itens: semGaveta });
  return linhas;
}

// Preços das unidades DISPONÍVEIS (não vendidas), herdando estoque.valor
// quando a unidade não tem valor próprio; peças sem ficha usam estoque.valor.
function precosDisponiveis(item: Estoque): number[] {
  const precos: number[] = [];
  const disponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em);
  for (const u of disponiveis) precos.push(valorDaUnidade(u, item.valor));
  const semFicha = Math.max(0, (Number(item.quantidade) || 0) - disponiveis.length);
  for (let i = 0; i < semFicha; i++) precos.push(Number(item.valor) || 0);
  return precos;
}

export function faixaPrecoVariante(item: Estoque): { min: number; max: number } | null {
  const precos = precosDisponiveis(item);
  if (precos.length === 0) return null;
  return { min: Math.min(...precos), max: Math.max(...precos) };
}

export function faixaPrecoGaveta(itens: Estoque[]): { min: number; max: number } | null {
  const precos = itens.flatMap(precosDisponiveis);
  if (precos.length === 0) return null;
  return { min: Math.min(...precos), max: Math.max(...precos) };
}

export function statsGaveta(itens: Estoque[]) {
  const unidadesDisponiveis = itens.reduce((s, i) => s + precosDisponiveis(i).length, 0);
  const valorTotal = itens.flatMap(precosDisponiveis).reduce((s, p) => s + p, 0);
  return { variantes: itens.length, unidadesDisponiveis, valorTotal, faixa: faixaPrecoGaveta(itens) };
}
```

- [ ] **Step 5: Rodar o teste e confirmar PASS**

Run: `npx vitest run src/features/estoque/gaveta/gavetaEstoque.test.ts`
Expected: PASS. (Se `valorDaUnidade` tiver assinatura diferente, ler `src/features/estoque/valorEstoque.ts` e ajustar a chamada.)

- [ ] **Step 6: Commit**

```bash
git add src/features/estoque/gaveta/gavetaEstoque.ts src/features/estoque/gaveta/gavetaEstoque.test.ts src/features/estoque/types.ts
git commit -m "feat(estoque): dominio de gavetas (agrupamento + faixa de preco + stats)"
```

---

### Task 6: Backend — router CRUD de gavetas

**Files:**
- Create: `src/server/routes/gavetas.ts`
- Modify: `server.ts:23-24` (import) e `:326-327` (registro `app.use('/api/gavetas', ...)`)
- Test: `src/server/routes/gavetas.test.ts`

**Interfaces:**
- Produces (HTTP):
  - `GET /api/gavetas` → `{ success, data: Gaveta[] }` (com `categoria` via join)
  - `POST /api/gavetas` body `{ nome, categoria_id?, icone? }` → `{ success, data: Gaveta }` (400 se `nome` vazio)
  - `PATCH /api/gavetas/:id` body parcial → `{ success, data: Gaveta }`
  - `DELETE /api/gavetas/:id` → `{ success }` — solta as peças (`gaveta_id = null`), NÃO apaga peça nenhuma.
- Consumes: middleware `exigirPermissao('estoque.ver'|'estoque.criar'|'estoque.editar'|'estoque.deletar')` de `middleware/auth.js` (reusar chaves de estoque nesta fase).

- [ ] **Step 1: Escrever teste do router (padrão de gavetas.test.ts espelhando estoqueFamilias.test.ts)**

Ler `src/server/routes/estoqueFamilias.test.ts` para o padrão de mock do supabase e do middleware. Escrever testes: `GET` retorna lista; `POST` com `nome` vazio → 400; `POST` válido chama `insert`; `DELETE` chama `update({ gaveta_id: null })` em `estoque` antes de deletar a gaveta. (Copiar o helper de mock daquele arquivo — não inventar um novo.)

- [ ] **Step 2: Rodar e confirmar FAIL**

Run: `npx vitest run src/server/routes/gavetas.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `gavetas.ts`**

Espelhar a estrutura de `src/server/routes/estoqueFamilias.ts` (factory `export function gavetasRouter(supabase)`, `Router()`, gates `exigirPermissao`, `try/catch`). Handlers:

```ts
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

const SELECT_GAVETA = '*, categoria:categorias(id, nome)';

export function gavetasRouter(supabase: SupabaseClient) {
  const router = Router();
  const VER = exigirPermissao('estoque.ver');
  const CRIAR = exigirPermissao('estoque.criar');
  const EDITAR = exigirPermissao('estoque.editar');
  const DELETAR = exigirPermissao('estoque.deletar');

  router.get('/', VER, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('gavetas').select(SELECT_GAVETA).order('nome');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: any) {
      console.error('Erro ao listar gavetas:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post('/', CRIAR, async (req, res) => {
    try {
      const nome = String(req.body?.nome ?? '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      const payload = {
        nome,
        categoria_id: req.body?.categoria_id || null,
        icone: req.body?.icone ? String(req.body.icone) : null,
      };
      const { data, error } = await supabase.from('gavetas').insert(payload).select(SELECT_GAVETA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: any) {
      console.error('Erro ao criar gaveta:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.patch('/:id', EDITAR, async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      if (req.body?.nome !== undefined) {
        const nome = String(req.body.nome ?? '').trim();
        if (!nome) return res.status(400).json({ success: false, error: 'Nome não pode ficar vazio' });
        payload.nome = nome;
      }
      if (req.body?.categoria_id !== undefined) payload.categoria_id = req.body.categoria_id || null;
      if (req.body?.icone !== undefined) payload.icone = req.body.icone ? String(req.body.icone) : null;
      const { data, error } = await supabase.from('gavetas').update(payload).eq('id', req.params.id).select(SELECT_GAVETA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: any) {
      console.error('Erro ao atualizar gaveta:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Solta as peças (gaveta_id = null) antes de excluir — nenhuma peça some.
  // A confirmação é responsabilidade da UI (T13); aqui a operação é idempotente.
  router.delete('/:id', DELETAR, async (req, res) => {
    try {
      const { error: erroSolta } = await supabase.from('estoque').update({ gaveta_id: null }).eq('gaveta_id', req.params.id);
      if (erroSolta) throw erroSolta;
      const { error } = await supabase.from('gavetas').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      console.error('Erro ao excluir gaveta:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  return router;
}
```

- [ ] **Step 4: Registrar no server.ts**

Import junto dos outros (`:24`): `import { gavetasRouter } from './src/server/routes/gavetas.js';`. Registro após o de estoque (`:327`): `app.use('/api/gavetas', gavetasRouter(supabase));`.

- [ ] **Step 5: Rodar teste + tsc**

Run: `npx vitest run src/server/routes/gavetas.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/gavetas.ts src/server/routes/gavetas.test.ts server.ts
git commit -m "feat(estoque): backend CRUD de gavetas (/api/gavetas)"
```

---

### Task 7: Backend — `gaveta_id` no payload e no join de estoque

**Files:**
- Modify: `src/server/routes/estoque.ts:39-40` (`SELECT_COM_JOINS`), e `montarPayload` (função que monta o payload de PATCH/PUT de estoque — localizar por `montarPayload` no arquivo)
- Test: `src/server/routes/estoque.test.ts` (adicionar caso; ler o arquivo para o padrão)

**Interfaces:**
- Produces: `GET /api/estoque` retorna `gaveta` (join) e `gaveta_id`; `PATCH /api/estoque/:id` com `{ gaveta_id }` grava a coluna (mover peça / soltar com `null`).
- Consumes: coluna `estoque.gaveta_id` (Task 1); `Gaveta` type (Task 5).

- [ ] **Step 1: Adicionar o join da gaveta ao SELECT**

Em `SELECT_COM_JOINS` (`:39-40`), acrescentar `, gaveta:gavetas(id, nome, icone)`:

```ts
export const SELECT_COM_JOINS =
  '*, categoria:categorias(id, nome, mercadolivre_categoria_id_padrao), modelo_moto:modelos_moto!estoque_modelo_moto_id_fkey(id, nome, ano), gaveta:gavetas(id, nome, icone)';
```

- [ ] **Step 2: Aceitar `gaveta_id` no payload de escrita**

Localizar `montarPayload` (o do estoque, não o de unidade) e adicionar, no mesmo estilo dos campos existentes:

```ts
    if (body?.gaveta_id !== undefined) payload.gaveta_id = body.gaveta_id || null;
```

- [ ] **Step 3: Teste — PATCH grava gaveta_id; GET traz o join**

Adicionar caso em `estoque.test.ts` seguindo o padrão de mock existente: `PATCH /api/estoque/:id` com `{ gaveta_id: 'g1' }` inclui `gaveta_id` no update; com `{ gaveta_id: null }` solta.

- [ ] **Step 4: Rodar teste + tsc**

Run: `npx vitest run src/server/routes/estoque.test.ts && npx tsc --noEmit`
Expected: PASS. (Se o join `gavetas` quebrar o select antes da migration rodar, seguir o padrão de degradação de `anexarUnidades` — mas como é join direto no SELECT_COM_JOINS e a migration 061 é pré-requisito do deploy, isso é aceitável; documentar que 061 precede o deploy.)

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/estoque.ts src/server/routes/estoque.test.ts
git commit -m "feat(estoque): gaveta_id no payload e join da gaveta no GET"
```

---

### Task 8: Frontend — API client + hooks React Query

**Files:**
- Create: `src/features/estoque/gaveta/api.ts` (ou estender `src/features/estoque/api.ts` com `gavetasApi`)
- Create: `src/features/estoque/gaveta/hooks.ts` (`useGavetas`, `useCriarGaveta`, `useAtualizarGaveta`, `useExcluirGaveta`, `useMoverPecaGaveta`)
- Test: `src/features/estoque/gaveta/hooks.test.tsx` (opcional — cobrir invalidação de cache do mais crítico: mover/excluir)

**Interfaces:**
- Produces:
  - `gavetasApi.listar(): Promise<ApiResult<Gaveta[]>>`, `.criar(GavetaInput)`, `.atualizar(id, Partial<GavetaInput>)`, `.excluir(id)`.
  - `useGavetas()` → `{ data, isLoading, ... }`; mutations com `queryClient.invalidateQueries({ queryKey: ['gavetas'] })` e `['estoque']` (pois mover/soltar muda `estoque.gaveta_id`).
- Consumes: `api` de `../../utils/api`; `Gaveta`, `GavetaInput` (Task 5); padrão de hooks existente do módulo (ler `src/features/estoque/` para o hook de estoque atual — `useEstoque` ou similar — e espelhar).

- [ ] **Step 1: Ler o hook de estoque existente**

Localizar como o módulo consome React Query hoje (procurar `useQuery`/`queryKey` em `src/features/estoque/`). Espelhar chaves e o `ApiResult<T>` de `api.ts`.

- [ ] **Step 2: Escrever `gavetasApi`**

```ts
import { api } from '../../../utils/api';
import type { Gaveta, GavetaInput } from '../types';

interface ApiResult<T> { success: boolean; data: T; error?: string; }

export const gavetasApi = {
  listar: () => api.get('/api/gavetas') as Promise<ApiResult<Gaveta[]>>,
  criar: (payload: GavetaInput) => api.post('/api/gavetas', payload) as Promise<ApiResult<Gaveta>>,
  atualizar: (id: string, payload: Partial<GavetaInput>) => api.patch(`/api/gavetas/${id}`, payload) as Promise<ApiResult<Gaveta>>,
  excluir: (id: string) => api.delete(`/api/gavetas/${id}`) as Promise<ApiResult<null>>,
};
```

Adicionar `moverPecaGaveta` reaproveitando `estoqueApi.atualizarParcial(id, { gaveta_id })` (já existe — Task 7 fez o backend aceitar).

- [ ] **Step 3: Escrever os hooks**

`useGavetas` (`queryKey: ['gavetas']`), e mutations invalidando `['gavetas']` + `['estoque']`. Seguir o formato exato dos hooks de estoque existentes (Step 1).

- [ ] **Step 4: tsc + teste (se escrito)**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/estoque/gaveta/api.ts src/features/estoque/gaveta/hooks.ts
git commit -m "feat(estoque): client e hooks de gavetas"
```

---

### Task 9: `currency-input` (máscara R$) + `UnidadeForm` (T03)

**Files:**
- Create: `src/features/estoque/gaveta/CurrencyInput.tsx`
- Create: `src/features/estoque/gaveta/CurrencyInput.test.tsx`
- Create: `src/features/estoque/gaveta/UnidadeForm.tsx`
- Read (antes de implementar UnidadeForm): `docs/mockups/T03-adicionar-unidade.png`

**Interfaces:**
- Produces:
  - `CurrencyInput({ value: number | null, onChange: (v: number | null) => void, ... })` — máscara pt-BR (milhares `.`, decimal `,`), valor numérico pra fora.
  - `UnidadeForm({ estoqueId, unidade?, onSalvar, onCancelar })` — form inline; **preço obrigatório**, resto opcional (nome, descricao, condicao_nota, avaria+avaria_descricao, fotos via `use-media`/Storage); Salvar (único accent) / Cancelar (ghost). Usa `estoqueApi.criarUnidade`/`atualizarUnidade`.
- Consumes: `EstoqueUnidadeInput` (com `nome`+`descricao`, Tasks 2/4); componentes animate-ui (`input`, `checkbox`, `button`).

- [ ] **Step 1: Testes da máscara de moeda (TDD)**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

describe('CurrencyInput', () => {
  it('formata dígitos como R$ pt-BR e emite número', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={null} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '125000' } });
    expect(onChange).toHaveBeenLastCalledWith(1250);
    expect((input as HTMLInputElement).value).toContain('1.250,00');
  });

  it('mostra valor inicial formatado', () => {
    render(<CurrencyInput value={80} onChange={() => {}} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('80,00');
  });
});
```

- [ ] **Step 2: Rodar e confirmar FAIL**

Run: `npx vitest run src/features/estoque/gaveta/CurrencyInput.test.tsx`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `CurrencyInput`**

Máscara: interpretar dígitos como centavos, dividir por 100, formatar com `toLocaleString('pt-BR', { minimumFractionDigits: 2 })`. Emitir o número (reais) via `onChange`. Reusar `formatCurrency` do projeto se já existir para exibição (procurar em `src/utils`).

- [ ] **Step 4: Rodar e confirmar PASS**

Run: `npx vitest run src/features/estoque/gaveta/CurrencyInput.test.tsx`
Expected: PASS.

- [ ] **Step 5: `Read("docs/mockups/T03-adicionar-unidade.png")` e implementar `UnidadeForm`**

Seguir o layout do mockup. Campos: preço (CurrencyInput, obrigatório — Salvar desabilitado sem preço), nome, descricao, anos (se o mockup pedir), condicao_nota, checkbox avaria + avaria_descricao condicional, upload de fotos (Storage). Um único botão accent (Salvar). Tokens do tema. Reusar o fluxo de upload de fotos existente (procurar `use-media` ou o uploader atual em `UnidadesEstoque.tsx`/`RegistrarUnidadeDialog.tsx` e reaproveitar o serviço, não a UI de famílias).

- [ ] **Step 6: tsc + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/features/estoque/gaveta/CurrencyInput.tsx src/features/estoque/gaveta/CurrencyInput.test.tsx src/features/estoque/gaveta/UnidadeForm.tsx
git commit -m "feat(estoque): currency-input e form de unidade (T03)"
```

---

### Task 10: T01 — `GavetaList` (listagem, stats-row, filtros, não agrupados)

**Files:**
- Create: `src/features/estoque/gaveta/GavetaList.tsx`
- Create: `src/features/estoque/gaveta/StatsRow.tsx`, `FilterChips.tsx`, `GavetaRow.tsx`
- Read (antes): `docs/mockups/T01-listagem-gavetas.png`

**Interfaces:**
- Consumes: `useGavetas` (Task 8), `useEstoque` (existente), `agruparPorGaveta`/`statsGaveta` (Task 5), `useCriarGaveta`.
- Produces: rota-alvo `GavetaList` renderizada por Task 13.

- [ ] **Step 1: `Read("docs/mockups/T01-listagem-gavetas.png")`**

- [ ] **Step 2: Implementar `StatsRow` e `FilterChips`**

`StatsRow`: 4 pills (nº gavetas / nº variantes / nº unidades disponíveis / valor total) — número > label, tokens. `FilterChips`: chips por `categoria`, seleção controlada. Ambos custom (Radix + Motion), sem hex.

- [ ] **Step 3: Implementar `GavetaList`**

Header + botão "Nova Gaveta" (único accent, abre criação — nome manual). Search local. `StatsRow` (de `statsGaveta` sobre todas as peças). `FilterChips`. Lista de `GavetaRow` (nome, ícone, categoria, faixa R$, contagem). Seção final "ITENS NÃO AGRUPADOS" (linha `nao-agrupado` de `agruparPorGaveta`), visual dimmed + badge "SEM GRUPO". Usar `agruparPorGaveta(pecas, gavetas)`.

- [ ] **Step 4: Verificar no preview (mobile 375px)**

Iniciar dev server (`preview_start` com o `name` do launch.json; criar a entrada se não existir). Navegar até a rota (Task 13 pode preceder; se ainda não houver rota, montar `GavetaList` numa rota temporária ou verificar após Task 13). `read_console_messages` sem erros; `resize_window` mobile; screenshot.

- [ ] **Step 5: tsc + commit**

Run: `npx tsc --noEmit`

```bash
git add src/features/estoque/gaveta/GavetaList.tsx src/features/estoque/gaveta/StatsRow.tsx src/features/estoque/gaveta/FilterChips.tsx src/features/estoque/gaveta/GavetaRow.tsx
git commit -m "feat(estoque): tela de listagem de gavetas (T01)"
```

---

### Task 11: T02 — `GavetaDetail` (variantes, unidades, edição inline)

**Files:**
- Create: `src/features/estoque/gaveta/GavetaDetail.tsx`, `VarianteCard.tsx`, `UnidadeRow.tsx`
- Read (antes): `docs/mockups/T02-detalhe-gaveta.png`

**Interfaces:**
- Consumes: `useGavetas`/`useEstoque` filtrado por `gaveta_id`, `faixaPrecoVariante` (Task 5), `UnidadeForm` (Task 9), `useAtualizarGaveta`, `estoqueApi.atualizarParcial` (edição inline de variante).
- Produces: rota-alvo por Task 13.

- [ ] **Step 1: `Read("docs/mockups/T02-detalhe-gaveta.png")`**

- [ ] **Step 2: Implementar `UnidadeRow`**

Dot de status, nome (`unidade.nome`), preço, nota; unidade "cadastro mínimo" (só preço, sem nome/foto) com ⚠️ + texto. Ações: editar (abre `UnidadeForm`).

- [ ] **Step 3: Implementar `VarianteCard`**

Uma peça = uma variante. Título/ano/tipo editáveis inline (PATCH via `atualizarParcial`), badges (Original laranja / Paralela roxo / Novo azul / ML amarelo / Shopee rosa — tokens semânticos), **faixa de preço computada** (`faixaPrecoVariante`, nunca fixo), lista de `UnidadeRow`, botão "+ Unidade" (abre `UnidadeForm` inline).

- [ ] **Step 4: Implementar `GavetaDetail`**

Back nav; título da gaveta editável inline; meta (categoria · N variantes · N unidades · faixa R$); lista de `VarianteCard`. Máx. 1 accent na tela.

- [ ] **Step 5: Verificar no preview**

Navegar a uma gaveta; `read_console_messages` limpo; testar editar título inline e abrir "+ Unidade"; `read_network_requests` confirma PATCH; screenshot mobile.

- [ ] **Step 6: tsc + commit**

```bash
git add src/features/estoque/gaveta/GavetaDetail.tsx src/features/estoque/gaveta/VarianteCard.tsx src/features/estoque/gaveta/UnidadeRow.tsx
git commit -m "feat(estoque): tela de detalhe da gaveta com variantes e unidades (T02)"
```

---

### Task 12: T09 skeletons + T13 estados preventivos

**Files:**
- Create: `src/features/estoque/gaveta/GavetaSkeletons.tsx`
- Create: `src/features/estoque/gaveta/EstadosGaveta.tsx` (empty state, offline bar, alerta de duplicata)
- Modify: `GavetaList.tsx`, `GavetaDetail.tsx` (usar skeletons enquanto `isLoading`)
- Read (antes): `docs/mockups/T09-skeleton-loading.png`, `docs/mockups/T13-estados-preventivos.png`

**Interfaces:**
- Consumes: animate-ui `skeleton`; estado `isLoading` dos hooks; `navigator.onLine`.
- Produces: `<GavetaListSkeleton/>`, `<GavetaDetailSkeleton/>`, `<EmptyGavetas onNova={...}/>`, `<OfflineBar/>`, `<AlertaDuplicataGaveta nome onVincular onCriarMesmoAssim/>`.

- [ ] **Step 1: `Read` dos mockups T09 e T13**

- [ ] **Step 2: Implementar skeletons (animate-ui `skeleton`) e ligar em `isLoading`**

- [ ] **Step 3: Implementar estados T13**

Empty state (nenhuma gaveta → CTA "Nova Gaveta", único accent). Offline bar (quando `!navigator.onLine`). Alerta de duplicata: ao digitar nome de nova gaveta parecido com uma existente, avisar com AÇÃO ("vincular à existente?" / "criar mesmo assim") — todo alerta tem ação. Reusar a lógica de similaridade de nome já existente no projeto (procurar por `similar`/`levenshtein`/`normalizar` em `src/`); não recriar do zero.

- [ ] **Step 4: Verificar no preview**

Forçar estado vazio e offline (devtools/JS); screenshots; console limpo.

- [ ] **Step 5: tsc + commit**

```bash
git add src/features/estoque/gaveta/GavetaSkeletons.tsx src/features/estoque/gaveta/EstadosGaveta.tsx src/features/estoque/gaveta/GavetaList.tsx src/features/estoque/gaveta/GavetaDetail.tsx
git commit -m "feat(estoque): skeletons (T09) e estados preventivos (T13) das gavetas"
```

---

### Task 13: Rota + entrada de navegação + patch notes

**Files:**
- Modify: arquivo de rotas do TanStack Router (localizar `createRoute`/`routeTree` em `src/`) — adicionar `/estoque/gavetas` (lista) e `/estoque/gavetas/$gavetaId` (detalhe)
- Modify: componente de navegação/menu (localizar onde as abas de Estoque/Vendas etc. são listadas) — adicionar link "Gavetas"
- Modify: `src/features/patchnotes/data.ts`

**Interfaces:**
- Consumes: `GavetaList` (Task 10), `GavetaDetail` (Task 11).

- [ ] **Step 1: Localizar o padrão de rotas e navegação existente**

Procurar as rotas atuais de estoque (`grep` por `/estoque` em rotas) e o menu. Espelhar o padrão.

- [ ] **Step 2: Registrar as rotas de gavetas**

`GavetaList` em `/estoque/gavetas`; `GavetaDetail` em `/estoque/gavetas/$gavetaId`, lendo o param e filtrando peças por `gaveta_id`.

- [ ] **Step 3: Adicionar o link de navegação**

Entrada "Gavetas" no menu de Estoque (posicionar com intenção — memória `posicionar-componentes-com-intencao`: integrar ao grupo de Estoque, não encaixar solto).

- [ ] **Step 4: Verificar navegação ponta a ponta no preview**

Menu → lista → clicar gaveta → detalhe → back. Console/network limpos. Screenshot do fluxo. `SendUserFile` com o screenshot da T01 e T02 para o dono acompanhar.

- [ ] **Step 5: Patch notes**

Adicionar item novo em `src/features/patchnotes/data.ts` (topo, seguindo o formato dos itens existentes): título "Estoque organizado por Gavetas" + descrição curta da nova tela e do conceito Gaveta → Variante → Unidade.

- [ ] **Step 6: tsc + suíte de estoque + commit**

Run: `npx tsc --noEmit && npx vitest run src/features/estoque src/server/routes/gavetas.test.ts`
Expected: PASS.

```bash
git add src/features/patchnotes/data.ts <arquivos de rota e menu>
git commit -m "feat(estoque): rotas e navegacao das gavetas + patch notes"
```

---

## Self-Review

**Spec coverage:**
- §3 Banco → Task 1 ✅ (gavetas, gaveta_id, rename, descricao)
- §3 rename impact/varredura → Tasks 2, 3 ✅
- §4 Backend gavetas CRUD + DELETE solta peças → Task 6 ✅; gaveta_id no estoque → Task 7 ✅
- §5 Frontend T01/T02/T03/T09/T13 → Tasks 9, 10, 11, 12 ✅; hooks → Task 8 ✅; rota/menu → Task 13 ✅
- §3 stats no domínio (sem view) → Task 5 ✅
- §6 Testes (faixa preço, agrupamento, moeda) → Tasks 5, 9 ✅
- Global: patch notes → Task 13 Step 5 ✅
- Unidade `descricao` (spec §2 "primeira classe") → Task 4 ✅

**Placeholder scan:** As Tasks de UI (10, 11, 12) fazem `Read()` do mockup imediatamente antes de implementar (exigência do CLAUDE.md e da spec) — o código pixel-a-pixel é escrito contra o mockup, não transcrito aqui às cegas; as interfaces (props, hooks consumidos, tokens, regras) estão explícitas. Lógica pura (agrupamento, faixa de preço, máscara de moeda) tem código completo com testes (Tasks 5, 9).

**Type consistency:** `EstoqueUnidade.nome`/`descricao` (Tasks 2/4) usados consistentemente nas Tasks 9/11. `Gaveta`/`GavetaInput` definidos na Task 5, consumidos nas Tasks 6/8/10/11. `agruparPorGaveta`/`faixaPrecoVariante`/`statsGaveta` com mesmos nomes na definição (Task 5) e nos consumidores (Tasks 10/11). `gaveta_id` no payload (Task 7) casa com `moverPecaGaveta` (Task 8).
