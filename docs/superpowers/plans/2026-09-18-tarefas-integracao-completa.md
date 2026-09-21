# Tarefas Real Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir `/tarefas` pela experiência visual aprovada, conectando tarefas, checklist, participantes, responsáveis e lembretes às APIs e tabelas reais já existentes no sistema.

**Architecture:** Reutilizar os contratos reais de `tarefas`, `tarefa_itens`, `tarefa_participantes`, `tarefa_imagens`, `lembretes` e `usuarios`. A tela receberá adaptadores puros que convertem entidades persistidas para o modelo visual do preview; mutações continuarão passando pelo Express e nunca pelo Supabase no navegador.

**Tech Stack:** React, TypeScript, Express, Supabase service role, JWT existente, Tailwind, Motion.

**Spec:** `docs/superpowers/specs/2026-09-17-tarefas-preview-integracao-design.md`

## Global Constraints

- Preservar as alterações visuais existentes em `tarefas-preview`.
- Não expor a service role do Supabase ao navegador.
- Não editar migrations aplicadas; a extensão de status será migration nova.
- Não executar DDL ou alterar dados reais do Supabase nesta etapa.
- Reutilizar usuários e permissões reais; não criar cadastro paralelo.

### Task 1: Contratos reais e adaptadores de apresentação

**Files:**
- Create: `src/features/tarefas/realTaskModel.ts`
- Create: `tests/tarefas/realTaskModel.test.ts`
- Modify: `src/features/tarefas-preview/taskPreviewModel.ts`

- [ ] Definir tipos mínimos para tarefa, lembrete e usuário retornados pela API.
- [ ] Criar conversões determinísticas de status, prioridade, prazo, checklist e participantes.
- [ ] Cobrir conversões com testes antes da integração visual.

### Task 2: API Express e persistência

**Files:**
- Create/modify: `src/server/routes/tarefas.ts`
- Create/modify: `src/server/routes/lembretes.ts`
- Modify: `server.ts`
- Modify: `middleware/auth.ts`
- Create: `supabase/migration_062_tarefas_status_em_andamento.sql`

- [ ] Expor leitura, criação, edição, início, conclusão, reabertura e checklist.
- [ ] Expor leitura, criação, adiamento, conclusão, reabertura e exclusão de lembretes.
- [ ] Reutilizar usuários ativos e regras de permissão existentes.
- [ ] Adicionar a migration aditiva para `em_andamento`, sem executá-la no banco remoto.

### Task 3: Conexão da tela nova

**Files:**
- Create: `src/features/tarefas/realTasksApi.ts`
- Create: `src/features/tarefas/useRealTasks.ts`
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`
- Modify: `src/features/tarefas-preview/TaskComposer.tsx`
- Modify: `src/App.tsx`

- [ ] Carregar tarefas, lembretes e responsáveis reais.
- [ ] Fazer criação, checklist, início, conclusão, reabertura e lembretes refletirem na API.
- [ ] Usar a tela nova em `/tarefas` e manter `/tarefas-preview` como rota de validação visual.
- [ ] Exibir carregamento, erro e confirmação sem reintroduzir dados seed no `/tarefas`.

### Task 4: Validação

- [ ] Executar testes unitários e de rotas.
- [ ] Executar type-check e build.
- [ ] Validar visualmente `/tarefas` em viewport estreita e desktop.
- [ ] Revisar diff, permissões, migration e ausência de acesso direto ao Supabase no frontend.
