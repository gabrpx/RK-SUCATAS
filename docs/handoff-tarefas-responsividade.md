# Handoff — responsividade da tela de tarefas

## Tarefa

Corrigir o enquadramento da nova tela de tarefas em mobile e desktop e impedir que o modal de criação de tarefa seja deslocado horizontalmente.

## Contexto

A tela oficial `/tarefas` usa o visual da `TasksPreview` integrado aos dados reais. A identidade visual dessa tela é deliberadamente própria e não deve ser substituída pelo tema geral do sistema.

## Estado encontrado

- A tela renderiza corretamente com tarefas e lembretes reais.
- A composição do modal `TaskComposer` usa um overlay fixo com `overflow-y-auto`. Como o eixo horizontal não estava explicitamente contido, o navegador calculava `overflow-x: auto`.
- O formulário do modal usava `overflow-visible` e alguns descendentes tinham largura mínima própria. Em viewport estreita isso permitia deslocar a tela lateralmente.
- O próprio shell da prévia também não declarava contenção horizontal no root e no conteúdo principal.

## Correção aplicada

Arquivos:

- `src/features/tarefas-preview/TaskComposer.tsx`
- `src/features/tarefas-preview/TasksPreview.tsx`

Alterações:

1. O overlay do modal agora usa `overflow-x-hidden overflow-y-auto`: mantém a rolagem vertical necessária e elimina deslocamento horizontal.
2. O formulário do modal agora usa `min-w-0`, `max-w` e `overflow-x-hidden`.
3. Header, grid, coluna principal, resumo lateral e footer do modal receberam `min-w-0` para impedir que conteúdo interno imponha largura mínima.
4. O root, header interno e `main` da tela receberam `w-full`, `min-w-0` e contenção horizontal.

## Critérios de aceitação

- Em viewport mobile, `/tarefas` não apresenta rolagem horizontal da página.
- Ao abrir `Nova tarefa`, o usuário consegue rolar verticalmente o formulário sem arrastar o modal para os lados.
- O checklist continua editável e o seletor de responsável continua abrindo corretamente.
- Em desktop, o modal permanece centralizado, com limite de largura e coluna de resumo lateral.
- Header, abas `Meu turno`/`Lembretes`, cards e painel lateral não sofrem alteração de identidade visual.
- O conteúdo não é cortado horizontalmente de forma que esconda campos ou botões.

## Validação recomendada pelo Claude

Executar no projeto correto (`D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`):

```powershell
npm run lint
npm run build
npm test -- --run
```

Validação manual:

1. Abrir `/tarefas` com largura aproximada de 375px.
2. Alternar entre `Meu turno` e `Lembretes`.
3. Abrir `Nova tarefa`, preencher título, rolar verticalmente, adicionar etapa e abrir o seletor de responsável.
4. Confirmar que `document.documentElement.scrollWidth <= document.documentElement.clientWidth` e que o modal não tem overflow horizontal intencional.
5. Repetir em desktop largo; confirmar o modal centralizado e sem perda da coluna de resumo.

## Fora do escopo

- Não trocar a paleta, tipografia ou composição visual da nova tela para combinar com o sistema legado.
- Não substituir a tela por `TarefasLegacyView`.
- Não alterar APIs, banco, permissões ou contratos de tarefas/lembretes.
- Não modificar o fluxo de criação além da contenção de layout.

## Próximo passo se houver novo problema

Reproduzir primeiro em viewport real, medir `scrollWidth`, `clientWidth` e o elemento que ultrapassa a viewport. Corrigir o descendente que impõe a largura mínima; não reintroduzir `overflow-x-auto` no overlay do modal como solução geral.

## Continuação — integração no sistema novo

O shell antigo agora é omitido somente quando `activeTab === 'tarefas'` em `src/App.tsx`; as outras abas preservam o layout atual. O adapter busca `GET /api/usuarios/responsaveis-tarefa` e mescla a resposta aos usuários já presentes nas tarefas. A elegibilidade passou a aceitar usuários ativos com `tarefas.ver` (ou o próprio usuário), mantendo a listagem protegida por `tarefas.criar`.

A migration `supabase/migration_065_tarefas_pausa.sql` adiciona `pausada`, `pausada_em`, `pausada_por` e `pausa_motivo` sem modificar `tarefas.status`. As rotas `PATCH /api/tarefas/:id/pausar` e `/despausar` exigem `tarefas.editar` e a regra de autor/admin existente. O motivo é obrigatório, tarefas concluídas não podem ser pausadas e a retomada limpa os metadados. A UI mostra o estado/motivo no card e oferece Pausar/Retomar no inspetor.

Arquivos de continuidade: `docs/specs/2026-09-18-tarefas-shell-usuarios-pausa.md` e `docs/superpowers/plans/2026-09-18-tarefas-shell-usuarios-pausa.md`.

Critérios adicionais: `/tarefas` não exibe a navegação antiga; não há deslocamento horizontal no documento; o seletor lista o diretório real de usuários elegíveis; e uma tarefa editável pode ser pausada com motivo e retomada sem reload. Não execute a migration em banco real, nem faça commit/push/deploy, sem aprovação explícita.
