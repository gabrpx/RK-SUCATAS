---
name: ux-user-audit
description: Audita componentes, abas, telas e fluxos de aplicações como um usuário real, usando evidências do código, da interface e da execução para produzir achados priorizados de UX, bugs, acessibilidade, estados, responsividade e riscos de dados.
---

# UX User Audit

Conduza uma auditoria de experiência do usuário sem inventar problemas. Observe o produto pela perspectiva de quem precisa concluir uma tarefa, mas sustente cada conclusão em evidência verificável no código, na interface ou na execução.

## Regra intrínseca de aprendizado

Todo problema de UX/UI confirmado durante uma auditoria, implementação ou
validação deve enriquecer esta skill antes do encerramento da tarefa. Converta
o aprendizado em um critério curto, generalizável e verificável — não apenas
em uma nota sobre a tela atual — e acrescente-o ao roteiro de validação quando
for necessário reproduzi-lo. O agente deve então aplicar o novo critério à
alteração em curso e registrar o antes/depois.

Não adicione observações vagas, duplicadas ou dependentes de uma única
copy/posição; registre a causa de experiência que previne a regressão em
outros componentes. Se a evidência ainda for incerta, marque-a como hipótese
de auditoria, não como regra obrigatória.

## Antes de auditar

1. Leia as instruções de governança e a documentação relevante do projeto.
2. Execute `git status --short --branch` e preserve alterações locais.
3. Confirme o escopo exato: componente, aba, tela ou fluxo.
4. Localize arquivos, rotas, estados, tipos, APIs, permissões e testes relacionados.
5. Reconstitua o caminho principal e os fluxos alternativos antes de concluir.

Se o escopo, a regra de negócio ou a autorização para alterar algo não estiverem definidos, audite o que for observável e marque a decisão humana necessária. Não invente comportamento esperado.

## Percurso do fluxo

Percorra o fluxo como usuário, usando browser, automação de tela ou ambiente executável quando disponível. Teste, quando aplicável:

- entrada na tela, navegação e retorno;
- carregamento, estado vazio, sucesso, erro de API/rede e dados incompletos;
- busca, filtros, ordenação, paginação e persistência dos critérios;
- criação, edição, exclusão, confirmação, cancelamento e recuperação;
- ações destrutivas, duplicidade de envio e dados obsoletos;
- permissões, falta de autorização e sessão expirada;
- desktop, tablet e mobile; mouse, toque, teclado, foco, labels e leitor de tela;
- feedback, validação, mensagens, progresso, consistência visual e número de cliques;
- desempenho percebido e possíveis condições de concorrência.

## Critérios obrigatórios para componentes interativos

Ao auditar ou implementar uma interface operacional, verifique também:

- **Rascunhos sob atualização assíncrona:** abra um formulário, digite dados sem
  salvar e provoque um refetch, polling ou resposta atrasada da API. O rascunho
  não pode sumir, voltar aos valores anteriores nem fechar o modal; compare
  também mudanças de chave, permissão e desmontagem do componente pai. Se o
  defeito só foi relatado, registre hipótese até reproduzir a sequência exata.
- **Estado de cadastro entre aberturas:** ao cancelar ou fechar um cadastro,
  reabra-o e confirme que nome, categoria, preço, fotos, erros e etapa foram
  reiniciados. Se as opções vêm da API, não herde um ID demonstrativo ou que
  já não pertence ao catálogo carregado; exija seleção válida e visível.
- **Dados reais obsoletos:** após falha de revalidação, não mantenha rótulo de
  “dados carregados” nem permita gravação baseada em estado antigo. Exiba
  somente leitura, erro claro e retentativa; teste a transição de volta ao
  estado operacional após reconexão.

- **Controle nativo sem tratamento:** `select`, `alert`, `confirm`, `prompt`,
  input de arquivo e outros controles do navegador não podem ser deixados com
  aparência ou comportamento nativo quando o fluxo exige contexto, pessoas,
  status ou uma decisão relevante. Reutilize um componente do projeto ou crie
  uma superfície acessível e coerente com a tela; registre uma justificativa
  explícita se o nativo for a escolha correta.
- **Linha operacional acionável:** quando uma linha, card ou resultado abre
  detalhe, altera o contexto ou executa uma ação, ela precisa usar `button` ou
  `a` (ou um componente que preserve sua semântica), com nome acessível, foco
  visível e acionamento por teclado. Um `div` com `onClick` não pode ser a
  superfície primária de uma ação operacional.
- **Seleção de pessoas:** seletores de responsáveis devem comunicar identidade
  com avatar/iniciais, nome, estado selecionado e foco de teclado. Um `<select>`
  genérico não é suficiente para atribuir uma pessoa a uma etapa operacional.
- **Coleções dinâmicas:** adicionar, remover, filtrar ou reordenar itens como
  etapas de checklist deve ter transição local de entrada/saída e preservar
  foco e contexto. A animação deve usar somente `opacity` e `transform`,
  respeitar `prefers-reduced-motion` e nunca reanimar a tela inteira.
- **Confirmações de perda ou impacto:** `window.alert`, `window.confirm` e
  `window.prompt` são proibidos. Use um diálogo próprio com título, impacto
  explicado, ação segura, ação destrutiva explicitamente nomeada, foco inicial
  e comportamento de Escape/backdrop definido.
- **Qualidade de acabamento:** nenhum componente deve permanecer apenas
  funcional quando representa uma decisão operacional. Avalie densidade,
  estados vazio/carregando/erro, foco, toque, animação e coerência com os
  componentes da própria tela antes de concluir a auditoria.
- **Menus, popovers e listas de opções:** a lista aberta deve permanecer
  inteiramente utilizável dentro do viewport. Defina uma altura máxima
  compatível com a janela, use rolagem interna quando necessário e preserve
  início, fim e item ativo alcançáveis por mouse, toque e teclado. Não aceite
  opções cortadas, ocultas atrás de outros elementos ou um menu que apenas
  pareça rolável.
- **Rolagem em overlays:** enquanto um modal, drawer, command palette ou
  popover rolável estiver aberto, a rolagem deve pertencer ao elemento que tem
  foco. Impedir scroll chaining para o documento de fundo em wheel, trackpad e
  toque; quando o overlay for modal, bloquear a rolagem de fundo e restaurar
  posição e foco de origem ao fechar. Validar que uma tentativa de chegar ao
  fim da lista não move a página abaixo.
- **Ciclo de vida de overlays:** modais, drawers, menus e popovers precisam
  ter entrada e saída deliberadas. Use presença/exit para não desmontar a
  superfície antes da animação terminar; anime apenas `opacity` e `transform`,
  respeite `prefers-reduced-motion` e mantenha foco, backdrop e interação
  bloqueados até o fechamento ser concluído. Não aceite fechamento abrupto ou
  sensação de reload.
- **Tamanho e conteúdo dinâmico:** quando uma ação adiciona ou remove uma
  etapa, resultado ou grupo dentro de uma superfície, a altura e a posição dos
  elementos vizinhos devem acompanhar por transição de layout local. Não aceite
  salto seco de tamanho, corte transitório ou mudança que desloque a leitura
  sem preservar o foco; ao atingir o limite do viewport, transfira a rolagem
  para uma área interna com a mesma continuidade visual.
- **Rolagem com affordance própria:** uma lista operacional que exige rolagem
  deve comunicar isso por trilho e polegar visuais coerentes com a interface,
  com contraste e área de arraste suficientes. Não dependa exclusivamente da
  barra padrão do navegador, nem esconda a barra de modo que o usuário não
  descubra os itens adicionais. A personalização não pode remover rolagem por
  teclado, roda, trackpad ou toque.
- **Dependências entre seletores:** quando um seletor depende de uma decisão
  anterior — por exemplo, o responsável de uma etapa depende da equipe em
  “Coordenar execução” — ele só pode exibir opções válidas no conjunto de
  origem. Ao remover uma opção de origem, reconcilie valores dependentes de
  forma visível e segura; nunca mantenha uma escolha invisível, obsoleta ou
  impossível de selecionar novamente.
- **Continuidade de foco após mutação:** ao adicionar uma etapa, resultado ou
  campo, não basta transferir o foco de teclado. Depois que o layout local se
  estabilizar, o contêiner rolável da própria superfície deve trazer o novo
  elemento para uma zona visível e confortável de leitura, sem deslocar o
  documento de fundo. Verifique especialmente expansões para baixo: o usuário
  precisa perceber a consequência da ação no mesmo contexto visual, e não
  procurar pelo item recém-criado.
- **Navegação e filtros com semântica única:** não reutilize o mesmo conjunto
  de rótulos para controles que governam contextos diferentes. Quando uma tela
  tiver navegação global e filtros de uma fila local, diferencie-os por copy,
  posição e escopo percebido; cada conjunto deve ter uma única fonte de estado
  e uma consequência visível. Ao alternar contextos, preserve filtros, busca,
  seleção e posição de rolagem que pertencem ao contexto de origem, salvo uma
  ação explícita de redefinição.
- **Hierarquia de ações em listas operacionais:** em cards repetidos, mantenha
  visível apenas a ação imediata de maior frequência e uma ação de adiamento
  quando ela fizer parte do fluxo. Edição, exclusão e ações raras devem viver
  em um menu de contexto acessível por teclado, com confirmação própria para
  ações destrutivas. Quatro ou mais CTAs concorrentes por linha reduzem a
  escaneabilidade e aumentam o risco de toque acidental.
- **Integridade de contexto em detalhes:** drawers, modais, checklists,
  histórico e orientações precisam derivar do item atualmente selecionado. Ao
  abrir dois registros diferentes em sequência, confirme título, setor,
  prazo, justificativa e próximos passos do mesmo `id`; nunca reutilize dados
  de exemplo ou conteúdo residual de outro registro. Uma divergência visual
  entre card e detalhe é risco de execução e deve ser tratada como defeito de
  dados/contexto, não apenas de composição.
- **Urgência temporal acionável:** quando a prioridade de um item depende de
  prazo, um contador estático não é suficiente. Exiba um cronômetro vivo para
  o item operacional mais urgente, com estado restante/atrasado inequívoco,
  atualização sem saltos e anúncio acessível; ações como adiar devem mostrar
  o novo horário antes de serem confirmadas.
- **Feedback de conclusão reconhecível:** concluir um item não pode trocar
  apenas copy ou cor. Preserve o card por tempo suficiente para uma transição
  local de sucesso — por exemplo, borda verde animada — e só então aplique o
  estado concluído ou sua saída do filtro, sem reanimar a lista inteira.
- **CTA orientado pelo contexto ativo:** uma ação global deve usar a entidade
  da aba atual. Ao trocar de tarefas para lembretes, tanto o rótulo quanto o
  gatilho precisam mudar para a criação correspondente, com a mesma fonte de
  estado usada pela ação local.
- **Continuidade contextual no cabeçalho:** quando uma aba troca o título,
  texto explicativo ou CTA do cabeçalho, preserve a geometria do cabeçalho e
  faça a copy entrar/sair por transição local. Reserve a largura do CTA para a
  maior variação prevista, anime o texto sem deslocar controles vizinhos e
  respeite `prefers-reduced-motion`; nunca aceite troca seca de rótulo ou
  reposicionamento perceptível do header.
- **Checklists acionáveis fora do detalhe:** se um card resume etapas de uma
  tarefa, as caixas de seleção exibidas nele devem ser operáveis e atualizar a
  mesma fonte de estado do drawer; não use um ícone que pareça checkbox mas
  só seja interativo após abrir detalhes.
- **Categorias sem conteúdo:** painéis de resumo não devem reservar espaço
  para categorias com contagem zero. Filtre-as antes da renderização e use
  entrada, saída e layout local animados para que criação ou remoção não cause
  salto de altura nem quebre a leitura da página.
- **Rota e deep link da tela auditada:** quando a tarefa nomear uma URL, abra-a
  diretamente em uma sessão fria e após recarregar. Confirme que o roteador da
  aplicação reconhece a rota e monta a tela; testes que renderizam o componente
  isolado não provam que o usuário consegue chegar à funcionalidade.
- **Grupos ARIA de rádio:** ao usar `role="radiogroup"`/`role="radio"`, confirme
  um único ponto de tabulação, seleção por Espaço e navegação/seleção pelas
  setas, mantendo `aria-checked` sincronizado. Botões com esses papéis sem o
  comportamento de teclado esperado não formam um grupo acessível.
- **Superfície oculta por CSS em vez de removida:** nenhum controle pode ser
  neutralizado com `display: none` injetado, `hidden` ou opacidade enquanto
  continua montado e mantendo estado. Uma navegação ou seção que não faz mais
  parte do fluxo deve ser removida junto com o estado que ela governa; um
  contexto que ainda existe precisa de rótulo, foco e consequência visíveis.
  Dois conjuntos de controles governando o mesmo contexto é defeito, não
  redundância.
- **Fonte única para estado derivado:** contadores, totais e resumos exibidos
  em um contexto devem ser calculados a partir da mesma coleção que a lista
  renderiza, não espelhados em outro `state` sincronizado por efeito. Um número
  que pode divergir da lista que ele resume é defeito de dados.
- **Consistência entre representações operacionais:** quando uma mesma entidade
  aparece em catálogo, mapa, fila, contador ou histórico, todas essas vistas
  devem derivar do mesmo identificador e da mesma fonte de estado. Uma mutação
  de endereço, estado ou arquivamento precisa atualizar as representações
  relacionadas no mesmo fluxo; uma vista que continua exibindo a cópia antiga
  é defeito de dados/contexto, não apenas uma inconsistência visual.
- **Densidade sem rolagem horizontal:** painéis de resumo, tabelas de métricas
  e faixas de indicadores não podem depender de largura mínima fixa nem de
  rolagem lateral do conteúdo principal para serem lidos. Em 320 px o conteúdo
  reflui em menos colunas; só listas explicitamente horizontais (abas, chips de
  filtro) rolam, e sempre com affordance e item ativo alcançável.
- **Exceção aprovada de rolagem horizontal:** se o usuário decidir
  explicitamente manter rolagem horizontal em uma superfície principal (ex.:
  `TurnMetricStrip` em `tarefas-preview`, aprovado em 17/09/2026 para preservar
  4 cards lado a lado no mobile), a implementação é obrigatória, não opcional:
  esconder a barra nativa reutilizando a classe global `.no-scrollbar` (não
  duplicar a solução); adicionar fade real nas duas bordas que só aparece
  quando há conteúdo naquela direção (`pointer-events-none`, `aria-hidden`);
  converter a rolagem vertical do mouse (`deltaY`) em rolagem horizontal da
  faixa enquanto houver conteúdo a revelar, liberando o evento para a página
  assim que o início/fim é atingido — exige `addEventListener("wheel", ...,
  { passive: false })` em `useEffect`, pois o `onWheel` do React é passivo por
  padrão e ignora `preventDefault`; e manter um texto `sr-only` explicando a
  rolagem para leitor de tela. O usuário pediu explicitamente (17/09/2026) para
  não deixar nenhum indicador visual de trilho/polegar abaixo dos cards nessa
  tela — o fade mais o wheel horizontal substituem essa affordance aqui; não
  reintroduza a barra customizada sem nova decisão do usuário. Trate cada
  exceção como aprovação pontual daquele componente específico, não como
  precedente automático para dispensar a regra de "sem rolagem horizontal" em
  outras superfícies principais.
- **Ergonomia de toque e formulário no mobile:** todo alvo interativo tem ao
  menos 44 × 44 px de área efetiva, inclusive caixas de seleção — um checkbox
  de 14 px só é aceitável dentro de um rótulo que entregue a área mínima. Campos
  de texto usam no mínimo 16 px em telas estreitas para não provocar zoom
  involuntário, e a ação de salvar permanece alcançável com o teclado virtual
  aberto, acima da safe area.
- **Rótulo acessível quando a ação é comprimida:** se o texto de um botão é
  ocultado por breakpoint, ícone ou truncamento, a ação precisa manter nome
  acessível equivalente (`aria-label` ou texto para leitor de tela) que mude
  junto com o contexto ativo. Um botão que vira só um ícone sem nome não é uma
  ação visível.
- **Filtro de lista anima os itens, não o container:** trocar um filtro local
  deve animar entrada, saída e reposicionamento apenas dos itens afetados. Não
  reanime, remonte ou re-chaveie o container inteiro: isso produz sensação de
  recarregamento, perde a posição de rolagem e esconde qual item mudou.
- **Hierarquia mobile por ordem de decisão:** em telas estreitas, o conteúdo
  sobre o qual o usuário age vem antes do conteúdo que apenas explica o estado.
  Resumos, gráficos e históricos ficam depois da fila de trabalho e podem usar
  divulgação progressiva com controle explícito — nunca sumir. Um painel lateral
  de apoio não pode empurrar a ação principal para fora da primeira tela.
- **Composer orientado à decisão:** campos sem consequência para a ação atual
  devem ser removidos do formulário em vez de ocupar espaço. Prioridade,
  recorrência e demais escolhas que alteram o comportamento operacional devem
  usar opções personalizadas com nome, estado selecionado e breve consequência
  da escolha; um grupo de chips sem explicação torna a criação incompleta.
 - **Conferência integral em compositores multi-etapas:** a etapa final de
  revisão deve mostrar todos os campos persistidos que alteram classificação,
  agrupamento, disponibilidade ou destino do registro — inclusive categoria,
  endereço e vínculos — para que a pessoa possa corrigir a decisão antes de
  salvar; um resumo que omite um desses campos é incompleto mesmo quando o
   formulário mantém o valor corretamente no estado.
 - **Faixa de métricas alinhada à referência visual:** cards de indicadores de
   telas do mesmo produto devem compartilhar a mesma hierarquia de label, valor,
   sufixo, sinal de estado, borda, sombra e espaçamento da experiência aprovada;
   uma tela não deve criar um tratamento visual mais pesado sem decisão de
   produto documentada.
 - **Rolagem interna com continuidade perceptível:** listas longas podem usar
   viewport próprio e carregamento incremental, mas devem ocultar a barra nativa
   sem remover a acessibilidade, manter o foco/teclado, impedir scroll chaining
   acidental e oferecer affordance de continuidade (fade, texto ou estado de
   carregamento). A mesma regra vale para as visualizações equivalentes em cards
   e lista.
 - **Dropdown pesquisável no lugar de datalist em fluxos críticos:** seleções
   que definem um vínculo operacional (peça existente, categoria ou destino)
   devem usar o componente de dropdown compartilhado, com entrada/saída
   animadas, seleção por teclado, Escape, estado selecionado e todas as opções
   disponíveis; `datalist` nativo não é suficiente para garantir o mesmo
   comportamento visual e acessível.
 - **Valor financeiro com definição operacional:** um card de “valor em
   estoque” deve derivar da mesma coleção de unidades ativas que a lista,
   declarar como trata preços ausentes e não misturar itens arquivados,
   reservados ou sem preço sem explicação visível.
 - **Quantidade antes do detalhe:** catálogos agrupados devem exibir a
   quantidade de unidades físicas no cabeçalho do grupo, usando “sem estoque”
   e “0 unidades” para grupos vazios; não exigir abertura do detalhe para
   descobrir disponibilidade básica.
 - **Ruptura de estoque acionável:** grupos sem unidades devem permanecer
   encontráveis quando fizerem parte do catálogo, receber destaque sem depender
   apenas de cor e comunicar a consequência/ação seguinte (adicionar ou
   vincular unidade), sem parecer um item disponível.
 - **Endereço físico estruturado:** localização operacional deve ser escolhida
   por opções válidas de prateleira/seção, com código curto e descrição humana
   auxiliar; evite depender de texto livre para endereços que alimentam mapa,
   organização e busca.
 - **Prévia versus operação diária:** não classifique uma tela como pronta para
   uso diário se criação, edição, arquivamento, reserva, endereço ou foto só
   mudarem estado local. A interface deve declarar a limitação enquanto é
   prévia; a versão operacional precisa de persistência, tratamento de falha,
   recarga e atualização consistente de todas as vistas.
 - **Métricas operacionais derivadas:** gráficos e contadores que prometem
   orientar uma decisão diária precisam ser calculados de eventos persistidos,
   ter período e definição explícitos e degradar honestamente quando não houver
   dados. Dados fixos de demonstração não são métrica operacional.
 - **Prateleiras escaláveis:** para galpões com muitas categorias, modele a
   prateleira como endereço e zona pesquisáveis, separados da categoria. A
   associação recomendada entre categoria e zona deve aceitar múltiplas
   categorias, prioridade/capacidade e exceções; não imponha uma única
   categoria por prateleira nem uma lista plana impossível de navegar.
  - **Unidade física real:** uma unidade exibida como física precisa possuir um
    identificador persistido ou ser claramente marcada como estimativa. Nunca
    permita editar, reservar, arquivar ou contabilizar como ficha física um
    placeholder criado apenas para representar uma quantidade legada.
  - **Falha parcial de cadastro:** percorra upload → criação da peça → criação
    ou atualização da ficha → atribuição de endereço. Para cada etapa, simule
    falha e repetição: a UI deve dizer exatamente o que foi gravado, evitar
    duplicidade no retry e prever limpeza de upload órfão. "Falhou" genérico
    depois de uma escrita bem-sucedida é risco de dados.
  - **Ação aparentemente disponível:** inspecione menu, drawer, atalhos e
    estados alternativos para o mesmo comando. Se arquivar, restaurar ou mover
    ainda não grava no servidor, não deixe um caminho secundário executá-lo
    só no estado local nem abra confirmação de uma ação indisponível.
  - **Linguagem compatível com o contrato real:** texto como "disponível",
    "não ofertado", "sincronizado" ou "compatível" deve ser sustentado por
    regra efetiva na API e nos consumidores. Uma fila visual não é bloqueio
    de venda; uma referência livre de moto não é vínculo estruturado.
  - **Capacidade dependente de migration:** quando uma ação ou campo exige
    coluna, relacionamento ou assinatura de RPC introduzidos por migration,
    verifique o estado de schema suportado pela implantação. Se a migration
    ainda não estiver aplicada, esconda ou desabilite a ação dependente com
    explicação; não deixe o usuário enviar uma operação que falhará no servidor.
  - **Escape na camada superior:** com menu ou combobox aberto dentro de drawer
    ou modal, Escape fecha primeiro a superfície interna e mantém a superfície
    modal aberta. A tecla não pode fechar camadas sobrepostas de uma vez, e o
    foco deve voltar ao controle que abriu a lista.
  - **Disponibilidade separada de localização:** reservar uma unidade muda sua
    disponibilidade para venda, mas não sua presença física no endereço. Métricas
    de localização e de disponibilidade devem contar estados diferentes e
    permanecer coerentes com a lista e o mapa após reservar/liberar.
  - **Pré-condições de reserva:** se a regra operacional exige sinal ou outro
    comprovante antes de reservar, o fluxo deve solicitar e persistir essa
    confirmação antes de mostrar a unidade como reservada; nome e prazo não
    comprovam recebimento. Compare também os limites de prazo na UI, API e banco
    usando a mesma semântica de calendário/duração, inclusive no valor máximo.
  - **Histórico baseado em eventos:** uma aba chamada histórico/rastreabilidade
    deve mostrar eventos persistidos com data e autoria disponíveis. Estado atual
    e próxima ação podem aparecer como resumo, mas não substituem o histórico.
  - **CTA anunciado como ação:** texto como “Adicionar unidade” só deve parecer
    uma ação quando for um controle operável por mouse e teclado. Se for apenas
    uma orientação, use copy explicativa e aponte para o controle que inicia o
    fluxo.
  - **Coerência dos dados de demonstração:** fixtures visíveis precisam manter
    categoria, nome, endereço e disponibilidade semanticamente compatíveis;
    exemplos contraditórios ensinam uma regra operacional errada e invalidam a
    avaliação da interface.
  - **Ações alinhadas à permissão efetiva:** compare as permissões da API com
    cada CTA exibido. Usuários sem permissão de escrita devem receber uma tela
    de consulta coerente, em vez de ações habilitadas que só falham após o envio.

  - **Item de grade sem `min-w-0`:** card dentro de CSS grid ou flex que
    contém trilho horizontal, texto longo ou botão precisa de `min-w-0` (e
    quebra de palavra no título). Em 320–375 px, confira se a borda direita do
    card e o CTA interno continuam visíveis; `scrollWidth` do documento igual à
    largura não prova que o conteúdo interno não foi cortado.
  - **Tema local completo:** quando uma tela redefine tokens para um tema
    diferente do global, ela precisa redefinir todos os tokens semânticos que
    usa (positive, warning, negative, info, danger, sombras, scrim) e reaplicá-
    los em portais (drawer, diálogo, popover). Verifique também que cada classe
    utilitária de token existe de fato no `@theme` (ex.: `shadow-elevated-sm`
    não gera CSS se só `--shadow-sm` estiver mapeado).
  - **Rótulo e campo com pesos separados:** campos dentro de `<label>` com
    `font-semibold` herdam o peso por `font: inherit`; defina `font-normal` no
    campo e use o mesmo estilo de rótulo em inputs e dropdowns do formulário.
  - **Ações assíncronas com estado próprio:** todo botão que grava (salvar,
    reservar, liberar, restaurar, desativar) mostra carregamento, fica
    desabilitado durante o envio e impede duplo envio; confirmações e toasts
    têm entrada/saída animadas e o toast é anunciado em região `aria-live`.
  - **Menu de contexto completo:** além de Escape, o menu fecha ao clicar fora,
    devolve foco ao gatilho, anima entrada/saída e só lista ações permitidas
    para o estado do item (sem "Editar" em registro vendido/arquivado).
  - **Faixa de abas no mobile:** se as abas não cabem em 375 px, a faixa rola
    com snap e indica visualmente que há mais abas (fade na borda), sem barra
    nativa e com a aba ativa alcançável.

### Roteiro mínimo para overlays

Para cada overlay relevante, reproduza e registre: abrir por mouse e teclado;
percorrer o primeiro, um intermediário e o último item; rolar até os dois
limites com roda/trackpad ou toque; confirmar que o fundo não se move; fechar
por ação segura, Escape e backdrop conforme a regra; e confirmar o retorno de
foco ao gatilho. Em viewport baixo e mobile, confirme também que o overlay se
reposiciona ou limita sua altura sem cortar opções.

Em fluxos com campos dependentes, altere a seleção de origem, abra todos os
seletores dependentes e confirme que só aparecem opções válidas. Em coleções
dinâmicas, adicione e remova um item observando a transição de tamanho do
container, a preservação de foco e a barra de rolagem quando o limite da tela
for atingido. Após adicionar, confirme que a área rolável do overlay acompanha
o novo item e o mantém visível sem mover a página por trás.

Se não houver ambiente executável, faça uma auditoria estática cuidadosa e declare essa limitação. Não apresente hipótese como comportamento observado.

## Evidência e classificação

Cada achado deve apontar a evidência concreta: arquivo e linha quando possível, componente, rota, estado, seletor, mensagem exibida ou passos reproduzíveis. Separe explicitamente:

- confirmado: observado no código ou reproduzido;
- risco provável: sinal técnico que precisa de reprodução ou validação;
- sugestão: oportunidade de melhoria, sem afirmar que existe defeito.

Use uma categoria e severidade por achado.

Categorias: `BUG`, `UX`, `A11Y`, `RESPONSIVIDADE`, `ESTADO`, `FEATURE`, `QUALIDADE`, `SEGURANÇA/DADOS`.

Severidades:

- `P0`: impede o uso ou pode causar perda grave de dados;
- `P1`: bloqueia tarefa importante ou gera erro recorrente;
- `P2`: causa atrito relevante, confusão ou inconsistência;
- `P3`: melhoria menor ou refinamento.

Não transforme toda observação em feature. Priorize impacto, frequência, risco e esforço estimado, nessa ordem de decisão; facilidade isolada não define prioridade.

## Limites de implementação

Investigue antes de editar. Reutilize padrões existentes e preserve contratos, dados e regras de negócio. Não adicione dependências sem autorização. Não altere banco, migrations, autenticação, infraestrutura ou APIs públicas sem aprovação. Não apague arquivos, faça mudanças irreversíveis, commit, push, merge ou deploy.

Se a tarefa autorizar correções, implemente diretamente apenas problemas locais, claros e de baixo risco, e registre o antes/depois. Ao encontrar decisão de produto, arquitetura, banco, segurança ou regra financeira não definida, pare nessa parte e solicite decisão humana.

## Relatório obrigatório

Entregue exatamente estas seções:

### 1. Resumo executivo

- fluxo auditado;
- objetivo do fluxo;
- resultado geral;
- principais bloqueios;
- nível de confiança.

### 2. Fluxo percorrido

Descreva o caminho real testado, estados visitados e variações relevantes.

### 3. Achados

Para cada item, informe:

- ID, categoria, severidade e título;
- status da evidência: confirmado, risco provável ou sugestão;
- comportamento observado e esperado;
- impacto para o usuário;
- evidência concreta e passo reproduzível;
- recomendação;
- se exige decisão humana;
- se é seguro implementar diretamente.

### 4. Backlog priorizado

Organize em:

1. correções imediatas;
2. melhorias importantes;
3. funcionalidades recomendadas;
4. refinamentos futuros.

Inclua impacto, frequência, risco e esforço estimado quando puder sustentá-los.

### 5. Alterações realizadas

Se houver autorização para corrigir, liste arquivos, problema, comportamento antes/depois e testes executados. Se não houve alteração, declare isso.
Inclua também os critérios novos adicionados à skill a partir dos problemas
confirmados nesta tarefa, ou declare explicitamente que não houve aprendizado
novo a registrar.

### 6. Pendências e riscos

Liste limitações, cenários não testados, decisões necessárias e impactos possíveis.

### 7. Próximos passos

Sugira a menor sequência segura para continuar sem expandir o escopo.

## Critério de conclusão

A auditoria só termina quando o fluxo principal e os estados alternativos relevantes foram analisados, os achados têm evidência, classificação e prioridade, as validações foram executadas ou marcadas como não executadas, e nenhuma mudança fora do escopo foi feita silenciosamente.

Após cada etapa relevante, informe uma atualização curta no formato:

`✅ Etapa concluída — evidência encontrada — arquivos envolvidos`
