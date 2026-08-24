# Tarefas: Checklist + Horários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar checklists (checkboxes) dentro de tarefas — com conclusão automática quando todos os itens são marcados e título opcional — e exibir os horários de designada/concluída com tempo relativo curto ("2h atrás").

**Architecture:** Nova tabela `tarefa_itens` (1-N com `tarefas`, cascade). O status da tarefa passa a ser derivado dos itens quando existem: marcar o último item conclui; desmarcar reabre; `/concluir` e `/reabrir` são bloqueados quando há itens. Helpers puros (relativo de tempo, progresso, derivação de status, normalização de itens) concentram a lógica testável; endpoints e UI só orquestram.

**Tech Stack:** React 19 + TypeScript, Tailwind v4 (tokens em `src/styles/theme.css`), motion/react, Express + supabase-js (service_role), Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-24-tarefas-checklist-e-horarios-design.md`

## Global Constraints

- **Sem hex direto nos componentes** — usar as classes de token (`bg-surface-card`, `text-text-faint`, `text-positive`, `rounded-control`, etc.). Ver `CLAUDE.md`.
- **No máximo UM botão accent preenchido por tela** — ações secundárias em outline/ghost. "Concluir" continua verde outline (`positive`).
- **Mobile e desktop desde o início** — alvos de toque `h-11 sm:h-9` (padrão já usado na feature); verificar no preset mobile.
- **Migration já rodada em produção** pelo usuário — o arquivo SQL ainda precisa existir no repo como registro (Task 2), mas NÃO reexecutar nada.
- **Todo alerta tem ação** — nada de mensagem informativa sem ação associada.
- **Patch notes obrigatório** — toda entrega termina com item novo em `src/features/patchnotes/data.ts` (Task 6).
- **Idioma** — código/comentários/UI em pt-BR, no tom das strings existentes.

---

## File Structure

- `src/features/tarefas/tarefaUtils.ts` (modificar) — helpers puros: `formatarMomentoRelativo`, `progressoChecklist`.
- `src/features/tarefas/tarefaUtils.test.ts` (criar) — testes dos helpers de UI.
- `src/features/tarefas/types.ts` (modificar) — `TarefaItem`, `Tarefa.itens`, título anulável, inputs com itens.
- `supabase/migration_046_tarefa_itens.sql` (criar) — registro da migration (já rodada).
- `src/server/routes/tarefas.ts` (modificar) — SELECT com itens, normalização, POST/PATCH com itens, toggle, guards, derivação de status.
- `src/server/routes/tarefas.itens.test.ts` (criar) — testes dos helpers puros do backend (`normalizarItens`, `derivarConclusao`).
- `src/features/tarefas/api.ts` (modificar) — método `alternarItem` + tipos.
- `src/features/tarefas/TarefasView.tsx` (modificar) — editor de checklist no form + validação.
- `src/features/tarefas/TarefaCards.tsx` (modificar) — progresso no card, checklist interativo no painel, layout sem título, ações condicionais, linhas de horário.
- `src/features/patchnotes/data.ts` (modificar) — entrada 1.2.35.

---

## Task 1: Helpers de UI (tempo relativo + progresso) e tipos

**Files:**
- Modify: `src/features/tarefas/types.ts`
- Modify: `src/features/tarefas/tarefaUtils.ts`
- Test: `src/features/tarefas/tarefaUtils.test.ts` (create)

**Interfaces:**
- Consumes: `Tarefa` de `./types`.
- Produces:
  - `TarefaItem { id: string; texto: string; concluido: boolean; ordem: number; concluido_em: string | null; concluido_por: string | null }`
  - `Tarefa.itens: TarefaItem[]`, `Tarefa.titulo: string | null`
  - `TarefaItemInput = { id?: string; texto: string }`
  - `TarefaInput.titulo?: string | null`, `TarefaInput.itens?: TarefaItemInput[]`, idem `TarefaUpdateInput`
  - `formatarMomentoRelativo(iso: string | null, agora?: number): string | null`
  - `progressoChecklist(tarefa: Pick<Tarefa, 'itens'>): { feitos: number; total: number } | null`

- [ ] **Step 1: Atualizar os tipos**

Em `src/features/tarefas/types.ts`, adicionar `TarefaItem`, ajustar `Tarefa` e os inputs:

```ts
export interface TarefaItem {
  id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
  concluido_em: string | null;
  concluido_por: string | null;
}

export interface TarefaItemInput {
  id?: string; // presente = item existente (diff no PATCH); ausente = novo
  texto: string;
}
```

Na interface `Tarefa`: trocar `titulo: string;` por `titulo: string | null;` e adicionar `itens: TarefaItem[];`.
Em `TarefaInput`: trocar `titulo: string;` por `titulo?: string | null;` e adicionar `itens?: TarefaItemInput[];`.
Em `TarefaUpdateInput`: adicionar `itens?: TarefaItemInput[];` (o `titulo?: string;` existente vira `titulo?: string | null;`).

- [ ] **Step 2: Escrever os testes (falhando)**

Criar `src/features/tarefas/tarefaUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatarMomentoRelativo, progressoChecklist } from './tarefaUtils';
import type { TarefaItem } from './types';

const AGORA = new Date('2026-08-24T18:00:00').getTime();
const isoAtras = (ms: number) => new Date(AGORA - ms).toISOString();
const min = 60_000, hora = 60 * min, dia = 24 * hora;

describe('formatarMomentoRelativo', () => {
  it('retorna null quando não há data', () => {
    expect(formatarMomentoRelativo(null, AGORA)).toBeNull();
  });
  it('mostra "agora" abaixo de 1 minuto', () => {
    expect(formatarMomentoRelativo(isoAtras(30_000), AGORA)).toContain('agora');
  });
  it('mostra minutos', () => {
    expect(formatarMomentoRelativo(isoAtras(5 * min), AGORA)).toContain('5min atrás');
  });
  it('mostra horas', () => {
    expect(formatarMomentoRelativo(isoAtras(2 * hora), AGORA)).toContain('2h atrás');
  });
  it('mostra "ontem"', () => {
    expect(formatarMomentoRelativo(isoAtras(28 * hora), AGORA)).toContain('ontem');
  });
  it('mostra dias', () => {
    expect(formatarMomentoRelativo(isoAtras(3 * dia), AGORA)).toContain('3d atrás');
  });
  it('inclui a data/hora antes do relativo', () => {
    const out = formatarMomentoRelativo(isoAtras(2 * hora), AGORA)!;
    expect(out).toMatch(/\d{2}\/\d{2}.*·/); // "24/08 às 16:00 · 2h atrás"
  });
});

const item = (concluido: boolean): TarefaItem => ({
  id: crypto.randomUUID(), texto: 'x', concluido, ordem: 0, concluido_em: null, concluido_por: null,
});

describe('progressoChecklist', () => {
  it('retorna null sem itens', () => {
    expect(progressoChecklist({ itens: [] })).toBeNull();
  });
  it('conta feitos e total', () => {
    expect(progressoChecklist({ itens: [item(true), item(false), item(true)] })).toEqual({ feitos: 2, total: 3 });
  });
});
```

- [ ] **Step 3: Rodar os testes (devem falhar)**

Run: `npm test -- tarefaUtils`
Expected: FAIL — `formatarMomentoRelativo`/`progressoChecklist` não exportados.

- [ ] **Step 4: Implementar os helpers**

Adicionar em `src/features/tarefas/tarefaUtils.ts` (e importar `TarefaItem`/`Tarefa` conforme já usado no arquivo):

```ts
// Formata um ISO como "24/08 às 14:30 · 2h atrás". `agora` é injetável só
// pra os testes não dependerem do relógio real.
export function formatarMomentoRelativo(iso: string | null, agora = Date.now()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const abs = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ');
  const diff = agora - d.getTime();
  const min = 60_000, hora = 60 * min, dia = 24 * hora;
  let rel: string;
  if (diff < min) rel = 'agora';
  else if (diff < hora) rel = `${Math.floor(diff / min)}min atrás`;
  else if (diff < dia) rel = `${Math.floor(diff / hora)}h atrás`;
  else if (diff < 2 * dia) rel = 'ontem';
  else rel = `${Math.floor(diff / dia)}d atrás`;
  return `${abs} · ${rel}`;
}

export function progressoChecklist(tarefa: Pick<Tarefa, 'itens'>): { feitos: number; total: number } | null {
  const total = tarefa.itens?.length ?? 0;
  if (total === 0) return null;
  return { feitos: tarefa.itens.filter((i) => i.concluido).length, total };
}
```

Nota: o `import type { ... Tarefa }` no topo do arquivo já existe; adicionar `Tarefa` se necessário.

- [ ] **Step 5: Rodar os testes (devem passar)**

Run: `npm test -- tarefaUtils`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add src/features/tarefas/types.ts src/features/tarefas/tarefaUtils.ts src/features/tarefas/tarefaUtils.test.ts
git commit -m "feat(tarefas): tipos de checklist + helpers de tempo relativo e progresso"
```

---

## Task 2: Migration (registro) + backend leitura/criação com itens

**Files:**
- Create: `supabase/migration_046_tarefa_itens.sql`
- Modify: `src/server/routes/tarefas.ts`
- Test: `src/server/routes/tarefas.itens.test.ts` (create)

**Interfaces:**
- Consumes: `TarefaItem`/`TarefaItemInput` de Task 1 (via tipos do cliente; o backend usa objetos soltos).
- Produces (exportados de `tarefas.ts` pra teste):
  - `normalizarItens(raw: unknown): { texto: string; id?: string }[]` — filtra textos vazios (trim), preserva ordem.
  - `SELECT_COM_JOINS` passa a trazer `itens`.

- [ ] **Step 1: Criar o arquivo de migration (registro; já rodada)**

Criar `supabase/migration_046_tarefa_itens.sql`:

```sql
-- =============================================================================
-- RK Sucatas — Migração 046: Checklist de tarefas (tarefa_itens)
-- =============================================================================
-- Rode no editor SQL do Supabase DEPOIS de schema.sql + migrations 002..045.
-- Adiciona checkboxes dentro de uma tarefa. A tarefa passa a poder existir só
-- como uma lista de itens (título opcional) — a regra "título OU >=1 item" e a
-- derivação do status a partir dos itens ficam no backend (src/server/routes/
-- tarefas.ts), não no banco.
-- =============================================================================

create table tarefa_itens (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  texto text not null,
  concluido boolean not null default false,
  ordem integer not null default 0,
  concluido_em timestamptz,
  concluido_por uuid references usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index idx_tarefa_itens_tarefa on tarefa_itens(tarefa_id);

alter table tarefa_itens enable row level security;
-- sem policy de propósito: só o backend (service_role) acessa, igual ao resto.

-- Título deixa de ser obrigatório: uma tarefa pode ser só uma lista de itens.
alter table tarefas alter column titulo drop not null;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Escrever o teste de `normalizarItens` (falhando)**

Criar `src/server/routes/tarefas.itens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizarItens } from './tarefas';

describe('normalizarItens', () => {
  it('retorna [] quando não é array', () => {
    expect(normalizarItens(undefined)).toEqual([]);
    expect(normalizarItens(null)).toEqual([]);
    expect(normalizarItens('x')).toEqual([]);
  });
  it('descarta textos vazios/só-espaço e faz trim', () => {
    expect(normalizarItens([{ texto: '  Postar  ' }, { texto: '   ' }, { texto: '' }])).toEqual([{ texto: 'Postar' }]);
  });
  it('preserva id quando presente', () => {
    expect(normalizarItens([{ id: 'a', texto: 'X' }, { texto: 'Y' }])).toEqual([{ id: 'a', texto: 'X' }, { texto: 'Y' }]);
  });
});
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `npm test -- tarefas.itens`
Expected: FAIL — `normalizarItens` não existe.

- [ ] **Step 4: Implementar leitura/criação no backend**

Em `src/server/routes/tarefas.ts`:

a) Estender o SELECT (topo do arquivo):

```ts
const SELECT_COM_JOINS =
  '*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao), cliente:clientes(id, nome, telefone), itens:tarefa_itens(id, texto, concluido, ordem, concluido_em, concluido_por)';
```

b) Adicionar helpers exportados (perto do topo, após as constantes):

```ts
// Filtra itens de checklist válidos preservando a ordem do array. Exportado
// pra teste. Aceita { texto } e opcionalmente { id } (usado no diff do PATCH).
export function normalizarItens(raw: unknown): { texto: string; id?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i) => ({ id: i?.id as string | undefined, texto: String(i?.texto ?? '').trim() }))
    .filter((i) => i.texto.length > 0)
    .map((i) => (i.id ? { id: i.id, texto: i.texto } : { texto: i.texto }));
}

// Ordena os itens aninhados por `ordem` e garante array (nunca null) — o
// supabase devolve a relação sem ordem garantida.
function comItensOrdenados<T extends { itens?: any[] | null }>(tarefa: T): T {
  const itens = (tarefa.itens ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return { ...tarefa, itens };
}
```

c) No handler `GET /`, após `if (error) throw error;`, normalizar:

```ts
res.json({ success: true, data: (data ?? []).map(comItensOrdenados) });
```

d) No handler `POST /`:
- Trocar a validação de título obrigatório por título-OU-itens:

```ts
const titulo = String(req.body?.titulo || '').trim();
const itens = normalizarItens(req.body?.itens);
if (!titulo && itens.length === 0) {
  return res.status(400).json({ success: false, error: 'Informe um título ou pelo menos um item' });
}
if (!atribuido_para) return res.status(400).json({ success: false, error: 'Responsável é obrigatório' });
```

- No `payload`, gravar `titulo: titulo || null`.
- Após inserir a tarefa (`.single()`), inserir os itens quando houver:

```ts
if (itens.length > 0) {
  const linhas = itens.map((it, i) => ({ tarefa_id: data.id, texto: it.texto, ordem: i }));
  const { error: erroItens } = await supabase.from('tarefa_itens').insert(linhas);
  if (erroItens) throw erroItens;
}
// Rebuscar com os itens já persistidos para devolver o objeto completo.
const { data: completa } = await supabase.from('tarefas').select(SELECT_COM_JOINS).eq('id', data.id).single();
```

- Ajustar a notificação push: corpo = `titulo || itens[0]?.texto || 'Nova tarefa'`.
- Responder `res.json({ success: true, data: comItensOrdenados(completa ?? data) });`

- [ ] **Step 5: Rodar os testes (devem passar)**

Run: `npm test -- tarefas.itens`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migration_046_tarefa_itens.sql src/server/routes/tarefas.ts src/server/routes/tarefas.itens.test.ts
git commit -m "feat(tarefas): backend lê e cria tarefas com checklist (migration 046)"
```

---

## Task 3: Backend — derivação de status, toggle, PATCH com diff, guards

**Files:**
- Modify: `src/server/routes/tarefas.ts`
- Test: `src/server/routes/tarefas.itens.test.ts` (append)

**Interfaces:**
- Consumes: `normalizarItens`, `comItensOrdenados`, `SELECT_COM_JOINS`, `ehAdminOuEquipe`, `ehExecutor` (já no arquivo).
- Produces:
  - `derivarConclusao(itens: { concluido: boolean }[], statusAtual: 'pendente' | 'concluida', agoraIso?: string): { status: 'pendente' | 'concluida'; concluida_em: string | null } | null`
  - Rota `PATCH /:id/itens/:itemId/toggle`
  - `/concluir` e `/reabrir` retornam 400 quando a tarefa tem itens.

- [ ] **Step 1: Escrever os testes de `derivarConclusao` (falhando)**

Append em `src/server/routes/tarefas.itens.test.ts`:

```ts
import { derivarConclusao } from './tarefas';

describe('derivarConclusao', () => {
  const AGORA = '2026-08-24T18:00:00.000Z';
  it('sem itens não muda nada', () => {
    expect(derivarConclusao([], 'pendente', AGORA)).toBeNull();
  });
  it('todos marcados e pendente -> conclui', () => {
    expect(derivarConclusao([{ concluido: true }, { concluido: true }], 'pendente', AGORA))
      .toEqual({ status: 'concluida', concluida_em: AGORA });
  });
  it('algum pendente e concluida -> reabre', () => {
    expect(derivarConclusao([{ concluido: true }, { concluido: false }], 'concluida', AGORA))
      .toEqual({ status: 'pendente', concluida_em: null });
  });
  it('já no estado certo -> null (idempotente)', () => {
    expect(derivarConclusao([{ concluido: true }], 'concluida', AGORA)).toBeNull();
    expect(derivarConclusao([{ concluido: false }], 'pendente', AGORA)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npm test -- tarefas.itens`
Expected: FAIL — `derivarConclusao` não existe.

- [ ] **Step 3: Implementar `derivarConclusao` + recálculo + rotas**

Em `src/server/routes/tarefas.ts`:

a) Helper puro (perto de `normalizarItens`):

```ts
// Deriva o status da tarefa a partir dos itens. Retorna o patch a aplicar,
// ou null quando não há itens ou o status já está correto (idempotente).
export function derivarConclusao(
  itens: { concluido: boolean }[],
  statusAtual: 'pendente' | 'concluida',
  agoraIso = new Date().toISOString(),
): { status: 'pendente' | 'concluida'; concluida_em: string | null } | null {
  if (itens.length === 0) return null;
  const todos = itens.every((i) => i.concluido);
  if (todos && statusAtual !== 'concluida') return { status: 'concluida', concluida_em: agoraIso };
  if (!todos && statusAtual === 'concluida') return { status: 'pendente', concluida_em: null };
  return null;
}
```

b) Recálculo com acesso ao banco (função interna dentro de `tarefasRouter`):

```ts
// Rebusca os itens, deriva o status e aplica se mudou. Devolve a tarefa
// completa (SELECT_COM_JOINS) já ordenada.
async function recalcularEDevolver(tarefaId: string) {
  const { data: itens } = await supabase.from('tarefa_itens').select('concluido').eq('tarefa_id', tarefaId);
  const { data: atual } = await supabase.from('tarefas').select('status').eq('id', tarefaId).single();
  const patch = derivarConclusao(itens ?? [], atual!.status as 'pendente' | 'concluida');
  if (patch) await supabase.from('tarefas').update(patch).eq('id', tarefaId);
  const { data } = await supabase.from('tarefas').select(SELECT_COM_JOINS).eq('id', tarefaId).single();
  return comItensOrdenados(data);
}
```

c) Guards em `/concluir` e `/reabrir`: logo após carregar `tarefa` (que já tem `id, atribuido_para`), contar itens e bloquear:

```ts
const { count } = await supabase.from('tarefa_itens').select('id', { count: 'exact', head: true }).eq('tarefa_id', req.params.id);
if ((count ?? 0) > 0) {
  return res.status(400).json({ success: false, error: 'Esta tarefa é controlada pelos itens do checklist — marque/desmarque os itens.' });
}
```

(Inserir esse bloco em ambas as rotas, antes do `.update(...)`.)

d) Nova rota `PATCH /:id/itens/:itemId/toggle` (adicionar antes do `return router;`):

```ts
router.patch('/:id/itens/:itemId/toggle', async (req: AuthenticatedRequest, res) => {
  try {
    const roles = req.usuario?.roles ?? [];
    const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
    if (erroBusca) throw erroBusca;
    if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

    const pode = ehAdminOuEquipe(roles) || (ehExecutor(roles) && tarefa.atribuido_para === req.usuario!.id);
    if (!pode) return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode marcar os itens' });

    const { data: item, error: erroItem } = await supabase
      .from('tarefa_itens').select('id, concluido').eq('id', req.params.itemId).eq('tarefa_id', req.params.id).maybeSingle();
    if (erroItem) throw erroItem;
    if (!item) return res.status(404).json({ success: false, error: 'Item não encontrado' });

    const novo = !item.concluido;
    const { error: erroUp } = await supabase.from('tarefa_itens').update({
      concluido: novo,
      concluido_em: novo ? new Date().toISOString() : null,
      concluido_por: novo ? req.usuario!.id : null,
    }).eq('id', item.id);
    if (erroUp) throw erroUp;

    const data = await recalcularEDevolver(req.params.id);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Erro ao alternar item da tarefa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

e) PATCH `/:id` — aplicar diff de itens e recalcular. Após o `update` dos campos escalares (e antes de responder), se `req.body.itens !== undefined`:

```ts
if (req.body?.itens !== undefined) {
  const desejados = normalizarItens(req.body.itens);
  const { data: atuais } = await supabase.from('tarefa_itens').select('id').eq('tarefa_id', req.params.id);
  const idsAtuais = new Set((atuais ?? []).map((i) => i.id));
  const idsDesejados = new Set(desejados.filter((i) => i.id).map((i) => i.id!));

  // remover os que sumiram
  const remover = [...idsAtuais].filter((id) => !idsDesejados.has(id));
  if (remover.length) await supabase.from('tarefa_itens').delete().in('id', remover);

  // upsert por posição (ordem = índice)
  for (let i = 0; i < desejados.length; i++) {
    const it = desejados[i];
    if (it.id && idsAtuais.has(it.id)) {
      await supabase.from('tarefa_itens').update({ texto: it.texto, ordem: i }).eq('id', it.id);
    } else {
      await supabase.from('tarefa_itens').insert({ tarefa_id: req.params.id, texto: it.texto, ordem: i });
    }
  }

  // validar título-OU-itens após o diff
  const { count } = await supabase.from('tarefa_itens').select('id', { count: 'exact', head: true }).eq('tarefa_id', req.params.id);
  const tituloFinal = req.body?.titulo !== undefined ? String(req.body.titulo || '').trim() : undefined;
  if ((count ?? 0) === 0 && tituloFinal === '') {
    return res.status(400).json({ success: false, error: 'Informe um título ou pelo menos um item' });
  }
}
```

Depois disso, trocar a resposta do PATCH pra sempre devolver via recálculo (que também trata reabrir/concluir por adição/remoção de itens):

```ts
const data = await recalcularEDevolver(req.params.id);
res.json({ success: true, data });
```

Obs.: no `payload` do PATCH, permitir `titulo` `null` (o loop `CAMPOS_EDITAVEIS` já copia `req.body.titulo` como veio; garantir que `''` vire `null` — se `payload.titulo` for string vazia, setar `null`).

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `npm test -- tarefas.itens`
Expected: PASS (normalizarItens + derivarConclusao).

- [ ] **Step 5: Reiniciar o dev server do backend (manual)**

O backend roda com `tsx server.ts` sem `--watch` — mudanças em rotas exigem restart manual (HMR só cobre o front). Reiniciar antes de testar no preview.

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/tarefas.ts src/server/routes/tarefas.itens.test.ts
git commit -m "feat(tarefas): toggle de item, diff no PATCH e status derivado do checklist"
```

---

## Task 4: Frontend — API + editor de checklist no formulário

**Files:**
- Modify: `src/features/tarefas/api.ts`
- Modify: `src/features/tarefas/TarefasView.tsx`

**Interfaces:**
- Consumes: `TarefaItemInput` (Task 1), rota toggle (Task 3).
- Produces: `tarefasApi.alternarItem(tarefaId: string, itemId: string): Promise<ApiResult<Tarefa>>`; form com estado `itens`.

- [ ] **Step 1: Adicionar o método na API**

Em `src/features/tarefas/api.ts`, dentro de `tarefasApi`:

```ts
alternarItem: (tarefaId: string, itemId: string): Promise<ApiResult<Tarefa>> =>
  api.patch(`/api/tarefas/${tarefaId}/itens/${itemId}/toggle`, {}),
```

- [ ] **Step 2: Estado do checklist no formulário**

Em `src/features/tarefas/TarefasView.tsx` (`VisaoCriador`):

- Trocar `EMPTY_FORM` para incluir `itens: []`:

```ts
const EMPTY_FORM: TarefaInput = { titulo: '', descricao: '', prazo: '', atribuido_para: '', cliente_id: null, prioridade: 'media', tipo: 'geral', itens: [] };
```

- Em `abrirEditar`, popular `itens` a partir da tarefa:

```ts
itens: tarefa.itens.map((i) => ({ id: i.id, texto: i.texto })),
```

- [ ] **Step 3: Editor de itens no modal (abaixo da Descrição)**

Inserir, após o bloco `<div>` da Descrição:

```tsx
<div>
  <label className={labelClass}>Checklist (opcional)</label>
  <div className="space-y-2">
    {(form.itens ?? []).map((item, idx) => (
      <div key={idx} className="flex items-center gap-2">
        <input
          value={item.texto}
          onChange={(e) =>
            setForm((f) => ({ ...f, itens: (f.itens ?? []).map((it, i) => (i === idx ? { ...it, texto: e.target.value } : it)) }))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setForm((f) => ({ ...f, itens: [...(f.itens ?? []), { texto: '' }] }));
            }
          }}
          placeholder={`Item ${idx + 1}`}
          className={cn(inputClass, 'h-11 sm:h-10 py-0')}
        />
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, itens: (f.itens ?? []).filter((_, i) => i !== idx) }))}
          className="flex size-11 sm:size-10 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-surface-inset hover:text-danger"
          title="Remover item"
        >
          <Trash2 size={16} />
        </button>
      </div>
    ))}
    <button
      type="button"
      onClick={() => setForm((f) => ({ ...f, itens: [...(f.itens ?? []), { texto: '' }] }))}
      className="flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-border-default py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-accent/50 hover:text-accent-soft-fg"
    >
      <Plus size={15} /> Adicionar item
    </button>
  </div>
</div>
```

- [ ] **Step 4: Validação e envio**

Em `salvar()`:
- Trocar a validação de título:

```ts
const temItem = (form.itens ?? []).some((i) => i.texto.trim());
if (!form.titulo.trim() && !temItem) return setErroForm('Informe um título ou pelo menos um item');
if (!form.atribuido_para) return setErroForm('Escolha um responsável');
```

- No `payload`, incluir os itens (com texto trimado, mantendo `id` dos existentes) e título anulável:

```ts
titulo: form.titulo.trim() || null,
// ...
itens: (form.itens ?? []).map((i) => ({ ...(i.id ? { id: i.id } : {}), texto: i.texto.trim() })).filter((i) => i.texto),
```

- Ajustar o placeholder do título pra indicar que é opcional (ex.: `... (opcional se houver itens)`).

- [ ] **Step 5: Verificar no preview**

Reiniciar dev server (backend), abrir a aba Tarefas, criar uma tarefa só com itens (sem título) e uma com título+itens. Conferir no console/network que o POST vai com `itens` e retorna a tarefa com `itens`. Ver `superpowers:verification-before-completion` antes de marcar concluído.

- [ ] **Step 6: Commit**

```bash
git add src/features/tarefas/api.ts src/features/tarefas/TarefasView.tsx
git commit -m "feat(tarefas): editor de checklist no formulário + título opcional"
```

---

## Task 5: Frontend — cards (progresso, checklist interativo, sem título, ações condicionais, horários)

**Files:**
- Modify: `src/features/tarefas/TarefaCards.tsx`
- Modify: `src/features/tarefas/TarefasView.tsx` (ações condicionais)

**Interfaces:**
- Consumes: `formatarMomentoRelativo`, `progressoChecklist` (Task 1); `tarefasApi.alternarItem` (Task 4).
- Produces: cards com checklist; painel expandido interativo.

- [ ] **Step 1: Imports e prop de permissão**

Em `TarefaCards.tsx`:
- Importar `ListChecks, Check` de `lucide-react`; `formatarMomentoRelativo, progressoChecklist` de `./tarefaUtils`; `tarefasApi` de `./api`; `useState`/toast já existem.
- Adicionar prop opcional `podeMarcarItens?: (tarefa: Tarefa) => boolean` em `TarefaCardsProps` (default: sempre `false` → checkboxes só-leitura se não passada).

- [ ] **Step 2: Barra/badge de progresso (componente interno)**

Adicionar dentro do arquivo:

```tsx
function BadgeProgresso({ feitos, total }: { feitos: number; total: number }) {
  const pct = total ? Math.round((feitos / total) * 100) : 0;
  const completo = feitos === total;
  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium', completo ? 'text-positive' : 'text-text-faint')}>
        <ListChecks size={12} /> {feitos}/{total}
      </span>
      <div className="h-1.5 flex-1 min-w-12 max-w-24 overflow-hidden rounded-full bg-surface-inset">
        <div className={cn('h-full rounded-full transition-all', completo ? 'bg-positive' : 'bg-accent')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Toggle de item no painel (handler)**

Dentro de `TarefaCards`, adicionar estado + handler no padrão otimista do `salvarNumeroCliente`:

```tsx
const [alternandoItem, setAlternandoItem] = useState<string | null>(null);
const alternarItem = async (tarefa: Tarefa, itemId: string) => {
  setAlternandoItem(itemId);
  try {
    const result = await tarefasApi.alternarItem(tarefa.id, itemId);
    if (!result.success) throw new Error(result.error);
    setAtiva(result.data); // devolve a tarefa inteira (status recalculado)
    onContatoSalvo?.(); // reaproveita o refetch da lista
  } catch (err) {
    aviso.falha(err, 'Erro ao atualizar item');
  } finally {
    setAlternandoItem(null);
  }
};
```

- [ ] **Step 4: Bloco de checklist no painel expandido**

No painel (dentro de `space-y-4 px-5 pb-5`, antes do bloco de detalhes `rounded-2xl`), renderizar quando houver itens:

```tsx
{ativa.itens.length > 0 && (() => {
  const prog = progressoChecklist(ativa)!;
  const podeMarcar = podeMarcarItens?.(ativa) ?? false;
  return (
    <div className="space-y-3">
      <BadgeProgresso feitos={prog.feitos} total={prog.total} />
      <ul className="space-y-1.5">
        {ativa.itens.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={!podeMarcar || alternandoItem === item.id}
              onClick={() => podeMarcar && alternarItem(ativa, item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                podeMarcar ? 'hover:bg-surface-inset cursor-pointer' : 'cursor-default',
              )}
            >
              <span className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                item.concluido ? 'border-positive bg-positive text-white' : 'border-border-default',
              )}>
                {item.concluido && <Check size={13} />}
              </span>
              <span className={cn('text-text-primary', item.concluido && 'line-through opacity-60')}>{item.texto}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
})()}
```

- [ ] **Step 5: Linhas de horário no bloco de detalhes**

Dentro do bloco `rounded-2xl bg-surface-inset/60`, após a linha "Designada por" (e após "Prazo"), acrescentar:

```tsx
<p className="flex items-center gap-2 text-sm text-text-secondary">
  <Clock size={14} className="text-text-muted shrink-0" />
  <span className="text-text-faint">Designada em:</span> {formatarMomentoRelativo(ativa.criado_em)}
</p>
{ativa.status === 'concluida' && formatarMomentoRelativo(ativa.concluida_em) && (
  <p className="flex items-center gap-2 text-sm text-positive">
    <CheckCircle2 size={14} className="shrink-0" />
    <span className="text-text-faint">Concluída em:</span> {formatarMomentoRelativo(ativa.concluida_em)}
  </p>
)}
```

(Importar `CheckCircle2` de `lucide-react` no arquivo.)

- [ ] **Step 6: Título do painel quando não há título**

No cabeçalho do painel (`<h2 ...>{ativa.titulo}</h2>`), tratar título nulo: se `!ativa.titulo`, mostrar o 1º item como título com ícone `ListChecks`:

```tsx
<h2 className={cn('text-lg font-medium text-text-primary flex items-center gap-1.5', ativa.status === 'concluida' && 'line-through opacity-60')}>
  {!ativa.titulo && <ListChecks size={16} className="text-accent shrink-0" />}
  {ativa.titulo || ativa.itens[0]?.texto || 'Tarefa'}
</h2>
```

- [ ] **Step 7: Card recolhido — progresso e layout sem título**

No `.map` do card recolhido:

- Substituir o título por lógica de fallback (com sinalização de checklist):

```tsx
<div className="flex items-center gap-1.5">
  {tarefa.tipo === 'visita' && <MapPin size={13} className="text-accent shrink-0" />}
  {!tarefa.titulo && tarefa.itens.length > 0 && <ListChecks size={13} className="text-accent shrink-0" />}
  <p className={cn('text-sm font-medium text-text-primary truncate', concluida && 'line-through opacity-60')}>
    {tarefa.titulo || tarefa.itens[0]?.texto || 'Tarefa'}
  </p>
</div>
```

- Após os badges (bloco `mt-3 ... flex-wrap`), quando houver itens, mostrar progresso e — quando **não há título** — os itens restantes (do 2º em diante) como prévia, deixando claro que é checklist:

```tsx
{progressoChecklist(tarefa) && (
  <div className="mt-3">
    <BadgeProgresso feitos={progressoChecklist(tarefa)!.feitos} total={progressoChecklist(tarefa)!.total} />
    {!tarefa.titulo && (
      <ul className="mt-2 space-y-1">
        {tarefa.itens.slice(1, 4).map((it) => (
          <li key={it.id} className="flex items-center gap-1.5 text-xs text-text-faint">
            <span className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border', it.concluido ? 'border-positive bg-positive text-white' : 'border-border-default')}>
              {it.concluido && <Check size={9} />}
            </span>
            <span className={cn('truncate', it.concluido && 'line-through opacity-60')}>{it.texto}</span>
          </li>
        ))}
        {tarefa.itens.length > 4 && <li className="text-xs text-text-faint pl-5">+{tarefa.itens.length - 4} item(ns)</li>}
      </ul>
    )}
  </div>
)}
```

- [ ] **Step 8: Ações condicionais (esconder Concluir/Reabrir quando há itens)**

Em `TarefasView.tsx`:
- `VisaoResponsavel.botaoConcluir`: retornar `null` quando `tarefa.itens.length > 0` (a conclusão é pelo checklist). Ex.: `if (tarefa.itens.length > 0 || tarefa.status === 'concluida') return null;` no começo.
- `VisaoCriador.menuTarefa`: renderizar o item "Concluir/Reabrir" só quando `t.itens.length === 0`.
- Passar `podeMarcarItens` ao `TarefaCards`:
  - Em `VisaoResponsavel`: `podeMarcarItens={() => true}` (é o responsável, backend valida).
  - Em `VisaoCriador`: `podeMarcarItens={() => true}` (admin/equipe podem marcar; backend valida).

- [ ] **Step 9: Verificar no preview (fluxo completo)**

Reiniciar backend. Testar:
1. Tarefa só com itens → card mostra 1º item como título + badge + itens restantes + ícone checklist (não parece tarefa simples).
2. Abrir painel, marcar todos os itens → status vira "Concluída" sozinho; badge fica verde; desmarcar um → volta "Pendente".
3. Conferir "Designada em"/"Concluída em" com "2h atrás".
4. Preset mobile (`resize_window` mobile): checkboxes com alvo confortável, sem overflow horizontal.
Screenshot pro usuário no fim (verification-before-completion).

- [ ] **Step 10: Commit**

```bash
git add src/features/tarefas/TarefaCards.tsx src/features/tarefas/TarefasView.tsx
git commit -m "feat(tarefas): checklist nos cards, conclusão automática e horários no painel"
```

---

## Task 6: Patch notes

**Files:**
- Modify: `src/features/patchnotes/data.ts`

- [ ] **Step 1: Adicionar entrada no topo do array**

Inserir como primeiro elemento de `PATCH_NOTES` (versão acima da 1.2.34):

```ts
{
  versao: '1.2.35',
  data: '2026-08-24',
  titulo: 'Checklist dentro das tarefas e horários mais claros',
  itens: [
    {
      tipo: 'feature',
      texto: 'Agora dá pra colocar uma lista de itens (checkboxes) dentro de uma tarefa — ex.: "Postar no Facebook", "Postar no WhatsApp", "Renovar anúncios". A tarefa só é dada como concluída quando todos os itens estão marcados; desmarcar um item reabre a tarefa.',
    },
    {
      tipo: 'feature',
      texto: 'Tarefa pode ser criada só com a lista de itens, sem título — o primeiro item vira o nome e o progresso (ex.: 2/3) aparece no card.',
    },
    {
      tipo: 'melhoria',
      texto: 'Nos detalhes da tarefa aparece quando ela foi designada e quando foi concluída, com o tempo relativo (ex.: "2h atrás").',
    },
  ],
},
```

- [ ] **Step 2: Verificar no preview**

Abrir a tela de novidades/patch notes e confirmar a entrada 1.2.35 no topo.

- [ ] **Step 3: Commit**

```bash
git add src/features/patchnotes/data.ts
git commit -m "docs(patchnotes): 1.2.35 — checklist e horários em tarefas"
```

---

## Self-Review

**Spec coverage:**
- Horários designada/concluída → Task 1 (helper) + Task 5 Step 5. ✓
- Migration 046 (tabela + título nullable) → Task 2 Step 1. ✓
- Tipos (`TarefaItem`, `itens`, título nullable, inputs) → Task 1. ✓
- Backend SELECT/POST com itens + validação título-OU-itens → Task 2. ✓
- Toggle + diff PATCH + derivação de status + guards concluir/reabrir → Task 3. ✓
- API `alternarItem` → Task 4 Step 1. ✓
- Form editor de checklist + validação → Task 4. ✓
- Cards: progresso, painel interativo, sem título, ações condicionais → Task 5. ✓
- Patch notes → Task 6. ✓
- Testes: `tarefaUtils.test.ts` (Task 1), `tarefas.itens.test.ts` (Tasks 2–3). ✓
- Verificação preview + mobile → Tasks 4, 5. ✓

**Placeholder scan:** sem TBD/TODO; todos os steps de código têm o conteúdo real. ✓

**Type consistency:** `alternarItem` (api ↔ Task 5 handler) ✓; `formatarMomentoRelativo`/`progressoChecklist` (Task 1 ↔ Task 5) ✓; `normalizarItens`/`derivarConclusao` (Tasks 2–3 ↔ testes) ✓; `TarefaItemInput { id?, texto }` (form ↔ backend diff) ✓; `Tarefa.titulo: string | null` tratado em todos os pontos de exibição ✓.
