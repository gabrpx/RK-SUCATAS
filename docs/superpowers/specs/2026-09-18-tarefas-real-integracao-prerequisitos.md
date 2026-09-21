# Pré-requisitos para integração de tarefas no sistema real

## Resultado da inspeção

O `/tarefas` atual é uma tela demonstrativa em
`src/features/tarefas/TasksView.tsx`. Ela inicializa `seedTasks` e mantém
criação, foco e conclusão somente em estado React local.

No backend atual, `server.ts` monta rotas para categorias, modelos de moto,
formas de pagamento, estoque, vendas, orçamentos, caixa, upload e frete. Não
há router ou endpoint confirmado para tarefas, lembretes, checklist,
participantes ou responsáveis de tarefas.

`src/context/DataContext.tsx` também não possui estado ou carregamento dessas
entidades. Portanto, a especificação anterior que menciona `useTarefas`,
`useLembretes`, `usuarios` e `GET /api/usuarios/responsaveis-tarefa` descreve
um contrato futuro, não uma API disponível neste checkout.

## Limite desta etapa

O preview continua isolado e não foi conectado a dados demonstrativos que
pareçam persistidos. Não foram criadas rotas, tabelas, migrations, RPCs,
permissões ou chamadas diretas ao Supabase.

## Contratos necessários antes da implementação real

Os contratos abaixo precisam ser definidos e aprovados antes de substituir
`TasksView` por uma tela integrada:

1. **Leitura:** lista de tarefas, paginação/filtros, ordenação por prazo e
   inclusão de checklist, participantes, área, prioridade e lembretes.
2. **Criação/edição:** payload oficial, campos obrigatórios, prazo/timezone,
   prioridade, setor, descrição, participantes e etapas do checklist.
3. **Execução:** transições autorizadas (`pendente`, `em_andamento`,
   `concluida`, bloqueio/reabertura), idempotência e resposta da API após cada
   ação.
4. **Checklist:** atualização individual, responsável por etapa, histórico e
   comportamento quando a tarefa é concluída ou reaberta.
5. **Usuários/participantes:** origem dos usuários elegíveis, regra de
   permissão e compatibilidade com tarefas antigas atribuídas a uma única
   pessoa.
6. **Lembretes:** entidade, recorrência, canais, adiamento, conclusão,
   exclusão, timezone e atualização em tempo real/polling.
7. **Falhas e concorrência:** estados de carregamento, erro, sessão expirada,
   conflito de atualização e confirmação de sucesso sem divergência de
   contadores.

## Próxima etapa segura

Criar uma proposta de schema/API baseada nas entidades já existentes no banco,
confirmar a sequência de migrations aplicada no ambiente alvo e obter aprovação
explícita para mudanças de banco, autorização e rotas. Só depois disso os
adaptadores do preview devem substituir `seedTasks` no `/tarefas`.
