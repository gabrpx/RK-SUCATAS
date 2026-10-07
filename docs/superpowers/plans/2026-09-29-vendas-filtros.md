# Vendas Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abrupt Movimentações example toggle with the existing animated Tabs and make Vendas dropdown hover, keyboard, layering, and transitions predictable.

**Architecture:** Keep the Vendas filter state local. Use the shared `PreviewTabs` components for the time range, separate selected state from hover/focus in Select, anchor its menu to its trigger, and prevent nested Escape handlers from closing both Select and Popover. Reduce motion only in the Vendas filter popover usage.

**Tech Stack:** React, TypeScript, `motion/react`, existing `PreviewTabs`, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-notificacoes-filtros-busca-design.md`

## Global Constraints

- Work only in the canonical new system at `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`.
- Reuse existing UI components and dependencies; do not introduce a native `<select>` or new dependency.
- Preserve current Vendas filter values and demo behavior; formatting remains Brazilian currency throughout Vendas.
- Preserve dirty worktree changes and do not commit, push, or deploy.

## Review Focus

- Keyboard-only use can open Select, move options, commit one option, and close only the topmost layer with Escape.
- Pointer hover follows the hovered item while the selected marker remains attached only to the selected value.
- Long option labels and narrow viewport widths do not position the menu off-screen or detach it from its trigger.
- Filtering to zero movements shows the empty state and switching tabs back restores the correct rows.
- Reduced-motion preference removes row/popover travel without disabling filtering.

---

### Task 1: Repair Select positioning and interaction states

**Files:**
- Modify: `src/components/ui/Select.tsx` (already dirty; preserve existing changes and review diff first)
- Test: `src/components/ui/Select.test.tsx`

**Interfaces:**
- Consumes: current `Select` props and `renderOption`'s `{ selected, highlighted }` state.
- Produces: the same public API, with `aria-activedescendant`/option IDs and accessible listbox keyboard controls.

- [ ] Add tests for menu placement classes/trigger relationship, hover highlight versus selected marker, ArrowUp/ArrowDown, Home/End, Enter, and Escape.
- [ ] Run `npx vitest run src/components/ui/Select.test.tsx`; confirm new behavior fails before editing.
- [ ] Anchor menu with `top-full`, start/end alignment, and a bounded responsive width; initialize active option from selected value or first enabled option.
- [ ] Implement roving active option, keyboard navigation, outside click, and top-layer Escape behavior; make pointer hover update only the active highlight, never the selected marker.
- [ ] Run the Select test file and existing Combobox/MultiSelect tests to detect shared interaction regressions.

### Task 2: Reduce Vendas popover motion and prevent nested Escape propagation

**Files:**
- Modify: `src/components/ui/Popover.tsx` only if the scoped approach cannot be implemented at call sites (already dirty; inspect diff and all consumers first)
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Test: focused Popover interaction tests or Vendas filter interaction tests.

**Interfaces:**
- Consumes: current `PopoverRoot`, `PopoverTrigger`, and `PopoverContent` composition.
- Produces: an optional motion mode that lets Vendas use short opacity/position entry without shared trigger-panel morph; default behavior for other screens remains unchanged.

- [ ] Add a nested test: open filter popover, open Select, press Escape; assert Select closes while parent popover remains open.
- [ ] Add a test that Vendas uses its subtle mode while a default Popover consumer retains existing behavior.
- [ ] Implement the narrowest API/call-site option for disabling shared `layoutId` only in Vendas; stop propagation or centralize top-layer Escape handling so only the open Select closes first.
- [ ] Verify pointer, keyboard, outside-click, and reduced-motion behavior in the focused tests.

### Task 3: Replace example toggle and animate filtered row exits

**Files:**
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Test: `src/features/vendas-preview/VendasPreview.test.tsx` or the closest existing Vendas preview test.

**Interfaces:**
- Consumes: `hojeExpandido`, `movimentosFiltrados`, and shared `Tabs`, `TabsList`, `TabsTrigger`.
- Produces: two range tabs (“Todos os exemplos”, “7 dias”) controlling the same current dataset behavior.

- [ ] Add a test selecting each tab and assert the filtered movement list updates with the right subset.
- [ ] Add an empty-result test and verify no stale list rows remain.
- [ ] Replace the button with shared tabs and stable tab values; preserve accessible tab roles and selected state.
- [ ] Wrap rows in `AnimatePresence` with stable IDs and short opacity/vertical exit; honor `useReducedMotion` and preserve the existing empty message.
- [ ] Run focused Vendas and shared Tabs tests.

