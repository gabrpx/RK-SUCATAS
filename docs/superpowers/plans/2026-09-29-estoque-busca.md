# Stock Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Stock text search accent-insensitive and able to find identifiers and descriptive fields across a piece and its physical units in both the current Stock tab and the legacy catalog.

**Architecture:** Extend the current `/estoque` preview search model and the legacy catalog's pure `correspondeBuscaEstoque` helper so each screen searches its own domain model consistently. In both, normalize accents and punctuation, match all query tokens across piece and unit fields, and preserve structured filters, pagination, exports, and empty states.

**Tech Stack:** React, TypeScript, Vitest, existing `Estoque`/`EstoqueUnidade` types.

**Spec:** `docs/superpowers/specs/2026-09-29-notificacoes-filtros-busca-design.md`

## Global Constraints

- Work only in `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`, the canonical app.
- Do not bypass Express, alter data, add dependencies, or change structured Stock filters.
- Keep multi-token AND semantics: every query token must occur somewhere in the searchable representation.
- Preserve worktree changes and do not commit, push, or deploy.

## Review Focus

- Accented and unaccented queries match the same Portuguese piece names and descriptions.
- Multiple tokens split across name and unit fields still match, while a missing token returns no result.
- Searching a unit in one child record keeps the entire family row visible.
- Null/undefined optional fields do not throw or hide otherwise matching items.
- Pagination resets and current filters/CSV source remain unchanged when query changes.

---

### Task 1: Centralize searchable fields and normalization

**Files:**
- Modify: `src/features/estoque-preview/inventoryPreviewModel.ts`
- Test: `src/features/estoque-preview/inventoryPreviewModel.test.ts`
- Modify: `src/features/estoque/gaveta/buscaGavetas.ts`
- Modify: `src/features/estoque/gaveta/buscaGavetas.test.ts`
- Modify: `src/features/estoque/familiaEstoque.ts`
- Modify: `src/features/estoque/familiaEstoque.test.ts`

**Interfaces:**
- Consumes: `Estoque`, `EstoqueUnidade`, existing `normalizarTextoBusca`, `correspondeBuscaEstoque`, and `EstoqueLinha`.
- Produces: family-row matching that reuses normalized search over the full item; preserve existing `filtrarLinhaTexto(linha, terms)` signature if external consumers require it.

- [ ] Add tests that unaccented “oleo” finds “óleo”, SKU matches a unit, and a unit nickname/description/avaria text matches the piece.
- [ ] Add family-row tests where one child contains all tokens across item/unit fields and another child does not.
- [ ] Run `npx vitest run src/features/estoque/gaveta/buscaGavetas.test.ts src/features/estoque/familiaEstoque.test.ts`; confirm new cases fail.
- [ ] Extend the searchable text to include piece code/name/description/year/category/model/compatible models and unit SKU/name/description/avaria plus available physical location/origin fields confirmed by the type.
- [ ] Make `filtrarLinhaTexto` call the common normalizer/matcher while retaining row-family semantics and backward-compatible parameters.
- [ ] Run the two focused helper test files.
- [ ] Extend current Stock preview `buscarPecas` to normalize punctuation and accents and require every token across piece name/code/category/details/compatibility/family/drawer and unit SKU/address/origin/details/archive/reservation/status/grade fields.
- [ ] Add and run cases where query terms span piece and unit fields, SKU plus address match together, and a missing token rejects the result.

### Task 2: Use the shared search for both Stock result models

**Files:**
- Modify: `src/features/estoque/EstoqueView.tsx`
- Modify: `src/features/estoque-preview/EstoquePreview.tsx` (describe expanded search fields in its placeholder)
- Test: `src/features/estoque/EstoqueView.tabela.test.tsx`

**Interfaces:**
- Consumes: debounced search and existing non-search filtered item list.
- Produces: flat result metrics/CSV and grouped table rows based on the same helper, with current structured filters intact.

- [ ] Add a component test where an unaccented unit SKU query returns the expected stock family row and resets the page to index 0.
- [ ] Run the focused component test and confirm it fails before the view change.
- [ ] Replace duplicated lowercase token matching in both `filtered` and `filteredLinhas` with the shared helper; memoize on the existing dependencies.
- [ ] Verify structured filter and family grouping remain in place, then run focused stock search/table tests.
- [ ] Inspect the final diff for changes to pagination, CSV export source, filter composition, or stock data mutation; none should be introduced.

