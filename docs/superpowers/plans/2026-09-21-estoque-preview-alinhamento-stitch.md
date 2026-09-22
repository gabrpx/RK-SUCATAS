# Estoque Preview — Alinhamento Stitch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer `/estoque-preview` explicar o catálogo Peça → Unidades e seguir a composição da Tela 1 do Stitch.

**Architecture:** Manter a planta física vazia e isolada, criando um catálogo demonstrativo próprio para a lente Atendimento. O catálogo mostra Peças e Unidades fictícias sem alterar o modelo de mapa; origem desconhecida é um valor explícito da unidade.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Motion, Lucide, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-21-estoque-preview-alinhamento-design.md`

## Global Constraints

- Não alterar `/estoque`, APIs, banco, dados reais, `src/App.tsx`, `src/context/DataContext.tsx`, `src/server/routes/`, `supabase/` ou dependências.
- Dados da página são fictícios; o mapa físico inicia com as 88 seções vazias e sem categoria.
- Uma Peça agrupa Unidades; fotos, preços, graus, endereços, reservas e origem pertencem à Unidade.
- Origem desconhecida não bloqueia uma unidade; foto ou compatibilidade pendente bloqueiam atendimento.
- Reserva exige sinal de 20%, dura sete dias corridos e não muda endereço.
- Usar Geist/Inter sem mono e reproduzir a composição da Tela 1 do Stitch.

---

### Task 1: Catálogo demonstrativo de Peças e Unidades

**Files:**
- Create: `src/features/estoque-preview/catalogoDemo.ts`
- Create: `src/features/estoque-preview/catalogoDemo.test.ts`

**Interfaces:**
- Produces `PecaDemo`, `UnidadeCatalogoDemo`, `catalogoDemonstrativo`, `buscarPecasDemo`.
- Each `UnidadeCatalogoDemo` has `origem: string | null`; `null` renders as `Origem não identificada`.

- [x] Write a failing test that finds one canonical “Motor de Partida” through “CB 300R” and asserts its unit with null origin remains available.
- [x] Run `npm.cmd test -- src/features/estoque-preview/catalogoDemo.test.ts` and confirm RED.
- [x] Implement only the data and pure search required for the test.
- [x] Run the focused test and confirm GREEN.

### Task 2: Atendimento com composição da Tela 1

**Files:**
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Modify: `src/features/estoque-preview/EstoquePreview.test.tsx`

**Interfaces:**
- Consumes `catalogoDemonstrativo` and `buscarPecasDemo`.
- Produces accessible tabs `Atendimento`, `Desmonte e triagem` and `Mapa físico`; the default tab is Atendimento.

- [x] Write failing UI tests for the default Atendimento tab, an expandable canonical Peça and a visible unit with “Origem não identificada”.
- [x] Run the focused UI test and confirm RED.
- [x] Rebuild the page shell: Tela 1 header, tabs, metric strip, hero, catalog left and operational panel right.
- [x] Render unit details with their own photos and fields; keep the reservation interaction local.
- [x] Run focused UI tests and confirm GREEN.

### Task 3: Mapa físico como apoio

**Files:**
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Test: `src/features/estoque-preview/EstoquePreview.test.tsx`

- [x] Write a failing test that switches to `Mapa físico` and finds `Categoria não definida` for a blank section.
- [x] Run it and confirm RED.
- [x] Reuse the existing physical map controls inside this secondary lens, preserving blank sections and custom category interaction.
- [x] Run focused tests, then `npm.cmd run lint`, `npm.cmd test` and `npm.cmd run build`.
