# Overlays e Busca Global Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` para executar este plano em linha, tarefa por tarefa. O usuário já autorizou a execução direta. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o modal de criação de tarefas e entregar uma busca global acessível, rolável e animada sem alterar backend, banco ou dependências.

**Architecture:** Extrair a classificação e filtragem de resultados para um modelo puro testável. `GlobalSearch.tsx` consome esse modelo e controla a command palette; `TaskComposer.tsx` usa um picker portaled com opções limitadas à equipe e mantém os overlays visíveis até o `exit` terminar.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Motion e Node test/tsx.

**Spec:** `docs/prompts/implementacao-busca-global-rk-sucatas.md`

## Global Constraints

- Não instalar dependências nem alterar backend, banco, autenticação, APIs ou contratos públicos.
- Respeitar `prefers-reduced-motion`; animações visuais usam apenas opacidade e transform.
- Menus internos têm rolagem contida, affordance visual própria e nunca propagam a rolagem à página de fundo.
- Responsáveis de checklist são subconjunto da equipe selecionada na seção 02.

---

### Task 1: Modelo puro da busca

**Files:**
- Create: `src/components/globalSearchModel.ts`
- Create: `tests/components/globalSearchModel.test.ts`

**Interfaces:**
- Produz `buildGlobalSearchResults({ estoque, vendas, query, filter })` para resultados de estoque, vendas e atalhos de tarefas existentes.
- Produz `getSearchResultCounts(results)` para contagens dos filtros Todos, Estoque, Tarefas e Vendas.

- [x] **Step 1: Write the failing test**

```ts
test('filtra resultados por domínio e preserva o atalho de tarefas', () => {
  const results = buildGlobalSearchResults({ estoque, vendas, query: '', filter: 'tarefas' });
  assert.deepEqual(results.map((result) => result.kind), ['tarefa']);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/components/globalSearchModel.test.ts`
Expected: falha porque `globalSearchModel.ts` ainda não existe, ou registrar bloqueio real do runner.

- [x] **Step 3: Write minimal implementation**

```ts
export function buildGlobalSearchResults(input: SearchInput): SearchResult[] {
  return allResults.filter((result) => matchesFilter(result, input.filter) && matchesQuery(result, input.query));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/components/globalSearchModel.test.ts`
Expected: PASS ou bloqueio externo documentado.

### Task 2: Command palette global

**Files:**
- Modify: `src/components/GlobalSearch.tsx`
- Test: `tests/components/globalSearchModel.test.ts`

- [x] **Step 1: Render filters and keyboard state from the tested model**

```tsx
{FILTERS.map((filter) => <button aria-pressed={filter === activeFilter}>{filter}</button>)}
```

- [x] **Step 2: Contain scroll and preserve overlay lifecycle**

```tsx
<motion.section exit={{ opacity: 0, y: 12 }} className="max-h-[calc(100dvh-2rem)] overscroll-contain">
  <div className="overflow-y-auto [scrollbar-width:thin]">...</div>
</motion.section>
```

- [x] **Step 3: Verify interaction**

Run: `npm run lint; npm run build`
Expected: ambos passam; validar Ctrl/Cmd+K, setas, Enter, Escape, foco, scroll interno e saída.

### Task 3: Composer e picker de responsáveis

**Files:**
- Modify: `src/features/tarefas-preview/TaskComposer.tsx`

- [x] **Step 1: Make dependent owners valid by construction**

```ts
const checklistOperators = demoOperators.filter(({ id }) => operatorIds.includes(id));
```

- [x] **Step 2: Portal the picker, limit its height, style its scrollbar and contain scroll**

```tsx
createPortal(<div className="max-h-[min(18rem,calc(100dvh-2rem))] overflow-y-auto overscroll-contain">...</div>, document.body)
```

- [x] **Step 3: Preserve the composer through exit and animate local layout changes**

```tsx
<AnimatePresence onExitComplete={restoreFocus}>{open && <motion.form layout="size" exit={{ opacity: 0, y: 18 }} />}</AnimatePresence>
```

- [x] **Step 4: Verify overlay behavior**

Run: `npm run lint; npm run build`
Expected: ambos passam; validar adição de etapa, entrada/saída, equipe reduzida, menu no fim da tela e scroll sem mover a página de fundo.
