# Plan: 5 Features (Badge, Tarefa-para-todos, Nota, Estoque, Truncamento)

**Spec**: [2026-09-01-5-features-spec.md](2026-09-01-5-features-spec.md) — the spec is the binding authority; this plan argues from it and resolves every ambiguity it left open. Rulings below override the spec's literal text where the spec's suggested values don't exist in this codebase.

## Global Constraints (binding on every task)

- No new dependencies (`package.json` untouched).
- No new/edited Supabase migrations, no `.env` changes.
- Only touch files listed in the spec's Scope table, plus `docs/plans/*` for this plan's own artifacts. `server.ts` may be touched ONLY for Fase 2 if strictly needed (see Task 2) — prefer keeping all backend changes inside `src/server/routes/tarefas.ts`.
- Design tokens: **this codebase's actual Tailwind tokens** (`src/styles/theme.css`) are: surfaces `surface-page`, `surface-card`, `surface-raised`, `surface-overlay`, `surface-inset`; text `text-primary`, `text-secondary`, `text-muted`, `text-faint`; plus semantic `accent`, `positive`, `negative`, `warning`, `danger` (each with `-bg` variant). **There is no `surface-secondary` and no `text-tertiary` token** — anywhere the spec names one of these (Fase 1's `bg-surface-secondary text-text-secondary`, Fase 4's `text-text-tertiary`), it is a plan defect (Tailwind v4 `@theme inline` only generates utilities for tokens that exist; an unknown class is silently a no-op, not an error). **Ruling:** substitute with the nearest real token in each case (spelled out per-task below). Per CLAUDE.md, color always carries meaning and only the generated classes may be used — never hex.
- Reuse the existing `StatusBadge` component (`src/components/ui/StatusBadge.tsx`) for any new small pill/badge instead of hand-rolling a `<span>` — it already implements the "neutral" (non-semantic) tone the spec asks for in Fase 1, and keeps the visual language identical to the priority/status badges already on the same card.
- Every task's commit message is in Portuguese, following this repo's existing convention (see `git log`), e.g. `feat(Tarefas): badge do responsável no card`.
- `npm test` (vitest) must pass after every task. `npm run lint` (`tsc --noEmit`) must pass after every task — this is a TypeScript codebase with no other linter configured.
- Per CLAUDE.md: no decorative color, max one filled accent button per screen (none of these tasks add a new filled accent button), every alert needs an associated action (not applicable — no new alerts here), numeric value stronger than label (not applicable — no new metric cards here).

## Pre-flight scan (conflicts across tasks)

| Pair | Shared surface | Finding |
|---|---|---|
| Task 1 × Task 5 | `TarefaCards.tsx` line ~449 (task title) and ~465-468 (badges row) | No overlap: Task 1 edits the badges row (adds a new badge after the priority badge); Task 5 edits the title `<p>` class list a few lines above. Different lines, same file — sequential tasks, no merge risk since each is a separate commit reviewed before the next starts. |
| Task 2 × Task 1 | `TarefaCards.tsx` `ItemChecklistArrastavel` (L90-138) vs card badges row (L465-468) | No overlap — different functions in the same file. Task 2 must run its own re-read of the file before editing (Task 1 will have already committed), not the stale copy from the spec. |
| Task 2 × Task 5 | `TarefaCards.tsx` line ~449 (title) | Task 5 touches title truncation classes; Task 2 does not touch the title. No overlap. |
| Task 3 (Nota) | Isolated file (`NotaTemplate.tsx`), no overlap with any other task. |
| Task 4 × Task 5 | `EstoqueView.tsx` L569 (mobile name) and L839 (desktop name) | **Same lines, both tasks mandate a full `className` value.** Task 4 (fora-de-estoque color) must run before Task 5 (truncation), and Task 5's implementer must compose its className change on top of Task 4's output (conditional color + `break-words line-clamp-2 min-w-0`), not revert it. **Ruling:** run Task 4 before Task 5 (already the spec's declared order 4→5); Task 5's brief explicitly includes Task 4's conditional-color expression so the two compose correctly instead of one clobbering the other. |
| Self-consistency, Task 2 | Backend "criar uma tarefa por responsável" vs. frontend "cada pessoa tem seu checkbox individual que só ela pode marcar" | These compose for free with the N-separate-rows design (see Task 2 Approach below) — no schema change, no new authorization code, because each generated row already has its own single `atribuido_para` and the existing toggle endpoint already restricts marking to `atribuido_para === req.usuario.id` (or a manager). Recorded as the task's Approach, not a conflict. |

Scan is otherwise clean. Tasks execute in spec order 1→2→3→4→5 (Task 4 before Task 5 is load-bearing per the row above; the rest is independence, not a hard requirement, but kept in spec order for a legible commit history).

---

## Task 1 — Badge do responsável no card de tarefa

**Files**: `src/features/tarefas/TarefaCards.tsx`, `src/features/tarefas/TarefasView.tsx`

**Do**:
1. In `TarefaCards.tsx`, add `mostrarResponsavel?: boolean` to `TarefaCardsProps` (next to the other optional render/permission props, ~L61-85) and destructure it in the `TarefaCards` function signature (~L140).
2. In the collapsed card's badges row (currently, ~L465-468):
   ```tsx
   <motion.div layoutId={`tarefa-badges-${tarefa.id}-${id}`} className="mt-3 flex items-center gap-2 flex-wrap">
     <StatusDaTarefa tarefa={tarefa} />
     {tarefa.prioridade !== 'media' && <StatusBadge texto={PRIORIDADE_LABELS[tarefa.prioridade]} tom={PRIORIDADE_TONS[tarefa.prioridade]} />}
   </motion.div>
   ```
   add a third badge after the priority one, only when `mostrarResponsavel` is true AND `tarefa.atribuido` is not null:
   ```tsx
   {mostrarResponsavel && tarefa.atribuido && <StatusBadge texto={tarefa.atribuido.nome_exibicao} tom="neutral" />}
   ```
   **Ruling (replaces spec's literal `bg-surface-secondary text-text-secondary`, which references non-existent tokens):** use `<StatusBadge tom="neutral" />` — its neutral tone already resolves to `bg-surface-inset text-text-muted`, both real tokens, and reuses the exact same pill component as the two badges beside it instead of a bespoke `<span>`.
3. In `TarefasView.tsx`, the `VisaoCriador` function's `<TarefaCards .../>` call (~L460-467) gets `mostrarResponsavel` added:
   ```tsx
   <TarefaCards
     tarefas={ordenarTarefas(filtradas)}
     renderMenu={menuTarefa}
     onContatoSalvo={refetch}
     podeMarcarItens={() => true}
     podeReordenar={podeEditar}
     mostrarResponsavel
     selecao={modoSelecao ? { ativos: selecionadas, alternar: alternarSelecao } : undefined}
   />
   ```
   Do **not** add the prop to `VisaoResponsavel`'s `<TarefaCards .../>` call (~L131-137) — per spec, the badge is redundant there and must not render.

**Tests** (vitest + @testing-library/react, colocated as `TarefaCards.test.tsx` next to the component — check whether one already exists first and extend it if so):
- Renders the responsible person's badge text when `mostrarResponsavel` is true and `tarefa.atribuido` is set.
- Does not render any responsible-person badge when `mostrarResponsavel` is false/omitted, even if `atribuido` is set.
- Does not render the badge when `atribuido` is null, even if `mostrarResponsavel` is true.

**Acceptance** (verbatim from spec): card colapsado mostra o nome apenas na visão admin; some quando `atribuido` é null; nunca aparece na VisaoResponsavel; layout não quebra com nomes longos.

**Report file naming**: this is Task 1 in the SDD ledger.

---

## Task 2 — Tarefa para Todos

**Files**: `src/server/routes/tarefas.ts`, `src/features/tarefas/types.ts`, `src/features/tarefas/TarefaCards.tsx`, `src/features/tarefas/TarefasView.tsx`

### Approach (ruling — read before implementing)

The spec offers two options and asks to pick whichever needs less schema change. **Ruling: create one `tarefas` row per eligible responsible user (no schema change, no migration), NOT a `para_todos` flag.** Reasons, verified against the current code (`src/server/routes/tarefas.ts`, `server.ts:226-247`):

- The existing single-assignee toggle endpoint (`PATCH /:id/itens/:itemId/toggle`, ~L361-389) already restricts marking to `tarefa.atribuido_para === req.usuario!.id` (or a manager/admin). If every "todos" assignee gets their own row with their own `atribuido_para`, this existing check is **already** exactly "only that person (or admin) can mark their own checkbox" — zero new authorization code needed.
- The existing list endpoint (`GET /`, ~L89-115) already scopes non-managers to `atribuido_para = meuId`. Each assignee automatically sees their own copy in their own `VisaoResponsavel` — zero new query code needed.
- A `para_todos` flag would require: a new column (migration — forbidden by Global Constraints and by the spec's own stop-condition), new authorization logic everywhere `atribuido_para === req.usuario.id` is checked, and a way to track *per-person* completion of a *shared* row's checklist — which the current schema (`tarefa_itens.concluido_por` is a single nullable uuid) cannot represent for more than one completer anyway. The N-rows approach sidesteps all of this.

Tradeoff to record in the ledger (not a defect, a known and accepted cost): the admin's own list view will show N separate cards for one "todos" broadcast (one per assignee) instead of one merged card. This is consistent with "cada pessoa tem seu checkbox individual" being independent per person, and the spec's acceptance criteria only requires each responsible person to see it in their own view — it does not require a merged admin view.

### Backend (`src/server/routes/tarefas.ts`)

1. Add a sentinel constant near the top of the file: `const TODOS_SENTINEL = 'todos';`
2. Add a helper that fetches the same eligibility-filtered user list the existing `GET /api/usuarios/responsaveis-tarefa` endpoint in `server.ts` computes (id + nome_exibicao, `ativo = true`, executor-de-campo OR gerente — see `server.ts:226-247` for the exact filter to replicate). Do not call the HTTP endpoint internally; query Supabase directly the same way, inside `tarefasRouter`, so the feature has no cross-router dependency. **Do not include the "OR own id" clause from that endpoint** — that clause exists so an individual admin can self-assign even if not nominally an executor; "todos" means every actually-eligible person, not "plus whoever happens to be creating it".
3. In `POST /` (~L117-184): when `req.body?.atribuido_para === TODOS_SENTINEL`:
   - Skip the existing single-user `responsavelValido` lookup/check for this sentinel value.
   - Fetch the eligible-users list from step 2. If it's empty, respond `400 { success: false, error: 'Nenhum responsável elegível para receber a tarefa' }`.
   - Validate `titulo`/`itens`/`prioridade`/`tipo` exactly as already done (unchanged).
   - For each eligible user: insert one `tarefas` row with the same `titulo`, `descricao`, `prazo`, `cliente_id`, `prioridade`, `tipo`, `criado_por: req.usuario!.id`, and `atribuido_para: <that user's id>`; then insert that row's own copy of `itens` (same `normalizarItens(req.body?.itens)` array, fresh rows per tarefa — checklist completion is independent per person, so item rows cannot be shared).
   - Fire the existing push notification (`notificarUsuario`, unchanged logic/condition) once per created row, skipping self-notification exactly as today (`atribuido_para !== req.usuario!.id`).
   - Respond `200 { success: true, data: <first created tarefa, fully joined via SELECT_COM_JOINS> }` — pick the first row in the eligible-users list order (already alphabetical by `nome_exibicao` per the existing query's `.order('nome_exibicao')`). The frontend's `salvar()` (`TarefasView.tsx`) calls `refetch()` right after `criar()` regardless of the returned payload, so this single-row return is not the UI's actual data source — it only needs to satisfy the existing `ApiResult<Tarefa>` contract in `tarefasApi.criar` (`src/features/tarefas/api.ts` — **do not change its type**).
   - If `req.body?.atribuido_para` is anything else, behavior is completely unchanged (existing single-assignee path).
4. Extend `SELECT_COM_JOINS` (~L13-14) so each item in `itens:tarefa_itens(...)` also embeds the completer's name via the existing FK (`tarefa_itens.concluido_por → usuarios.id`, see `supabase/migration_046_tarefa_itens.sql:18` — this is a nested Supabase select, not a migration):
   ```
   itens:tarefa_itens(id, texto, concluido, ordem, concluido_em, concluido_por, concluido_por_usuario:usuarios!concluido_por(id, nome_exibicao))
   ```
   This is the only change to `SELECT_COM_JOINS`; it applies to every route using it (list/create/update/toggle), which is correct — the checklist needs this everywhere it's rendered.
5. **Do not** allow editing an existing task's `atribuido_para` to `"todos"` via `PATCH /:id` — leave `CAMPOS_EDITAVEIS` and `responsavelValido` untouched there. Because `responsavelValido` does a real user lookup, passing `"todos"` to PATCH will naturally 400 with the existing "Responsável precisa ser um usuário ativo..." message — acceptable, since the frontend (step below) will simply never offer "Todos" as an option while editing.

### Types (`src/features/tarefas/types.ts`)

- Add `UsuarioResumo` to the `concluido_por_usuario` field on `TarefaItem` (~L12-19): `concluido_por_usuario: UsuarioResumo | null;`

### Frontend — checklist display (`TarefaCards.tsx`, `ItemChecklistArrastavel`, ~L90-138)

Below the item text span (currently just `<span className={cn('text-text-primary', item.concluido && 'line-through opacity-60')}>{item.texto}</span>`), when `item.concluido && item.concluido_por_usuario`, render a second line:
```tsx
{item.concluido && item.concluido_por_usuario && (
  <span className="block text-xs text-text-faint">
    Concluído por {item.concluido_por_usuario.nome_exibicao}
    {formatarMomentoRelativo(item.concluido_em) && ` há ${formatarMomentoRelativo(item.concluido_em)}`}
  </span>
)}
```
Check `formatarMomentoRelativo`'s actual return shape/wording in `tarefaUtils.ts` before wiring this in — it's already imported in this file (see current `import { ..., formatarMomentoRelativo, ... } from './tarefaUtils'`) and already used elsewhere in the same file (e.g. "Designada em: {formatarMomentoRelativo(...)}"); match its existing return convention (whether it already includes a leading "há" or not) instead of assuming — adjust the template string so the final sentence reads naturally either way (spec example: "Concluído por Eduardo há 2 horas").

### Frontend — create form (`TarefasView.tsx`, `VisaoCriador`, responsible `<select>` ~L578-587)

Add a `"Todos"` option, **only in create mode** (not when `editando` is set):
```tsx
<select value={form.atribuido_para} onChange={(e) => setForm((f) => ({ ...f, atribuido_para: e.target.value }))} className={inputClass}>
  {responsaveis.map((r) => (
    <option key={r.id} value={r.id}>{r.nome_exibicao}</option>
  ))}
  {!editando && <option value="todos">Todos</option>}
</select>
```
No other change needed in `salvar()` (~L209-236) — `atribuido_para` already passes through as a plain string to `tarefasApi.criar`, and the backend now understands the `"todos"` sentinel.

**Tests**:
- Backend: extend `src/server/routes/tarefas.responsavel.test.ts` (or add a new colocated test file if that one doesn't fit) covering: POST with `atribuido_para: 'todos'` creates one row per eligible user with independent `itens`; each created row is only markable/visible by its own assignee (reuse existing toggle/list authorization, so this test mostly proves the *rows* are independent, not new authorization code); POST with `atribuido_para: 'todos'` and zero eligible users returns 400.
- Frontend: `ItemChecklistArrastavel` renders "Concluído por X" line when `concluido_por_usuario` is present on a completed item, and omits it otherwise.

**Acceptance** (verbatim from spec): admin cria tarefa "Todos"; cada responsável vê a sua; item concluído mostra "Concluído por X há Y"; usuário não-admin não marca checkbox de tarefa alheia (already true today via existing backend check — this task's job is to prove it still holds with N independent rows, not to add new restriction code).

---

## Task 3 — Correções da Nota/Invoice

**File**: `src/components/DeclaracaoVenda/NotaTemplate.tsx`

**Do**:
1. Watermark (currently ~L69-70, inside the `<div style={{...}}>` at ~L64-80): change `width: '420px', height: '420px'` to `width: '1260px', height: '1260px'`.
2. Print margins / header-footer suppression (currently the `<style>{...}</style>` block ~L29-45): the spec's literal `@bottom-center`/`@top-left` CSS margin-box syntax targets **paged media features that Chrome's print-to-PDF pipeline does not implement for suppressing the browser's own header/footer** (that header/footer — URL, date, page X/Y — is a Chrome print-dialog preference, not page content Chrome will let a page's CSS turn off). **Ruling:** implement the spec's own stated fallback instead of the non-functional margin-box rule, since the spec explicitly names it as "a solução mais confiável cross-browser": change `@page { margin: 10mm 14mm; }` to `@page { margin: 0; }`, and add matching padding directly to `#declaracao-venda-print`'s inline style (~L59, currently `padding: '20px 28px'`) so the content isn't flush against the physical page edge — convert the removed `10mm 14mm` page margin into an equivalent inline padding (`10mm` ≈ `38px`, `14mm` ≈ `53px` at 96dpi; combine with the existing `20px 28px` content padding into one value, e.g. `padding: '58px 81px'`, or keep both paddings additive if that reads more clearly in the diff — implementer's call, document the final numbers chosen in the report).
   Note in a one-line code comment (not a multi-line block) that whether the browser still prints its own header/footer text depends on the user's print-dialog "Headers and footers" checkbox, which page CSS cannot control — `margin: 0` only removes the *space* Chrome would otherwise reserve for that text in the common case, it is not a guarantee across every browser/print-dialog combination. This caveat must also appear in this task's completion report so it reaches the human partner's rulings list truthfully — this is a known limitation, not a bug to chase further.
3. Nothing else in this file changes.

**Tests**: this component is a print-only, `createPortal`-based visual template with no unit-testable business logic (no branching, no computed values beyond the two already-covered helpers `formatDateBR`/`cidadeLimpa`, both unchanged). Skip adding a test file for the CSS-only edits (do not force a snapshot test that would just assert static markup); if `NotaTemplate.test.tsx` already exists, confirm it still passes — do not add coverage that doesn't test behavior.

**Acceptance** (verbatim from spec, with the header/footer caveat above noted in the report): watermark ~3× maior; URL/paginação não aparecem quando a config do browser permite suprimi-los; conteúdo não é cortado pelas margens.

---

## Task 4 — Indicador de Fora de Estoque

**File**: `src/features/estoque/EstoqueView.tsx`

**Do**:
1. Mobile card name, currently (~L569):
   ```tsx
   <p className="text-[12.5px] font-medium text-text-primary truncate max-w-[240px]">{item.nome}</p>
   ```
   change to:
   ```tsx
   <p className={cn('text-[12.5px] font-medium truncate max-w-[240px]', item.quantidade === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{item.nome}</p>
   ```
   **Ruling (replaces spec's literal `text-text-tertiary`, which does not exist as a token):** use `text-text-faint` — it's this theme's most muted text token, and is already used elsewhere in this same file for de-emphasized text (e.g. "Último em estoque" label, faint captions). `cn` is already imported in this file — confirm the import at the top before use.
2. Desktop table name, currently (~L839):
   ```tsx
   <p className="text-sm font-medium text-text-primary truncate">{item.nome}</p>
   ```
   change to the same conditional pattern:
   ```tsx
   <p className={cn('text-sm font-medium truncate', item.quantidade === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{item.nome}</p>
   ```
3. Skip the spec's optional "Sem estoque" badge — the spec marks it optional ("Opcionalmente") and the struck-through faint name already communicates the state per the acceptance criteria; adding an extra badge risks tripping the CLAUDE.md "no decorative UI beyond what's needed" and "every alert needs an action" spirit for a purely informational label. Do not add it unless a later task/reviewer disagrees.

**Note for whoever implements Task 5 next**: both class strings above will be touched *again* by Task 5 to swap `truncate max-w-[240px]` / `truncate` for `break-words line-clamp-2 min-w-0` — leave the conditional color/line-through part exactly as written here so Task 5 can compose onto it cleanly.

**Tests**: extend or add a colocated `EstoqueView.test.tsx` (check first whether item-row rendering is already under test elsewhere, e.g. a table-row subcomponent test) covering: item with `quantidade === 0` renders the name with the faint/line-through class; item with `quantidade > 0` renders the normal primary-text class. Cover both the mobile card and desktop table code paths if they're reasonably separable in the test; if the two paths share no testable seam, one behavioral test per path is enough — don't force a shared harness that doesn't exist today.

**Acceptance** (verbatim from spec): nome com quantidade 0 aparece esmaecido/riscado; quantidade > 0 mantém estilo normal; funciona mobile e desktop.

---

## Task 5 — Texto Truncado (PC e Mobile)

**Files**: `src/features/estoque/EstoqueView.tsx`, `src/features/vendas/VendasView.tsx`, `src/features/tarefas/TarefaCards.tsx`

**Precondition**: Task 4 must be complete and committed first (see Pre-flight scan) — this task edits the same two `EstoqueView.tsx` lines Task 4 just changed. Re-read the file fresh before editing; do not work from the spec's original (pre-Task-4) snippet.

**Do**:
1. `EstoqueView.tsx`, mobile name (post-Task-4 state):
   ```tsx
   <p className={cn('text-[12.5px] font-medium truncate max-w-[240px]', item.quantidade === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{item.nome}</p>
   ```
   → replace `'truncate max-w-[240px]'` with `'break-words line-clamp-2 min-w-0'`:
   ```tsx
   <p className={cn('text-[12.5px] font-medium break-words line-clamp-2 min-w-0', item.quantidade === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{item.nome}</p>
   ```
   The immediate parent `<div className="min-w-0">` (currently ~L567) already provides the flex-truncation anchor the spec calls for — confirm it's still there, no change needed to it.
2. `EstoqueView.tsx`, desktop name (post-Task-4 state), same substitution:
   ```tsx
   <p className={cn('text-sm font-medium break-words line-clamp-2 min-w-0', item.quantidade === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{item.nome}</p>
   ```
   Check the desktop table cell's parent for a `min-w-0` (table cells often need `min-w-0` on the `<td>` or a wrapping `<div>` for a flex/grid child to actually shrink) — if the immediate container is a bare `<td>` without flex/grid, `min-w-0` on the `<p>` itself is sufficient (it isn't a flex item in that case) and no parent change is needed; if it IS a flex/grid cell, verify the parent already has `min-w-0` or add it to the smallest correct ancestor. Report which case applied.
3. `VendasView.tsx` L179:
   ```tsx
   // DE:
   <p className={cn('font-bold text-sm truncate min-w-0', 'text-text-primary')}>
   // PARA:
   <p className={cn('font-bold text-sm break-words line-clamp-2 min-w-0', 'text-text-primary')}>
   ```
4. `VendasView.tsx` L452:
   ```tsx
   // DE:
   <p className="font-bold truncate">{item.nome}</p>
   // PARA:
   <p className="font-bold break-words line-clamp-2">{item.nome}</p>
   ```
5. `TarefaCards.tsx` L449 (collapsed card title):
   ```tsx
   // DE:
   <p className={cn('text-sm font-medium text-text-primary truncate', concluida && 'line-through opacity-60')}>
   // PARA:
   <p className={cn('text-sm font-medium text-text-primary break-words line-clamp-2 min-w-0', concluida && 'line-through opacity-60')}>
   ```
   This line sits inside `motion.div layoutId=... className="min-w-0"` (~L445) next to a `flex items-center gap-1.5` row with a leading icon (~L446) — confirm the icon's `shrink-0` (already present, ~L447-448) still holds so a 2-line title doesn't squeeze the icon.
6. Leave `VendasView.tsx` L474 (`itemSelecionado.nome` in a detail panel, not in the spec's scope table) untouched — out of scope, don't touch files/lines beyond what's listed even for consistency.

**Tests**: extend the Task-4 `EstoqueView` test(s) to also assert the class list no longer contains `truncate`/`max-w-[240px]` and does contain `line-clamp-2`. Add equivalent colocated tests for `VendasView.tsx` and `TarefaCards.tsx` if test files already exist for them (check first); if neither has a component test file today, a single new minimal test per file is enough — don't scaffold a full test suite for a className-only change.

Also do one manual/visual check (not an automated test): resize to 320px width (matches the spec's explicit acceptance line) and confirm no horizontal overflow on Estoque (mobile card), Vendas, and Tarefas — this can be done with the project's browser preview tooling; if that's unavailable in this execution environment, note it in the report as unverified rather than claiming it.

**Acceptance** (verbatim from spec): nomes completos (até 2 linhas) no estoque mobile; nomes legíveis em VendasView sem cortar no meio da palavra; títulos de tarefa não cortam; layout não quebra em 320px.

---

## Final Review Focus

Point the final whole-branch reviewer at:
- The two token substitutions (Task 1's `tom="neutral"`, Task 4's `text-text-faint`) — confirm neither reintroduces a non-existent class anywhere.
- Task 2's N-rows approach — confirm no path was added that lets a non-eligible user or a `"todos"`-only pseudo-row leak through `responsavelValido`, and that `SELECT_COM_JOINS`'s new nested join doesn't break any existing caller (list/create/update/toggle all use it).
- Task 4 → Task 5 composition on the two `EstoqueView.tsx` lines — confirm the final class strings on disk match Task 5's post-Task-4 snippets exactly (i.e. Task 5 didn't accidentally revert Task 4's conditional color).
- Any `npm test` / `tsc --noEmit` regression across the whole branch, not just per-task.
