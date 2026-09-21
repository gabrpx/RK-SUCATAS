# Tarefas Preview Visual e Preparação de Integração Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a scrollbar visual dos filtros de lembretes, comunicar overflow horizontal com fade coerente com a identidade azul do preview e deixar documentado o caminho seguro para integrar `/tarefas` real.

**Architecture:** O preview continuará isolado e manterá seus dados demonstrativos. Um helper puro calculará os limites de overflow; `RemindersPanel` cuidará apenas da medição, faixa rolável e fades. A integração real será preparada por um contrato/adaptador documentado, porque o backend atual não possui rotas ou modelos de tarefas/lembretes confirmados.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Motion, Animate UI e Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-17-tarefas-preview-integracao-design.md`

## Global Constraints

- Não alterar banco, migrations, RLS, autenticação, dependências ou deploy.
- Não inventar endpoints de tarefas, lembretes, usuários ou participantes.
- Manter a rota `/tarefas-preview` isolada e sem dados reais.
- Esconder somente barras de rolagem de faixas horizontais; a rolagem vertical da página permanece disponível.
- Fades devem ser `pointer-events-none`, condicionais ao conteúdo disponível e compatíveis com `prefers-reduced-motion`.
- Hover e foco da superfície de lembretes devem usar azul, esmeralda, âmbar ou rosa; não usar roxo/violeta.

---

### Task 1: Modelo puro de overflow horizontal

**Files:**
- Create: `src/features/tarefas-preview/previewOverflowModel.ts`
- Create: `tests/tarefas-preview/previewOverflowModel.test.ts`

**Interfaces:**
- Produz `getHorizontalOverflowState({ scrollLeft, scrollWidth, clientWidth })`.
- Retorna `isScrollable`, `canScrollLeft` e `canScrollRight` com tolerância de pixels.

- [x] Escrever testes para faixa sem overflow, início, meio e fim.
- [x] Executar os testes e confirmar a falha inicial.
- [x] Implementar o helper puro mínimo.
- [x] Executar novamente os testes.

### Task 2: Faixa de filtros de lembretes

**Files:**
- Modify: `src/features/tarefas-preview/RemindersPanel.tsx`
- Modify: `src/index.css` somente para escopo visual do preview

**Interfaces:**
- Usar `ResizeObserver`/`scroll` para atualizar o estado da faixa.
- Renderizar fades laterais somente quando houver conteúdo naquela direção.
- Reutilizar `.no-scrollbar` para remover o indicador nativo sem remover interação por toque, teclado ou trackpad.

- [x] Envolver os filtros em um viewport relativo com rolagem horizontal.
- [x] Aplicar `.no-scrollbar` e `overscroll-contain` somente à faixa.
- [x] Adicionar fades azuis discretos com `aria-hidden` e `pointer-events-none`.
- [x] Remover qualquer hover roxo da superfície de lembretes.
- [x] Preservar a animação local existente dos cards e validar estados vazio/concluído.

### Task 3: Preparação da integração real

**Files:**
- Create: `docs/superpowers/specs/2026-09-18-tarefas-real-integracao-prerequisitos.md`

**Interfaces:**
- Registrar o inventário real confirmado: `TasksView` usa `seedTasks`; não há rotas Express de tarefas/lembretes no estado atual.
- Definir os contratos que precisam ser aprovados antes de implementar: leitura, criação, atualização de status, checklist, participantes, responsáveis, lembretes, autorização e persistência.

- [x] Documentar o estado atual e a divergência da especificação anterior.
- [x] Separar contratos existentes de contratos ainda inexistentes.
- [x] Listar a próxima etapa segura sem alterar banco/API neste turno.

### Task 4: Validação

- [x] Executar `tsc --noEmit`.
- [x] Executar os testes do preview.
- [x] Executar `vite build`.
- [x] Executar `git diff --check`.
- [ ] Validar visualmente filtros em viewport estreita e desktop.
- [ ] Confirmar em desktop que a rolagem vertical continua disponível e a faixa horizontal não exibe scrollbar nativa.
