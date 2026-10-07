# Tarefas Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each employee their unread assigned tasks in a shared inbox, remove a task from pending only when its detail is opened, and retain per-employee read receipts.

**Architecture:** Reuse `tarefa_participantes.lida`, `GET /api/tarefas`, and `PATCH /api/tarefas/:id/marcar-lida`. Add participant rows to newly created single-assignee tasks, a reusable inbox component, and navigation props from the real Stock screen into the selected task detail in Tarefas. The integrated task detail must call the existing mark-read endpoint only after it opens. Managers see read state only for participants on tasks they can already access.

**Tech Stack:** React, TypeScript, Express, Supabase server client, Vitest, existing `motion/react` UI.

**Spec:** `docs/superpowers/specs/2026-09-29-notificacoes-filtros-busca-design.md`

## Global Constraints

- The canonical app is `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`; never use the legacy project or its port 4173.
- The frontend accesses task data only through Express; do not expose the Supabase service role or access Supabase in the browser.
- Reuse migration_060 and the existing mark-read endpoint; do not create a migration or execute SQL.
- Do not alter existing task authorization or allow the client to submit another user's read receipt.
- Preserve existing work in the current dirty worktree and do not commit, push, or deploy.

## Review Focus

- A task assigned to the creator should not create a self-notification; a task assigned to another employee should create one unread receipt.
- Opening the inbox must not mark tasks read; opening the task detail must.
- Reading by one participant must not clear the other participant's inbox entry.
- A delayed task-list refresh must not reopen a task that the user already dismissed.
- Tasks without participant joins (legacy rows) must remain usable and must not appear as false unread notifications.

---

### Task 1: Persist the single-assignee read receipt

**Files:**
- Modify: `src/server/routes/tarefas.ts` (critical route; inspect full route, auth middleware, and current local diff before edits)
- Test: `src/server/routes/tarefas.todos.test.ts`

**Interfaces:**
- Consumes: existing `POST /api/tarefas`, `tarefa_participantes`, `req.usuario.id`, and `marcar-lida` endpoint.
- Produces: each newly created single-assignee task has one participant row with `lida=true` only if the assignee is the creator; otherwise `lida=false`.

- [ ] Add a failing route test that creates a task assigned to `u2` by `u1` and asserts a participant insert `{ tarefa_id, usuario_id: 'u2', lida: false }`.
- [ ] Add a failing self-assignment test asserting `lida: true`, and update the legacy test that currently expects no participant insert.
- [ ] Run `npx vitest run src/server/routes/tarefas.todos.test.ts`; confirm the new assertions fail before changing the route.
- [ ] Implement participant insertion in the single-assignee path after existing responsibility validation; propagate insert errors through the existing error response. Set `lida` from `assigneeId === req.usuario.id`.
- [ ] Keep the multiple-assignee creation semantics and push behavior unchanged; ensure the creator's receipt is initialized as read in multi-assignee rows too.
- [ ] Run the route test file and inspect that assertions still scope mark-read to the authenticated participant.

### Task 2: Add participant read status to task details

**Files:**
- Modify: `src/features/tarefas-preview/taskPreviewModel.ts`
- Modify: `src/features/tarefas/TarefasPreviewIntegrated.tsx`
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`
- Test: focused mapping/component tests beside these files, following existing Vitest conventions.

**Interfaces:**
- Consumes: `Tarefa.participantes[].lida`, `usuario.nome_exibicao`, and existing manager permission checks.
- Produces: preview task read receipts shaped as `{ userId: string; name: string; read: boolean }[]`; details label each participant “Visualizada” or “Não visualizada”.

- [ ] Add a mapping test for two participants with different `lida` values and missing optional `usuario` joins.
- [ ] Run the focused test to confirm the receipt mapping is absent or incomplete.
- [ ] Extend `PreviewTask` with optional read receipts and map them from the existing task participant join without using client-supplied IDs for authorization.
- [ ] Render the status in task detail only for users with the existing task-management permission; render no other task's receipts.
- [ ] Run the focused tests and TypeScript build check for the affected preview task model.

### Task 3: Build the shared unread task inbox

**Files:**
- Create: `src/features/notificacoes/TaskNotificationBell.tsx`
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`
- Modify: `src/features/tarefas/TarefasPreviewIntegrated.tsx`
- Test: `src/features/notificacoes/TaskNotificationBell.test.tsx`

**Interfaces:**
- Consumes: `tarefasApi.listar()`, `tarefasApi.marcarLida(id)`, authenticated user ID, and existing task-open callback.
- Produces: `TaskNotificationBell` props `{ onOpenTask(taskId: string): void; currentUserId: string; }`; unread tasks are scoped to participant `usuario_id === currentUserId && !lida`.

- [ ] Test filtering so unread is personal, another user's unread state is excluded, and read tasks are absent from Pendentes.
- [ ] Test that clicking a notification calls `onOpenTask` but does not mark it read; the selected task detail owns the existing mark-read behavior.
- [ ] Run the focused inbox tests and confirm they fail before implementation.
- [ ] Implement a compact accessible bell/popover with pending count, loading/error/empty states, and “Pendentes”/“Visualizadas” views derived from `lida`; refresh on window focus and at a modest interval while mounted.
- [ ] Add `onTaskOpened(taskId)` to the integrated preview props and invoke it only when `TaskInspector` is mounted for a task; call `tarefasApi.marcarLida(taskId)` and update local task participant state after success.
- [ ] Add an integrated-only bell to the Tasks header; clicking a row selects the corresponding task and lets the inspector-open callback mark it read.
- [ ] Keep inbox state synchronized after detail open and list refresh; run inbox and task preview tests.

### Task 4: Wire the Stock bell to task navigation

**Files:**
- Modify: `src/App.tsx` (critical shared navigation; inspect consumers and coordinate no concurrent edits)
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Modify: `src/features/tarefas/TarefasView.tsx`
- Modify: `src/features/tarefas/TarefasPreviewIntegrated.tsx`
- Test: focused navigation tests for Stock bell and Tarefas selected-task opening.

**Interfaces:**
- Consumes: current App tab selection and selected task ID.
- Produces: optional `onOpenTaskNotification(taskId: string)` prop for Stock; Tarefas receives a pending task ID, waits until real tasks load, opens its detail once, and clears the request.

- [ ] Test that selecting an unread task from Stock switches to Tarefas and opens the matching task after its list loads.
- [ ] Test that the same request is consumed once and does not reopen after later polling.
- [ ] Add an integrated-only Stock bell using the shared inbox component; do not show demo inbox on a standalone preview.
- [ ] Wire App custom tabs with props (no router or global state rewrite), then pass the target task into the integrated task preview.
- [ ] Verify Vendas' current bell remains an exclusive shortcut to Pendências and is not replaced.

