# Tarefas Preview — Execução e Criação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar os fluxos de detalhe e criação de tarefa no preview operacional.

**Architecture:** Concentrar os dados de apresentação no modelo de preview e
manter os componentes visuais em `TasksPreview.tsx` e `TaskComposer.tsx`. O
drawer recebe uma barra de ação fixa e o composer usa seções sem duplicar o
estado de responsáveis.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Motion, Animate UI.

**Spec:** `docs/superpowers/specs/2026-09-17-tarefas-preview-execucao-e-criacao-design.md`

## Global Constraints

- Sem backend, banco, dependências ou alterações de contrato público.
- Título continua sendo o único requisito obrigatório para criar no preview.
- Usar animações apenas em `opacity` e `transform` e respeitar redução de movimento.

---

### Task 1: Modelo de apresentação de tarefa

**Files:**
- Modify: `src/features/tarefas-preview/taskPreviewModel.ts`
- Test: `tests/tarefas-preview/taskPreviewModel.test.ts`

- [ ] Escrever testes para classificar tarefa individual/coletiva e construir o resumo do checklist.
- [ ] Executar o teste para observar a falha.
- [ ] Implementar helpers puros mínimos no modelo.
- [ ] Executar os testes novamente.

### Task 2: Drawer de detalhes de execução

**Files:**
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`
- Test: `tests/tarefas-preview/taskPreviewModel.test.ts`

- [ ] Usar o resumo do modelo para distinguir tarefa individual e coletiva no drawer.
- [ ] Substituir contexto fixo por metadados verificáveis da tarefa.
- [ ] Adicionar histórico de confirmação e barra inferior de ação contextual.
- [ ] Verificar TypeScript e o preview local.

### Task 3: Composer organizado por decisão operacional

**Files:**
- Modify: `src/features/tarefas-preview/TaskComposer.tsx`
- Test: `tests/tarefas-preview/taskPreviewModel.test.ts`

- [ ] Reorganizar os campos em quatro seções sem mudar o contrato de `onCreate`.
- [ ] Unificar seleção e resumo de responsáveis.
- [ ] Associar responsável a cada checklist e preservar labels enviados ao modelo.
- [ ] Adicionar confirmação de descarte quando o formulário estiver alterado.
- [ ] Verificar TypeScript, build e preview local.
