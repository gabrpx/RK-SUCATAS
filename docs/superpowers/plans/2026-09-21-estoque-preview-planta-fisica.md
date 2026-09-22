# Estoque Preview — Planta Física Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recriar a rota isolada `/estoque-preview` como uma simulação fiel do novo estoque físico: 11 prateleiras, oito seções por prateleira, busca, cadastro unitário e filas operacionais.

**Architecture:** O preview permanece inteiramente no frontend e usa somente dados fictícios. Um módulo puro descreve a planta, os endereços e transições de unidade; componentes pequenos usam esse módulo para desenhar mapa, lista e fluxos simulados. A rota pública já existente será preservada, sem tocar na tela de estoque real nem em APIs.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Motion, Lucide, Animate UI existente, Vitest, Testing Library.

**Spec:** `docs/ESTOQUE_REDESIGN_PLANTA_APROVADA.md`

> **Amendment — categories:** The 88 physical sections must start empty, with no suggested category assigned. A category is free text defined by the team when a section begins to be filled. This supersedes any earlier fixed category distribution in this plan. The preview stays isolated; persistence of this configuration belongs to the later approved implementation of `/estoque`.

## Global Constraints

- Não alterar `src/App.tsx`, `src/context/DataContext.tsx`, `src/server/routes/`, `supabase/`, `package.json`, lockfiles, dados reais ou APIs.
- Não criar migration, endpoint, integração de Storage, nem importar cadastro legado.
- Manter `/estoque-preview` isolada e com dados fictícios.
- Cadastro é sempre uma unidade física; não expor campo quantidade.
- Endereço vendável obedece `P01-S01` até `P11-S08`; locais especiais ficam fora do mapa.
- As 88 seções iniciam como `Categoria não definida`; não impor motor, elétrica, freio ou qualquer lista fechada de categorias.
- Reserva só é simulada após sinal de 20%, dura sete dias corridos e não move a unidade.
- Usar Geist/Inter e componentes já existentes; nenhuma fonte mono; respeitar `prefers-reduced-motion`.
- Antes de escrever a superfície, conferir o projeto Stitch `https://stitch.withgoogle.com/projects/17500618004917399514` e `docs/DESIGN_SYSTEM.md`; reproduzir a hierarquia visual, não uma interpretação genérica da paleta.
- Não fazer commit, push, merge ou deploy sem solicitação explícita do usuário.

---

## File Structure

- `src/features/estoque-preview/physicalStockModel.ts` — tipos, mapa P01–P11, dados fictícios e transições puras.
- `src/features/estoque-preview/physicalStockModel.test.ts` — testes das invariantes da planta e do fluxo unitário.
- `src/features/estoque-preview/EstoquePreview.tsx` — composição da página e estados locais do preview.
- `src/features/estoque-preview/EstoquePreview.test.tsx` — testes de busca, troca de visualização, mapa, cadastro e reserva.
- `src/features/estoque-preview/previewRoute.ts` — permanece a única regra de rota isolada; alterar somente se o teste exigir normalização adicional.
- `src/features/estoque-preview/previewRoute.test.ts` — cobertura da rota isolada.
- `src/main.tsx` — não alterar salvo se a rota isolada deixar de funcionar; a implementação atual já é suficiente.

### Task 1: Modelo da planta e seus invariantes

**Files:**
- Create: `src/features/estoque-preview/physicalStockModel.ts`
- Create: `src/features/estoque-preview/physicalStockModel.test.ts`

**Interfaces:**
- Produces `EnderecoFisico = 'P01-S01' | ...`, `SecaoEstoquePreview`, `UnidadeFisicaPreview`, `criarPlantaEstoquePreview()`, `buscarUnidadesNaPlanta()`, `adicionarUnidadeDemo()` e `reservarUnidadeDemo()`.
- Consumes no backend, browser storage ou dados de `src/features/estoque/`.

- [ ] **Step 1: Write the failing model tests**

```ts
expect(criarPlantaEstoquePreview()).toHaveLength(11);
expect(criarPlantaEstoquePreview().flatMap((prateleira) => prateleira.secoes)).toHaveLength(88);
expect(adicionarUnidadeDemo(planta, { categoria: 'Estator', endereco: 'P05-S03' }).unidades).toHaveLength(1);
expect(reservarUnidadeDemo(planta, 'sku-1001', new Date('2026-09-21T12:00:00.000Z')).unidade.reservadaAte)
  .toBe('2026-09-28T12:00:00.000Z');
```

- [ ] **Step 2: Run the model test to verify it fails**

Run: `npm.cmd test -- src/features/estoque-preview/physicalStockModel.test.ts`

Expected: FAIL because `physicalStockModel.ts` does not exist.

- [ ] **Step 3: Implement the model minimally**

```ts
export interface SecaoEstoquePreview {
  endereco: string;
  categoria: string | null;
  unidades: UnidadeFisicaPreview[];
}

export function criarEndereco(prateleira: number, secao: number) {
  return `P${String(prateleira).padStart(2, '0')}-S${String(secao).padStart(2, '0')}`;
}
```

Populate every physical address with an empty category and no seeded units, reject an address outside P01–P11/S01–S08, and make `adicionarUnidadeDemo` create exactly one unit while assigning the typed category to a previously blank section.

- [ ] **Step 4: Run the model test to verify it passes**

Run: `npm.cmd test -- src/features/estoque-preview/physicalStockModel.test.ts`

Expected: PASS.

### Task 2: Mapa físico e busca como perspectiva principal

**Files:**
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Test: `src/features/estoque-preview/EstoquePreview.test.tsx`

**Interfaces:**
- Consumes `criarPlantaEstoquePreview()` and `buscarUnidadesNaPlanta()` from `physicalStockModel.ts`.
- Produces a map-first UI with accessible controls named `Mapa físico`, `Lista auxiliar` and `Buscar peça, categoria ou moto`.

- [ ] **Step 1: Replace the old catalog-first test with failing map tests**

```tsx
render(<EstoquePreview />);
expect(screen.getByRole('button', { name: 'Mapa físico' })).toHaveAttribute('aria-pressed', 'true');
expect(screen.getByText('P01')).toBeTruthy();
expect(screen.getByText('P11')).toBeTruthy();
fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar peça, categoria ou moto' }), { target: { value: 'CG 160' } });
expect(screen.getByText(/localizaç(ão|oes) encontrada/i)).toBeTruthy();
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx`

Expected: FAIL because the current preview has no physical-map controls or `P01`–`P11` map.

- [ ] **Step 3: Inspect the approved visual reference**

Open the approved Stitch project and compare its latest target to `docs/DESIGN_SYSTEM.md`. Record the concrete hierarchy that must travel to the preview: rounded outer container, microcaps breadcrumb, metric strip, dominant workspace, restrained accent action and decision rail. Do not copy the legacy stock table or use mono type.

- [ ] **Step 4: Rebuild the primary surface**

Build a new light Stitch/Tarefas-style surface from the approved spec: rounded outer container, microcaps breadcrumb, concise metrics, one primary action `Adicionar unidade`, search, 11 physical rack cards and right-side decision panels. Each rack renders four rows by two columns and exposes the address plus category. Search highlights matching sections rather than replacing the map.

- [ ] **Step 5: Run the component test to verify it passes**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx`

Expected: PASS.

### Task 3: Detalhe, lista auxiliar e filas operacionais

**Files:**
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Modify: `src/features/estoque-preview/EstoquePreview.test.tsx`

**Interfaces:**
- Consumes `SecaoEstoquePreview` and `UnidadeFisicaPreview` from `physicalStockModel.ts`.
- Produces section detail, a list grouped by physical address, `Reservas` and `Para organizar` panels.

- [ ] **Step 1: Add failing interaction tests**

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Lista auxiliar' }));
expect(screen.getByRole('heading', { name: 'Lista por localização' })).toBeTruthy();
fireEvent.click(screen.getByRole('button', { name: /ver seção P05-S03/i }));
expect(screen.getByText('Estator')).toBeTruthy();
expect(screen.getByText(/Reservada.*restante/i)).toBeTruthy();
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx`

Expected: FAIL because the rebuilt map does not yet expose list grouping or section detail.

- [ ] **Step 3: Implement the secondary perspectives**

Create an accessible section drawer/dialog that shows unit photo, SKU, compatibility, lot, grade, price and status. Add the rare list view grouped by `Pxx-Sxx`, visually distinct from the legacy table. Panels must show reservation time remaining and the `Para organizar` queue; unavailable units cannot appear as ready to sell.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx`

Expected: PASS.

### Task 4: Cadastro unitário e reserva simulados

**Files:**
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Modify: `src/features/estoque-preview/EstoquePreview.test.tsx`

**Interfaces:**
- Consumes `adicionarUnidadeDemo()` and `reservarUnidadeDemo()` from `physicalStockModel.ts`.
- Produces an accessible `Adicionar unidade` flow with a custom category listbox and `Confirmar sinal de 20%` reservation confirmation.

- [ ] **Step 1: Add failing flow tests**

```tsx
fireEvent.click(screen.getByRole('button', { name: 'Adicionar unidade' }));
expect(screen.queryByLabelText(/quantidade/i)).toBeNull();
fireEvent.click(screen.getByRole('button', { name: 'Categoria' }));
fireEvent.click(screen.getByRole('option', { name: 'Estator' }));
fireEvent.click(screen.getByRole('button', { name: 'Confirmar localização P05-S03' }));
expect(screen.getByText('1 unidade adicionada ao mapa')).toBeTruthy();
```

- [ ] **Step 2: Run the flow test to verify it fails**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx`

Expected: FAIL because no unitary-add flow exists.

- [ ] **Step 3: Implement the two simulated flows**

The add flow requires category, demo photo choice, grade, compatibility and one approved physical address; lot is optional and cost is never requested as mandatory. It must never have quantity. The reservation flow uses a selected available unit, explicitly states 20% and seven days, keeps the physical address unchanged and displays the remaining time.

- [ ] **Step 4: Run the flow test to verify it passes**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx`

Expected: PASS.

### Task 5: Visual, motion and isolated-route verification

**Files:**
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Modify: `src/features/estoque-preview/previewRoute.test.ts` only if the existing route test needs new coverage.

**Interfaces:**
- Preserves `ehRotaEstoquePreview(pathname: string): boolean` and the `/estoque-preview` entry point in `src/main.tsx`.

- [ ] **Step 1: Add any missing accessibility assertions before styling refinement**

```tsx
expect(screen.getByRole('searchbox', { name: 'Buscar peça, categoria ou moto' })).toBeTruthy();
expect(screen.getByRole('button', { name: 'Adicionar unidade' })).toBeTruthy();
expect(screen.getByRole('button', { name: 'Mapa físico' })).toHaveAttribute('aria-pressed', 'true');
```

- [ ] **Step 2: Run focused tests to verify the assertions fail if controls are not exposed**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx src/features/estoque-preview/previewRoute.test.ts`

Expected: PASS only after all named controls and route behavior are present.

- [ ] **Step 3: Refine visual behavior without altering product rules**

Use only opacity/transform Motion transitions, reduced-motion guards, 44px touch targets and responsive map stacking. Verify no mono font, no native dialog/select/alert, no horizontal page scroll and no extra filled primary button.

- [ ] **Step 4: Run final validation**

Run: `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx src/features/estoque-preview/physicalStockModel.test.ts src/features/estoque-preview/previewRoute.test.ts`

Expected: PASS.

Run: `npm.cmd run lint`

Expected: PASS.

Run: `npm.cmd run build`

Expected: PASS; document any pre-existing size warning.

Run manually: open `http://127.0.0.1:5173/estoque-preview`, search by a compatible motorcycle, open a section, add one demo unit and reserve an available unit. Confirm that the map remains visible, the address does not change on reservation and no real system data is touched.

## Self-review

- Spec coverage: Tasks 1–2 cover the 88-address plant and map-first design; Task 3 covers list, section visibility and queues; Task 4 covers unitary entry and 20%/seven-day reservation; Task 5 covers visual identity, accessibility and isolation.
- Deliberate exclusions: real database, legacy conversion, special locations, server/API, sales/RPC and deployment have no tasks because the approved spec excludes them.
- Placeholder scan: no task relies on an unspecified backend, “later” implementation or inferred legacy conversion.
- Type consistency: every UI task consumes the types and functions introduced in Task 1; the existing route contract remains unchanged.
