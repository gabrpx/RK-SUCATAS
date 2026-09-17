# Lembretes Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma aba de Lembretes operacional e interativa a `tarefas-preview`, preservando a fila prioritária atual.

**Architecture:** O modelo puro concentra a ordenação, filtragem e contador da prioridade máxima. `RemindersPanel` compõe apenas primitivas locais já incorporadas; `TasksPreview` troca entre Meu turno e Lembretes com Animate UI, sem modificar backend, banco ou `App.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Animate UI, Motion, Anime.js, DotMatrix e primitivos locais de gráficos Bklit.

**Spec:** `docs/DESIGN_SYSTEM.md`

## Global Constraints

- Não alterar a Fila Prioritária de Trabalho, backend, banco, APIs, dependências ou `src/App.tsx`.
- A nova superfície usa Geist/Inter; não introduz `font-mono`.
- Reutilizar componentes locais; não criar primitives de dropdown, dialog, tabs, tooltip, menu, drawer ou botão.
- Respeitar `prefers-reduced-motion`; movimentos só usam opacidade e transform.

---

### Task 1: Modelo de lembretes

**Files:**
- Create: `src/features/tarefas-preview/reminderModel.ts`
- Create: `tests/tarefas-preview/reminderModel.test.ts`

**Interfaces:**
- Produz `filterReminders(reminders, filter, query)` e `getReminderPrioritySummary(reminders)`.
- O resumo contém o lembrete aberto de maior prioridade e a quantidade nessa prioridade.

- [ ] Escrever um teste que prioriza P0, preserva o filtro e calcula a contagem P0.
- [ ] Executar o teste antes da implementação.
- [ ] Implementar tipos e helpers puros mínimos.
- [ ] Executar novamente o teste.

### Task 2: Painel de lembretes

**Files:**
- Create: `src/features/tarefas-preview/RemindersPanel.tsx`
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`

**Interfaces:**
- `RemindersPanel` recebe `onPriorityCountChange(count)` e atualiza a contagem após criar, concluir ou adiar lembretes.
- Usa `Tabs`, `Button`, `motion`, `animate`, `DotMatrix` e chart primitives já incorporados.

- [ ] Renderizar filtros, busca, cards, resumo de prioridade e painel de detalhes.
- [ ] Exibir apenas concluir e adiar por card; editar/excluir ficam em menu contextual reutilizado.
- [ ] Criar lembrete em diálogo com escolhas por botões, sem select nativo.
- [ ] Validar TypeScript e o fluxo manual.

### Task 3: Integração e identidade

**Files:**
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`
- Create: `docs/DESIGN_SYSTEM.md`

- [ ] Trocar a navegação superior por Meu turno e Lembretes usando Tabs do Animate UI.
- [ ] Manter a fila e seus filtros intactos dentro de Meu turno.
- [ ] Registrar fontes de componentes, fonte tipográfica e regras de interação no documento de design.
- [ ] Executar lint, build e inspeção no localhost.
