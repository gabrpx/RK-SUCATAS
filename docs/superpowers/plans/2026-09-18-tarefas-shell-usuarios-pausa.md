# Plano: tela de tarefas sem shell legado, usuários completos e pausa

## Goal

Concluir a integração da nova tela `/tarefas` no site novo, mantendo seu visual atual, isolando-a do shell legado, corrigindo overflow responsivo, ampliando a seleção de responsáveis dentro da política de permissões e adicionando pausa/retomada persistidas.

## Architecture

`App.tsx` fará uma exceção de layout somente para `activeTab === 'tarefas'`. O adapter `TarefasPreviewIntegrated` continuará sendo a ponte entre hooks/APIs reais e o preview. A pausa será um estado ortogonal a `tarefas.status`, persistido em colunas próprias para não quebrar a constraint existente de pendente/concluída. As rotas Express permanecerão como única fronteira do frontend com Supabase.

## Tech stack

React, Vite, TypeScript, Tailwind, Express, Supabase, Vitest.

## Spec

`docs/specs/2026-09-18-tarefas-shell-usuarios-pausa.md`

## Global constraints

- Trabalhar somente em `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`.
- Preservar alterações locais existentes de outros agentes.
- Não editar migrations aplicadas; criar migration nova para persistência de pausa.
- Não acessar Supabase diretamente pelo frontend.
- Não expor segredo nem editar `.env`.
- Não executar migration em banco real, commit, push ou deploy sem solicitação explícita.
- Antes de concluir, revisar diff e executar as validações possíveis, declarando limitações reais.

## Implementation steps

### 1. Isolar a tela nova do shell legado

Arquivos:

- `src/App.tsx`
- `src/features/tarefas-preview/TasksPreview.tsx`

Derivar `isTasksRedesign` do `activeTab`, renderizar `DashboardSidebar`, header desktop, `MobileBottomNav`, padding legado e margens de sidebar apenas nas demais abas. Para tarefas, manter um container `min-h-[100dvh]`, `min-w-0` e `overflow-x-hidden`, deixando a rolagem vertical para o documento e para o inspetor/modal quando necessário. Preservar as faixas horizontais intencionais da tela com scrollbar oculta e fade já existente.

Validação: abrir `/tarefas` em viewport desktop e mobile, confirmar ausência da barra antiga, ausência de scroll horizontal no documento e rolagem vertical no inspetor.

### 2. Carregar todos os responsáveis elegíveis

Arquivos:

- `src/features/tarefas/TarefasPreviewIntegrated.tsx`
- `server.ts`
- `src/server/routes/tarefas.ts`
- `src/server/routes/tarefas.responsavel.test.ts`

No adapter, buscar `tarefasApi.listarResponsaveisPossiveis()` ao montar, mesclar o resultado com usuários presentes nas tarefas para preservar dados antigos e passar a lista completa ao `TaskComposer`. No backend, alinhar o endpoint existente e `responsavelValido` para aceitar usuário ativo com `tarefas.ver` ou o próprio usuário; manter a exigência de `tarefas.criar` para listar o diretório.

Adicionar/ajustar testes unitários para executor, gerente, usuário apenas com `tarefas.ver`, inativo e sem permissão.

### 3. Persistir pausa e retomada

Arquivos:

- `supabase/migration_065_tarefas_pausa.sql`
- `src/features/tarefas/types.ts`
- `src/features/tarefas/api.ts`
- `src/server/routes/tarefas.ts`
- `src/features/tarefas/TarefasPreviewIntegrated.tsx`
- `src/features/tarefas-preview/taskPreviewModel.ts`
- `src/features/tarefas-preview/TasksPreview.tsx`

Criar migration com `pausada`, `pausada_em`, `pausada_por` e `pausa_motivo`, sem alterar a constraint de `status`. Criar `PATCH /api/tarefas/:id/pausar` e `/despausar`, protegidos por `tarefas.editar` e pela regra existente de tarefa editável. Exigir motivo não vazio, bloquear pausa de concluída e limpar todos os metadados ao retomar.

Adicionar métodos na API e callbacks no adapter. Representar pausa como propriedade ortogonal no modelo de preview, exibir badge/motivo e trocar a ação no inspetor entre Pausar e Retomar. O fluxo otimista só atualiza a tela após resposta bem-sucedida; em falha, manter estado anterior e mostrar o erro existente.

### 4. Documentação operacional para continuidade

Arquivos:

- `docs/handoff-tarefas-responsividade.md`
- `docs/specs/2026-09-18-tarefas-shell-usuarios-pausa.md`

Atualizar o handoff com arquivos, contratos, critérios e validações para que Claude consiga continuar sem redescobrir a arquitetura.

### 5. Validação final

Executar `git diff --check`, build Vite direto se o wrapper npm continuar quebrado, testes Vitest direcionados e inspeção de `git diff`. Separar falhas preexistentes de falhas introduzidas. Não afirmar integração completa se a migration não tiver sido aplicada no ambiente alvo.
