# Vendas Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a composição mobile da tela Vendas para eliminar o scroll horizontal das tabs e tornar os gráficos legíveis e úteis em larguras de 375px sem alterar regras financeiras.

**Architecture:** Manter a tela e os componentes de gráfico existentes, extraindo apenas regras puras de apresentação para facilitar teste. A navegação de tabs usará grid responsivo no mobile e layout inline no desktop. Os gráficos continuarão com dados diários e tooltip, mas reduzirão marcadores/rótulos e declararão altura/legenda responsivas para evitar colisões.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Recharts, componentes `AreaChart` internos, Vitest e Testing Library.

**Spec:** Feedback visual fornecido pelo usuário nas capturas de Vendas mobile e os critérios de aceite registrados neste plano.

## Global Constraints

- O checkout canônico é `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`; não usar o projeto legado nem a porta 4173.
- Frontend acessa somente a API Express; nenhuma alteração em Supabase, RPC, autenticação ou regras financeiras.
- Não editar `package-lock.json`, `dist/`, `node_modules/` ou arquivos locais não relacionados já modificados.
- Manter tokens e classes do design system; não introduzir hex diretamente em novos componentes fora dos tokens existentes.
- Interface pt-BR, mobile-first em 375px, desktop a partir de 768px, com foco visível e `prefers-reduced-motion` preservado.
- Tabs devem caber sem `overflow-x-auto`/barra lateral em viewport mobile; navegação por teclado continua funcionando.
- Gráficos de 30 dias não devem renderizar um marcador em cada ponto nem sobrepor rótulos; tooltip continua apresentando o detalhe diário.
- Toda alteração termina com uma entrada nova em `src/features/patchnotes/data.ts`.

## Review Focus

- Viewport estreito de 320–375px: tabs, título e controles não podem criar overflow horizontal.
- Labels longos (`Movimentações`, `Pendências`) e contador de pendências: devem quebrar ou truncar de forma legível, sem alterar o nome acessível.
- Períodos curtos e longos (Hoje, 30 dias, Este mês): ticks e marcadores devem manter legibilidade e valor do tooltip.
- Dados vazios ou concentrados em um único dia: gráfico deve continuar com escala e legenda compreensíveis.
- Navegação por teclado e redução de movimento: tabs mantêm roving tabindex, e animações respeitam `prefers-reduced-motion`.

### Task 1: Regressão testável da apresentação mobile

**Files:**
- Create: `src/features/vendas-preview/components/salesChartModel.ts`
- Test: `src/features/vendas-preview/components/salesChartModel.test.ts`
- Modify: `src/features/vendas-preview/VendasPreview.test.tsx`

**Interfaces:**
- Produces `getSalesChartPresentation(days: number)` returning `{ tickCount: number; showMarkers: boolean; height: number }`.
- Produces `getSalesChartTabLayout()` returning the class contract used by the Vendas tabs, if a pure helper is preferable; otherwise the tab regression stays in DOM class assertions.

- [ ] **Step 1: Write failing tests** for 30-day presentation (`tickCount` no maior que 5, `showMarkers` false, height at least 220), 7-day presentation (markers allowed and ticks no maior que 7), and Vendas tabs not exposing an `overflow-x-auto` class while keeping all four tabs.
- [ ] **Step 2: Run the focused tests** with `npm test -- src/features/vendas-preview/components/salesChartModel.test.ts src/features/vendas-preview/VendasPreview.test.tsx`; confirm failure is caused by missing presentation helper/layout contract.
- [ ] **Step 3: Add the minimal pure presentation helper** and update the test fixture/mocks only as needed to assert DOM classes, without changing financial calculations.
- [ ] **Step 4: Run the focused tests again** and confirm they pass.

### Task 2: Corrigir tabs e gráficos no mobile

**Files:**
- Modify: `src/features/vendas-preview/VendasPreview.tsx:465-469`
- Modify: `src/features/vendas-preview/components/SalesCharts.tsx`
- Modify: `src/features/vendas-preview/components/salesChartModel.ts`

**Interfaces:**
- Consumes `getSalesChartPresentation(days)` from Task 1.
- Keeps `SalesTrendChart`, `CashFlowChart` and their current props/financial data unchanged.

- [ ] **Step 1: Apply the mobile tab layout**: replace the horizontal scrolling wrapper with a full-width mobile grid (two columns, no horizontal overflow), allow long labels to wrap inside each trigger, and restore the existing inline-fit tabs from `sm` upward.
- [ ] **Step 2: Apply adaptive sales chart presentation**: use the helper for tick count, marker visibility and height; keep daily points/tooltip, use fewer x-axis labels, remove edge fade/marker density that causes collisions on 30 days, and add a concise accessible chart description.
- [ ] **Step 3: Apply the same mobile safety to cash flow chart**: reserve enough bottom space for sparse x-axis ticks, keep tooltip and series colors, and prevent label clipping inside the card.
- [ ] **Step 4: Run focused tests and `npm run lint`**; fix only regressions directly caused by this change.

### Task 3: Patch notes, visual verification and delivery gate

**Files:**
- Modify: `src/features/patchnotes/data.ts`

- [ ] **Step 1: Add a patch note** describing the mobile tabs and chart readability fix.
- [ ] **Step 2: Start the canonical app on port 3001**, inspect `/vendas` at a 375px viewport if available, and confirm no horizontal scrollbar, readable tabs, and usable chart tooltip/labels.
- [ ] **Step 3: Run `npm test`, `npm run lint`, and `npm run build`; record actual results and review `git diff`.
- [ ] **Step 4: Commit only the scoped files (leaving pre-existing user changes untouched), push the current branch, and deploy through the repository's configured production path after confirming the destination.

## Self-review

- All three user-visible problems map to Task 2: tab overflow, incoherent mobile density, and unusable charts.
- Task 1 pins the critical presentation behavior before implementation; Task 3 verifies the real viewport and build.
- No backend, database, financial rule, dependency, or authentication changes are necessary.
