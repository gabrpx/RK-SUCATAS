# Notificações operacionais, filtros e busca — proposta de design

**Status:** aprovado para implementação; contrato refinado após inspeção do repositório  
**Data:** 2026-09-29  
**Projeto:** RK Sucatas — NOVO SISTEMA

## Objetivo

Introduzir uma caixa de notificações de tarefas com leitura registrada por funcionário e alinhar interações de filtros e busca aos padrões visuais e operacionais já usados em Tarefas e Estoque.

## Entendimento aprovado até aqui

- Uma tarefa nova deve gerar uma notificação para cada funcionário destinatário, sem notificar quem criou e se atribuiu a própria tarefa, seguindo a regra já presente nas rotas de tarefas.
- Ao abrir a notificação, ela sai da caixa de pendentes.
- O estado de leitura permanece registrado por destinatário; portanto, sair da caixa de pendentes não significa apagar o histórico.
- A caixa deve distinguir itens sem visualização e visualizados por funcionário.
- “Todos os exemplos” na aba Movimentações da Vendas preview deve virar uma troca por abas, como o componente usado em Tarefas.
- O hover/foco dos dropdowns deve acompanhar a opção sob o ponteiro ou foco; a seleção atual continua identificada separadamente.
- A busca do Estoque deve encontrar peças por mais campos sem enfraquecer os filtros já existentes.

## Situação existente confirmada

- `src/features/notificacoes/` implementa inscrições de push por usuário/dispositivo. Não é uma caixa de notificações lidas/não lidas.
- `src/features/dashboard/DashboardView.tsx` deriva avisos de tarefas pendentes para o Dashboard; esses avisos não guardam estado de leitura por funcionário.
- `src/server/routes/tarefas.ts` já determina participantes e dispara push de “Nova tarefa”. As rotas de criação têm caminhos para participantes múltiplos e atribuição legada.
- A leitura individual já existe em `tarefa_participantes.lida` (migration_060) e em `PATCH /api/tarefas/:id/marcar-lida`. A tela legada chama essa rota ao abrir detalhes, mas o preview integrado atual não chama; a integração da caixa deve corrigir essa lacuna.
- O fluxo atual de nova tarefa com participantes múltiplos cria linhas em `tarefa_participantes`; o fluxo de atribuição simples ainda segue o formato legado e não cria uma linha com `lida=false`.
- A `EstoqueView` usa busca com termos múltiplos e encontra nome, código, categoria, modelo e modelos compatíveis. `Estoque` pode incluir unidades (`unidades?: EstoqueUnidade[]`), cujos dados trazem campos como SKU, descrição, avaria e informação de organização.
- `src/features/tarefas-preview/PreviewTabs.tsx` fornece `Tabs`, `TabsList` e `TabsTrigger`, já usados em Tarefas e no Estoque preview.
- `src/components/ui/Select.tsx` usa lista animada, mas ancora o menu com `absolute mt-14`, não implementa navegação de opções por teclado e compartilha Escape com popovers pais. Filtros de Vendas usam `Popover` com `layoutId` entre gatilho e painel.
- `MovementsList` anima o layout dos itens, porém não anima a saída dos itens removidos ao filtrar. Por isso a transição de “Todos os exemplos” para “7 dias” é abrupta.
- Migrations atuais chegam a `migration_070`; a numeração contém colisões e a sequência aplicada no ambiente precisa ser confirmada antes de preparar/aplicar a nova migration.

## Desenho proposto

### 1. Caixa de notificações de tarefas

**Persistência:** reusar `tarefa_participantes.lida`, que já guarda estado individual por destinatário, e a rota `PATCH /api/tarefas/:id/marcar-lida`. Não criar outra tabela nem migration. Os itens pendentes da caixa serão tarefas atuais em que o usuário autenticado é participante e `lida=false`; depois da primeira abertura a tarefa sai da caixa, mas `lida=true` continua como recibo por pessoa. A coluna existente não guarda data/hora de leitura, portanto a interface informa estado, sem inventar data.

**Criação:** garantir que cada tarefa nova atribuída tenha linhas de participante. Reusar a seleção e as validações atuais; no fluxo simples, criar uma linha para o responsável. Participante que também criou a tarefa começa com `lida=true`; os demais começam com `lida=false`. Isso preserva tarefas históricas sem participantes como legado, mas todo registro novo pode alimentar a caixa sem depender de push. Ajustar também a edição simples para manter o registro individual do responsável; não recriar recibos sem necessidade.

**Leitura:** o sino mostra a contagem pessoal de tarefas não lidas. Abrir um item da caixa navega e abre o detalhe da tarefa; somente quando o detalhe realmente abrir o preview integrado chama a rota existente, remove o item da lista pendente e atualiza `lida=true`. A tela de notificações pode alternar entre “Pendentes” e “Visualizadas” filtrando `lida`; não é necessário persistir outro timestamp nesta entrega.

**Status por funcionário:** cada pessoa vê seus próprios itens e estados. Para quem pode gerenciar tarefas, o detalhe da tarefa deve exibir o status de leitura dos participantes daquela tarefa, sem permitir acesso a notificações de usuários sem vínculo com ela. O endpoint de leitura comum será sempre escopado ao usuário autenticado; o acesso gerencial aos recibos será escopado por permissão e tarefa.

**Atualização:** carregar no primeiro acesso, atualizar ao focar a janela e fazer polling leve enquanto a caixa estiver montada, usando a API existente de tarefas. Não abrir WebSocket/Supabase no frontend; manter o padrão atual de frontend falando com Express.

**Interface:** extrair um sino/inbox compartilhado e visualmente alinhado aos cabeçalhos do Estoque e de Tarefas. O sino atual da Vendas preview continua como atalho de Pendências; ele não será substituído nesta entrega. Clicar numa tarefa no inbox marca-a como visualizada e leva à aba Tarefas, onde o detalhe correspondente é aberto.

### 2. Filtros da Vendas preview

- Trocar o botão “Todos os exemplos / 7 dias” por duas `TabsTrigger` usando os componentes existentes em `PreviewTabs.tsx`, com estado e acessibilidade ARIA próprios de `tablist`.
- No `Select`, posicionar o menu diretamente abaixo do gatilho, com largura adequada ao contexto; selecionar, hover e foco por teclado terão sinais separados.
- Adicionar navegação por setas, Home/End e Enter ao Select, e Escape deve fechar primeiro a lista filha antes de um popover pai.
- Reduzir movimento excessivo dos popovers de filtro: remover a transformação compartilhada botão→painel nesses usos e aplicar entrada/saída curta, sem overshoot. Não alterar o movimento dos popovers de outras telas sem validar seu uso.
- Envolver as linhas de movimentação em presença animada com chaves estáveis para que entradas e saídas tenham transições curtas. Respeitar `prefers-reduced-motion` e manter o filtro funcional sem depender da animação.

### 3. Busca do Estoque

- Normalizar acentos, caixa e espaços; separar a consulta em tokens e exigir que cada token corresponda a pelo menos um campo indexado.
- Acrescentar campos disponíveis da peça/unidade: SKU, nome/apelido de unidade, endereço físico, origem, descrição, avaria e modelo compatível, preservando código, categoria, nome e modelo já pesquisados.
- Não alterar filtros estruturados (categoria, moto, estoque baixo, sem preço, avaria, sem foto, link de marketplace) nem o recorte paginado/exportação.
- Evitar consultas duplicadas e indexar uma representação textual por linha dentro do `useMemo` já usado pela tela.
- Se a API não trouxer algum campo de unidade, tratar como ausente sem esconder a peça. Não buscar Supabase diretamente no navegador.

## Alternativas consideradas

1. **Recibo por participante existente (escolhida):** `tarefa_participantes.lida` mantém estado individual entre dispositivos, suporta badge de pendentes e recibos. Reutilizar API e persistência atuais evita duplicidade.
2. **Estado local no navegador:** é rápido, mas não sincroniza entre dispositivos, não dá status confiável por funcionário e não pode ser compartilhado com quem gerencia a tarefa. Não atende ao requisito.
3. **Derivar leitura apenas do estado da tarefa:** não distingue abrir a tarefa de concluir/alterar status; pessoas que veem a mesma tarefa perderiam a leitura individual. Não atende ao requisito.

## Contrato de API existente e ajustes propostos

- `GET /api/tarefas` já retorna as tarefas visíveis ao usuário com participantes e `lida`; a caixa filtra somente os registros do usuário logado com `lida=false` ou `lida=true`.
- `PATCH /api/tarefas/:id/marcar-lida` já altera somente a linha com `tarefa_id` e `usuario_id` autenticado; o sino deve reutilizar esta rota.
- Não aceitar `usuario_id` do cliente para ler ou marcar recibos. Recibos de outras pessoas vêm somente de tarefas que o perfil gerencial já pode consultar.
- Ajustar a criação simples de tarefas para criar registro `tarefa_participantes` para o responsável, preservando os campos atuais e compatibilidade para tarefas já existentes.

## Escopo e riscos

Inclui UI de filtros em `VendasPreview`, busca textual da `EstoqueView`, componente compartilhado de inbox nas superfícies de Estoque/Tarefas e ajuste backend para atribuição simples alimentar o estado de leitura já existente.

Não inclui migration, push novo, notificação para toda edição de tarefa, apagar o estado lido, alterar permissões existentes, executar SQL em ambiente real, mudar RPCs de vendas/estoque/caixa ou refatorar outros popovers globais.

Riscos principais: falha parcial ao inserir participante no fluxo legado; inbox carregar muitas tarefas sem paginação; troca de aba para Tarefas precisar selecionar o item mesmo após montagem assíncrona; consulta de gerente deve exibir recibos somente para as tarefas já autorizadas.

## Arquivos prováveis

- Frontend: `src/components/ui/Select.tsx`, `src/components/ui/Popover.tsx` (somente se necessário e compatível), `src/features/vendas-preview/VendasPreview.tsx`, `src/features/estoque/EstoqueView.tsx`, `src/features/tarefas-preview/TasksPreview.tsx` e um componente compartilhado de inbox.
- Backend: `src/server/routes/tarefas.ts` e o teste do fluxo simples de criação.
- Banco: sem migration; usar coluna `lida` existente da migration_060.
- Testes unitários dos seletores/busca e testes de rota cobrindo dono da notificação, duplicidade, participantes e autorização de recibos.

## Critérios de aceitação

1. Uma tarefa recém-criada gera exatamente uma pendência de notificação por destinatário elegível; o criador não recebe autoaviso.
2. A caixa mostra pendentes e visualizadas com contagem por funcionário; abrir a tarefa marca leitura uma única vez e remove o item dos pendentes.
3. Outro funcionário continua vendo a própria notificação pendente até abrir; a leitura do primeiro funcionário não a remove para os demais.
4. Recibos só ficam acessíveis ao destinatário e às pessoas com permissão gerencial para a tarefa.
5. Os sinos de Estoque e Tarefas abrem a mesma caixa pessoal; o ícone existente de Vendas permanece com semântica de Pendências até decisão explícita para alterá-lo.
6. As abas “Todos os exemplos / 7 dias” são operáveis por mouse e teclado e as movimentações entram/saem sem salto visual, respeitando movimento reduzido.
7. Os dropdowns ficam ancorados ao gatilho; hover e foco acompanham a opção apontada, seleção permanece distinta, teclado funciona, Escape não fecha a camada errada e filtros continuam aplicando os valores corretos.
8. A busca do Estoque aceita múltiplos tokens sem acento e encontra campos textuais relevantes de peça e unidade, sem quebrar paginação, filtros e empty states.
9. Nenhuma notificação é gravada em nome de outro usuário pelo cliente; nenhuma operação altera dados de vendas, estoque ou financeiro.

## Validação prevista

- Vitest dos componentes Tabs/Select/Popover e busca; testes de rota para persistência e escopo por usuário.
- `npm run lint` e build se o ambiente permitir; revisar erros de base conhecidos separadamente.
- Teste visual real em `/vendas-preview`, `/estoque` e `/tarefas`: alternância das Tabs, hover/foco de cada Select, camadas internas com Escape, redução de movimento, responsividade, novo aviso em usuário destinatário, abertura, badge zerado e recibo individual.
- Confirmar pelo código que nenhuma migration ou chamada direta ao Supabase foi adicionada; este trabalho não executa SQL em ambiente algum.

## Pontos para revisão do usuário

- O sino existente na Vendas preview permanece atalho exclusivo de Pendências nesta entrega.
- O status por funcionário é exibido ao próprio destinatário e a gerentes nas tarefas que podem gerenciar.
- O histórico “Visualizadas” deriva do estado `lida=true` existente e permanece enquanto a tarefa existir.
