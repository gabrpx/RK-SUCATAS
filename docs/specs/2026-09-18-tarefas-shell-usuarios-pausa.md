# Especificação — Tela de tarefas: shell, responsáveis e pausa

## Objetivo

Consolidar o início do redesign da tela `/tarefas` sem alterar sua identidade visual, removendo o shell legado da aplicação apenas nessa rota, eliminando overflow horizontal acidental em desktop/mobile, exibindo todos os usuários ativos que têm acesso a tarefas como opções de responsável e permitindo pausar/retomar tarefas com motivo persistido.

## Requisitos

1. `/tarefas` deve ocupar a viewport sem a sidebar, header desktop e navegação inferior legados. As demais abas continuam usando o shell atual.
2. A tela deve aceitar apenas rolagem vertical normal do conteúdo. Nenhum ancestral deve criar deslocamento horizontal da página; faixas que possuem conteúdo horizontal intencional continuam com scrollbar visualmente oculta e indicador de fade.
3. O seletor de responsáveis deve ser alimentado pelo endpoint existente de usuários elegíveis, sem depender de usuários que já aparecem em alguma tarefa.
4. Usuários ativos com `tarefas.ver` podem ser designados; o próprio usuário continua elegível. Usuários inativos ou sem acesso a tarefas não devem ser aceitos pela API.
5. Uma tarefa pendente pode ser pausada com motivo obrigatório. A pausa não muda `status` de conclusão: fica pendente, mas passa a ter `pausada=true`.
6. Uma tarefa pausada pode ser retomada, limpando motivo, autor e data da pausa.
7. A pausa/retomada deve usar API Express e persistência Supabase. Nenhuma chamada direta do frontend ao Supabase.
8. A UI deve exibir estado e motivo da pausa e oferecer a ação correspondente no inspetor da tarefa, respeitando `tarefas.editar`.

## Critérios de aceitação

- Desktop e mobile em `/tarefas` não exibem elementos legados nem permitem arrastar a página lateralmente.
- O modal/inspetor continua rolando verticalmente e não cria overflow horizontal.
- A criação de tarefa mostra o diretório completo retornado pela API e a API rejeita responsável fora da política.
- Pausar sem motivo falha com mensagem compreensível; pausar e retomar atualizam a tarefa sem reload manual.
- Tarefas pausadas permanecem encontráveis, não aparecem como "em andamento" e podem ser retomadas.
- Migration, rotas, tipos, adapter integrado e UI estão alinhados.

## Fora de escopo

- Redesign visual para combinar com o restante do sistema.
- Alteração de permissões de outras áreas.
- Execução de migration ou alteração de dados reais sem aprovação explícita.
