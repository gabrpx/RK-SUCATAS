// Conteúdo estático do changelog — mantido manualmente a cada entrega
// relevante (não é um CRUD editável pelo usuário final). Adicionar uma nova
// entrada no TOPO do array a cada funcionalidade nova/correção que valha a
// pena avisar quem usa o sistema no dia a dia.
export type PatchNoteTipo = 'feature' | 'melhoria' | 'fix';

export interface PatchNoteItem {
  tipo: PatchNoteTipo;
  texto: string;
}

export interface PatchNoteEntrada {
  versao: string;
  data: string; // YYYY-MM-DD
  titulo: string;
  itens: PatchNoteItem[];
}

export const PATCH_NOTES: PatchNoteEntrada[] = [
  {
    versao: '1.3.6',
    data: '2026-08-27',
    titulo: 'Correção de vendas, cidade do cliente e melhorias gerais',
    itens: [
      {
        tipo: 'fix',
        texto:
          'Correção crítica: vendas voltaram a funcionar — overloads duplicados da função registrar_venda foram removidos.',
      },
      {
        tipo: 'feature',
        texto:
          'Campo "Cidade" no cadastro de clientes — aparece na tabela, no card mobile e na ficha do cliente.',
      },
      {
        tipo: 'feature',
        texto:
          'Pendências manuais do Caixa agora podem ser vinculadas a um cliente cadastrado.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Tarefas concluídas vão automaticamente para o fim da lista, com animação suave de reordenação.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Lista de vendas mostra há quanto tempo cada venda foi feita (ex: "há 5min", "ontem").',
      },
      {
        tipo: 'melhoria',
        texto:
          'Segmento "Ativo" na tabela de clientes renomeado para "Com compras" para não confundir com o status.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Cliente campeão de compras aparece como "Top cliente" no segmento — destaque visual para quem mais compra.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Dashboard agora soma pendências manuais do Caixa ao total de fiado, exibindo "Pendências em aberto" com o valor combinado.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Aba Pendências do Caixa simplificada: sem filtros desnecessários, ticket médio no lugar de composição, e botão WhatsApp aparece para qualquer pendência com telefone.',
      },
      {
        tipo: 'feature',
        texto:
          'Notificação automática de cobrança: o sistema dispara push para toda a equipe quando uma cobrança agendada vence.',
      },
    ],
  },
  {
    versao: '1.3.5',
    data: '2026-08-27',
    titulo: 'Cobranças, banimento, exclusão de usuários e mais',
    itens: [
      {
        tipo: 'feature',
        texto:
          'Sistema de cobrança nas Pendências: anexe boleto em PDF, configure lembrete automático (repetir a cada X horas ou horário fixo) e cobre o cliente via WhatsApp com um clique — tudo na mesma tela.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Fiado e Pendências avulsas agora vivem numa aba única "Pendências" dentro do Caixa, com cards consistentes, métricas no topo e filtro animado por tipo.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Visão do Dono aparece no topo do Dashboard (sem mais badge "Só para administradores") e a posição é configurável por usuário.',
      },
      {
        tipo: 'fix',
        texto:
          'Cards de pendência e fiado no Dashboard agora mostram dados corretamente mesmo quando o usuário não tem permissão de orçamentos ou caixa individualmente.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Tarefas agora abre direto no filtro "Pendentes" em vez de "Todas".',
      },
      {
        tipo: 'fix',
        texto:
          'Segmentação de clientes corrigida: o badge "Novo" agora é por antiguidade real (conta criada há menos de 30 dias), e clientes com ticket alto são classificados como "Campeão" mesmo com poucas compras.',
      },
      {
        tipo: 'feature',
        texto:
          'Banimento de clientes: clientes banidos ficam impedidos de receber novas vendas ou orçamentos. O banimento é reversível e independente de desativar.',
      },
      {
        tipo: 'feature',
        texto:
          'Exclusão permanente de usuários: remove a conta e reatribui todas as tarefas, lembretes e registros vinculados para o administrador que executou a ação.',
      },
    ],
  },
  {
    versao: '1.3.0',
    data: '2026-08-25',
    titulo: 'Permissões por pessoa: você escolhe tela por tela, ação por ação',
    itens: [
      {
        tipo: 'feature',
        texto:
          'O acesso deixou de depender de "cargos" fixos. Ao cadastrar ou editar um usuário, você marca exatamente quais telas ele enxerga e, dentro de cada uma, o que ele pode fazer — ex.: ver o estoque mas não excluir peça, registrar venda mas não cancelar, anunciar no Mercado Livre mas não na Shopee.',
      },
      {
        tipo: 'feature',
        texto:
          'No Dashboard o controle é ainda mais fino: dá pra liberar o painel sem os valores em dinheiro, ou liberar SÓ a "Visão do Dono" (o resumo completo do negócio) pra uma pessoa específica.',
      },
      {
        tipo: 'melhoria',
        texto:
          'O que a pessoa não pode fazer simplesmente não aparece pra ela — e o sistema também recusa a ação por trás, mesmo que alguém tente pelo caminho direto.',
      },
      {
        tipo: 'melhoria',
        texto: 'Ninguém perdeu nem ganhou acesso na virada: todo mundo continua exatamente com o que já tinha, agora descrito em permissões.',
      },
    ],
  },
  {
    versao: '1.2.35',
    data: '2026-08-24',
    titulo: 'Checklist dentro das tarefas e horários mais claros',
    itens: [
      {
        tipo: 'feature',
        texto: 'Agora dá pra colocar uma lista de itens (checkboxes) dentro de uma tarefa — ex.: "Postar no Facebook", "Postar no WhatsApp", "Renovar anúncios". A tarefa só é dada como concluída quando todos os itens estão marcados; desmarcar um item reabre a tarefa.',
      },
      {
        tipo: 'feature',
        texto: 'Tarefa pode ser criada só com a lista de itens, sem título — o primeiro item vira o nome e o progresso (ex.: 2/3) aparece no card.',
      },
      {
        tipo: 'melhoria',
        texto: 'Nos detalhes da tarefa aparece quando ela foi designada e quando foi concluída, com o tempo relativo (ex.: "2h atrás").',
      },
    ],
  },
  {
    versao: '1.2.34',
    data: '2026-08-24',
    titulo: 'Clientes com moto, WhatsApp na mão e telas mais limpas',
    itens: [
      {
        tipo: 'feature',
        texto: 'No cadastro do cliente você já informa a(s) moto(s) que ele procura peça — ela aparece como etiqueta no cliente e na lista, com um ícone avisando quem tem pedido em aberto, sem precisar abrir a ficha.',
      },
      {
        tipo: 'feature',
        texto: 'Botão de WhatsApp direto na ficha e na lista de clientes: abre a conversa já com o número certo. Na tarefa com cliente, se ele ainda não tem número, dá pra cadastrar ali mesmo e já mandar mensagem.',
      },
      {
        tipo: 'feature',
        texto: 'Agora dá pra excluir um orçamento (com confirmação antes). As vendas já geradas a partir dele continuam intactas.',
      },
      {
        tipo: 'melhoria',
        texto: 'Nos detalhes da tarefa aparece quem a designou, além de quem é o responsável.',
      },
      {
        tipo: 'melhoria',
        texto: 'A tela de Novidades virou uma sanfona: cada versão começa recolhida e abre no toque, mais fácil de navegar no celular.',
      },
      {
        tipo: 'melhoria',
        texto: 'O recebimento de vendas fiado saiu de uma aba própria e virou uma sub-aba dentro do Caixa (ao lado de Pendências) — tudo que é dinheiro a receber num lugar só.',
      },
      {
        tipo: 'fix',
        texto: 'No celular o nome da tela não aparece mais duplicado no topo.',
      },
      {
        tipo: 'fix',
        texto: 'Em Categorias de Peça, no celular, os nomes aparecem por inteiro e as ações foram para um menu (⋯) — sem mais texto cortado nem tela estourando.',
      },
      {
        tipo: 'fix',
        texto: 'No cadastro de peça sobrou só um botão de câmera (com a opção de escolher da galeria), sem o botão repetido.',
      },
    ],
  },
  {
    versao: '1.2.33',
    data: '2026-08-22',
    titulo: 'Números que contam e fotos que abrem',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'Os valores do Painel, da "Visão completa do dono" e do Estoque agora contam até o número final quando a tela abre, em vez de simplesmente aparecerem — fica mais fácil perceber onde está o dado que importa no cartão.',
      },
      {
        tipo: 'melhoria',
        texto: 'No Estoque, alternar entre Lista, Por moto e Organograma virou um botão deslizante: a marcação escorrega até a opção escolhida, e no celular ele ficou mais alto pra acertar com o dedo.',
      },
      {
        tipo: 'melhoria',
        texto: 'As fotos das peças abrem em tela cheia ao toque — tanto na peça já cadastrada quanto nas fotos que você acabou de enviar. Toque em qualquer lugar (ou no X) pra fechar.',
      },
      {
        tipo: 'melhoria',
        texto: 'A busca de peças do Estoque agora anda pelo teclado: setas pra cima/baixo percorrem as sugestões, Enter escolhe e Esc fecha.',
      },
      {
        tipo: 'melhoria',
        texto: 'Quem liga "reduzir movimento" no celular ou no computador vê o sistema inteiro sem animação — as telas continuam funcionando igual, só sem o deslize.',
      },
    ],
  },
  {
    versao: '1.2.32',
    data: '2026-08-21',
    titulo: 'Telas mais fáceis de usar no dedo',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'Passamos o app inteiro pela lupa do celular: as abas e filtros de Tarefas, Frete, Estoque e Configurações, os botões de "Nova venda/Novo orçamento" e o campo de busca de Vendas e Orçamentos ganharam mais altura pra acertar com o dedo sem errar. No computador nada muda — os controles continuam compactos como antes.',
      },
      {
        tipo: 'melhoria',
        texto: 'Na cotação de frete, dá pra remover uma "caixa salva" pelo celular tocando no X (antes ele só aparecia quando o mouse passava por cima, então no celular não tinha como apagar).',
      },
      {
        tipo: 'melhoria',
        texto: 'Em Configurações, as linhas das árvores de Categorias e Motos ficaram mais altas e agora abrem/fecham ao tocar no nome inteiro, não só na setinha.',
      },
    ],
  },
  {
    versao: '1.2.31',
    data: '2026-08-21',
    titulo: 'Painel mais legível no celular',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'No celular, os cartões de indicador (faturamento, caixa, desempenho) não cortam mais o valor em reais: o número aparece inteiro, o rótulo pode ocupar duas linhas e, na "Visão completa do dono", os cartões viram um carrossel que você desliza pro lado — igual ao painel principal.',
      },
      {
        tipo: 'melhoria',
        texto: 'Os atalhos "Ver todas/Ver itens/Buscar" no celular ganharam uma área de toque maior, mais fácil de acertar com o dedo.',
      },
    ],
  },
  {
    versao: '1.2.30',
    data: '2026-08-21',
    titulo: 'Correções no celular: notificações e foto de peça',
    itens: [
      {
        tipo: 'fix',
        texto: 'No celular, tocar no card de notificações do painel agora abre a pilha de avisos ali mesmo (igual ao passar o mouse no computador) em vez de pular direto pra outra tela. Depois de aberto, é só tocar no aviso pra ir até ele.',
      },
      {
        tipo: 'fix',
        texto: 'No cadastro de peça pelo celular, agora tem um botão "Tirar foto" que abre a câmera direto. Escolher uma foto que já está no aparelho continua disponível como opção separada ("Escolher da galeria").',
      },
    ],
  },
  {
    versao: '1.2.29',
    data: '2026-08-20',
    titulo: 'Novo visual dos cards de métrica do painel',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'Os cards de indicadores do painel (valor em estoque, vendas, saídas, ticket médio) ganharam um visual mais limpo: o número em destaque com um selo de variação ao lado (seta e porcentagem, verde pra bom, vermelho pra ruim) e a comparação com o mês passado abaixo de uma linha.',
      },
    ],
  },
  {
    versao: '1.2.28',
    data: '2026-08-20',
    titulo: 'Últimas vendas do painel viram lista interativa',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'No painel, a lista de "Últimas vendas" agora é interativa: toque em qualquer venda e ela cresce suavemente num cartão de detalhes (código, data/hora, quantidade, cliente e canal), com atalho pra abrir a venda completa.',
      },
    ],
  },
  {
    versao: '1.2.27',
    data: '2026-08-20',
    titulo: 'Ficha do cliente com cartão de perfil animado',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'Ao abrir um cliente, os dados de cadastro (telefone, documento, aniversário, origem, contato preferido, motos e tags) agora aparecem num cartão de perfil que você pode abrir e fechar com uma animação suave, com o segmento do cliente destacado no topo.',
      },
    ],
  },
  {
    versao: '1.2.26',
    data: '2026-08-20',
    titulo: 'Card de notificações no painel',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'O sino de notificações do topo virou um card animado no painel, ao lado do gráfico de desempenho: os avisos que precisam de ação (estoque baixo, orçamentos pendentes e tarefas) ficam empilhados e se abrem em leque ao passar o mouse ou tocar, com um atalho "Ver todas".',
      },
    ],
  },
  {
    versao: '1.2.25',
    data: '2026-08-20',
    titulo: 'Motos em Configurações no estilo explorador de arquivos',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'A árvore de Motos em Configurações agora tem ícones de pasta (aberta/fechada) e abre/fecha os níveis com uma animação suave — igual a um explorador de arquivos, no mesmo estilo que as Categorias já tinham. Tudo o que já existia (arrastar pra reordenar, renomear, mover, adicionar foto, organograma) continua funcionando igual.',
      },
    ],
  },
  {
    versao: '1.2.24',
    data: '2026-08-20',
    titulo: 'Alternância animada entre Cotação e Envios no Frete',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'Na tela de Frete, o botão que troca entre "Cotação" e "Envios" ganhou uma animação suave: o destaque desliza de um lado pro outro em vez de piscar. Detalhe pequeno, mas deixa a navegação mais fluida — no computador e no celular.',
      },
    ],
  },
  {
    versao: '1.2.23',
    data: '2026-08-20',
    titulo: 'App Android volta a receber atualizações automáticas',
    itens: [
      {
        tipo: 'fix',
        texto: 'O app instalado no celular estava travado numa versão antiga: as novidades apareciam no computador, mas não chegavam no Android. A publicação automática das atualizações estava congelada e voltou a funcionar — agora cada novidade chega sozinha no app, sem precisar reinstalar.',
      },
    ],
  },
  {
    versao: '1.2.22',
    data: '2026-08-20',
    titulo: 'Tarefas mais fluidas, menus animados e categorias em estilo de pastas',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'As Tarefas agora aparecem como cards: toque em qualquer um e ele se abre suavemente num painel de detalhes com tudo da tarefa (cliente, telefone, prazo, prioridade). Vale tanto pra quem cria quanto pra quem executa.',
      },
      {
        tipo: 'melhoria',
        texto: 'As ações de cada tarefa (concluir, editar, excluir) ficaram num menu "⋯" animado, mais limpo do que a fileira de botões de antes.',
      },
      {
        tipo: 'melhoria',
        texto: 'Todos os seletores/dropdowns do sistema (filtros, ordenação) agora abrem e fecham com uma animação suave, e o item sob o cursor ganha um realce que desliza.',
      },
      {
        tipo: 'melhoria',
        texto: 'Em Configurações, as Categorias de Peça ganharam ícones de pasta (aberta/fechada) e uma animação de abrir/fechar os níveis — igual a um explorador de arquivos. Todo o resto (arrastar pra reordenar, renomear, mover, organograma) continua igual.',
      },
    ],
  },
  {
    versao: '1.2.21',
    data: '2026-08-20',
    titulo: 'Tooltip animado na barra lateral',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'Quando a barra lateral está recolhida (só ícones), agora ao passar o mouse sobre qualquer ícone aparece o nome da seção com uma animação suave de blur — muito mais claro pra identificar cada opção.',
      },
    ],
  },
  {
    versao: '1.2.20',
    data: '2026-08-20',
    titulo: 'Nova barra lateral, filtros corrigidos e carregamento mais confiável',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'A barra lateral de navegação foi redesenhada: visual mais limpo, agrupamento por seção (Estoque, Vendas, Gestão), e agora dá pra recolher ela pra só ícones clicando no botão embaixo — sobra mais espaço pra trabalhar.',
      },
      {
        tipo: 'fix',
        texto: 'O painel de filtros do Estoque abria do lado errado da tela e era difícil de fechar no celular. Agora abre encostado no botão e fecha ao tocar fora dele.',
      },
      {
        tipo: 'fix',
        texto: 'No celular (principalmente no app instalado), às vezes o sistema voltava pra uma versão antiga depois de recarregar. Corrigido com ajuste nos cabeçalhos de cache do servidor.',
      },
    ],
  },
  {
    versao: '1.2.19',
    data: '2026-08-20',
    titulo: 'Estoque mais rápido de usar: filtros, busca e detalhes na própria lista',
    itens: [
      {
        tipo: 'melhoria',
        texto: 'Os filtros do Estoque saíram da barra e viraram um botão "Filtros" só, que abre um painel com todos eles juntos. O botão mostra quantos filtros estão ligados, e dá pra limpar todos de uma vez.',
      },
      {
        tipo: 'feature',
        texto: 'A busca do Estoque agora sugere as peças enquanto você digita — clique numa sugestão pra abrir a peça direto, sem precisar procurar na lista.',
      },
      {
        tipo: 'melhoria',
        texto: 'Pra adicionar fotos de uma peça, agora dá pra arrastar os arquivos direto pra cima da área de fotos. Arquivo que não é imagem ou que passa do tamanho é avisado na hora, antes de tentar subir.',
      },
      {
        tipo: 'feature',
        texto: 'Cada linha da lista de Estoque ganhou uma setinha que abre os detalhes ali mesmo: categoria completa, avarias anotadas por unidade, links dos anúncios e as fotos — sem precisar abrir a peça.',
      },
    ],
  },
  {
    versao: '1.2.18',
    data: '2026-08-15',
    titulo: 'Tabelas de Estoque e Caixa com ordenação por coluna',
    itens: [
      {
        tipo: 'feature',
        texto: 'Na lista de Estoque, clique em "Peça", "Valor" ou "Qtd" pra ordenar por aquela coluna (clique de novo pra inverter). Os filtros de sempre continuam funcionando junto.',
      },
      {
        tipo: 'feature',
        texto: 'Novo filtro "Sem link ML" no Estoque, pra achar rápido as peças que ainda não têm anúncio vinculado no Mercado Livre.',
      },
      {
        tipo: 'feature',
        texto: 'Na lista do Caixa, agora dá pra ordenar os lançamentos por Data, Forma de pagamento ou Valor clicando no cabeçalho da coluna — antes só dava pra ver por data, do mais recente pro mais antigo.',
      },
    ],
  },
  {
    versao: '1.2.17',
    data: '2026-08-15',
    titulo: 'Gráficos do Dashboard renovados',
    itens: [
      {
        tipo: 'fix',
        texto:
          'O gráfico "Desempenho (30 dias)" agora mostra o saldo acumulado ao longo do mês, não mais o saldo de cada dia isolado — era isso que desenhava aquele formato de batimento cardíaco quando o caixa tinha poucos lançamentos.',
      },
      {
        tipo: 'melhoria',
        texto:
          'O gráfico de "Desempenho" e o donut de "Formas de pagamento" ganharam um visual mais limpo. O donut agora mostra o total no centro e a porcentagem de cada forma de pagamento, com um comparativo direto no cabeçalho do card em relação ao mês anterior.',
      },
      {
        tipo: 'melhoria',
        texto: 'Os cards de "Vendas do mês" e "Ticket médio" agora mostram se subiram ou desceram em relação ao mês passado, e "Saídas do mês" mostra a variação.',
      },
    ],
  },
  {
    versao: '1.2.16',
    data: '2026-08-14',
    titulo: 'Estoque e Mercado Livre agora conversam nos dois sentidos',
    itens: [
      {
        tipo: 'feature',
        texto:
          'Venda feita no Mercado Livre agora dá baixa no estoque sozinha, com aviso no celular dizendo qual peça saiu. Pedido que não bate com nenhuma peça do catálogo nunca vira venda automática — você recebe um aviso pra registrar na mão.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Pedido do Mercado Livre que o sistema não conseguiu importar sozinho (pagamento que nunca aprovou, duas unidades do mesmo anúncio no mesmo pedido, erro de conexão) agora avisa no celular em vez de sumir em silêncio — sempre com o número do pedido pra você registrar na mão.',
      },
      {
        tipo: 'feature',
        texto:
          'Vendeu no balcão uma peça que está anunciada no Mercado Livre? Você recebe um aviso de que o anúncio ficou com quantidade desatualizada, com atalho direto pra tela de revisão. Aplicar continua sendo decisão sua, com a lista de conferência de sempre.',
      },
      {
        tipo: 'feature',
        texto:
          'A descrição do anúncio já abre preenchida com o texto padrão da RK Sucatas. Tem um botão pra limpar quando você quiser escrever outro, e pra restaurar o padrão depois.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Ligar o toggle "Publicar automaticamente no Mercado Livre" já começa a remover o fundo das fotos em segundo plano. Quando você abre o formulário, as prévias estão prontas — aprovar cada foto continua sendo seu clique.',
      },
      {
        tipo: 'fix',
        texto:
          'O toggle de padronizar a categoria do Mercado Livre salvava a escolha, mas ela nunca voltava: toda peça nova da mesma categoria (Lanterna, por exemplo) abria sem a categoria pré-selecionada. Corrigido — agora a predefinição realmente aparece.',
      },
      {
        tipo: 'fix',
        texto:
          'Venda de anúncio com variações registrava a peça genérica sem saber qual ficha específica tinha saído. Agora a venda é vinculada à ficha certa.',
      },
    ],
  },
  {
    versao: '1.2.15',
    data: '2026-08-14',
    titulo: 'Corrige anúncio duplicado no Mercado Livre',
    itens: [
      {
        tipo: 'fix',
        texto:
          'Publicar uma peça podia criar DOIS anúncios no Mercado Livre em vez de um, com um único clique e sem nenhum aviso — e o sistema só registrava um deles, deixando o outro solto na sua conta. Corrigido: agora o sistema descobre o formato que a sua conta do Mercado Livre exige antes de publicar, e envia o anúncio uma única vez.',
      },
      {
        tipo: 'fix',
        texto:
          'Quando a publicação precisa cair no modo "um anúncio por ficha", a ficha que tinha foto própria fazia o anúncio dela sair só com essa foto, descartando as outras escolhidas no formulário. Agora as fotos se somam: nenhum anúncio sai com menos fotos do que você selecionou.',
      },
    ],
  },
  {
    versao: '1.2.14',
    data: '2026-08-14',
    titulo: 'Corrige fotos/título presos na peça anterior e agiliza publicação no Mercado Livre',
    itens: [
      {
        tipo: 'fix',
        texto:
          'Publicar a peça A, fechar o formulário e publicar a peça B em seguida podia sair com as fotos, título, descrição e categoria da peça A — o formulário não limpava esses campos ao trocar de peça sem fechar o app. Corrigido: agora reseta tudo automaticamente a cada peça diferente.',
      },
      {
        tipo: 'feature',
        texto:
          'Marca, Número de peça e Tipo de veículo agora vêm pré-preenchidos automaticamente a partir da moto vinculada à peça no cadastro, quando a categoria escolhida no Mercado Livre tem esses campos — continuam editáveis manualmente.',
      },
      {
        tipo: 'feature',
        texto:
          'Novo toggle "Padronizar esta categoria do Mercado Livre": ao ativar depois de escolher a categoria de uma peça, as próximas peças da mesma categoria interna (ex: "Carcaças") já abrem com essa categoria do Mercado Livre pré-selecionada, sem precisar buscar de novo.',
      },
    ],
  },
  {
    versao: '1.2.13',
    data: '2026-08-14',
    titulo: 'Remoção de fundo mais rápida e sem travar, avisos de foto e menu "Mais" mais fluido no celular',
    itens: [
      {
        tipo: 'fix',
        texto:
          'Remover o fundo de uma foto travava a tela até o processo terminar, principalmente no celular. A extração agora roda em segundo plano (Web Worker) em vez de travar a tela — e dá pra remover o fundo de até 2 fotos ao mesmo tempo, sem esperar uma terminar pra começar a outra.',
      },
      {
        tipo: 'fix',
        texto:
          'Se o Mercado Livre falhasse em anexar alguma foto ao criar o anúncio (sem motivo aparente), isso passava batido, sem nenhum aviso. Agora, se alguma foto não entrar, aparece um aviso dizendo quantas faltaram.',
      },
      {
        tipo: 'fix',
        texto: 'O menu "Mais" da barra inferior no celular estava lento pra abrir/fechar, especialmente em iPhone — corrigido.',
      },
      {
        tipo: 'feature',
        texto:
          'Nova seção "Anúncios publicados" na aba Mercado Livre, mostrando os anúncios que o sistema publicou (peça, "há quanto tempo" e link direto), com filtros por Hoje, Ontem, 7 dias ou Todos.',
      },
    ],
  },
  {
    versao: '1.2.12',
    data: '2026-08-14',
    titulo: 'Corrige título do anúncio ignorado ao publicar no Mercado Livre',
    itens: [
      {
        tipo: 'fix',
        texto:
          'Anúncios publicados em contas migradas pro modelo novo do Mercado Livre (Preço por Variação) estavam sempre saindo com o título do cadastro de estoque, mesmo com um título próprio preenchido no formulário do anúncio — a descrição respeitava o texto próprio, só o título não. Corrigido: o título personalizado agora é respeitado em qualquer caminho de publicação.',
      },
    ],
  },
  {
    versao: '1.2.11',
    data: '2026-08-14',
    titulo: 'Publicar no Mercado Livre: título/descrição próprios do anúncio e remoção de fundo das fotos',
    itens: [
      {
        tipo: 'feature',
        texto:
          'Ao publicar um anúncio no Mercado Livre, agora dá pra escrever um título e uma descrição só pro anúncio, diferentes do nome e da descrição cadastrados na peça — o nome no estoque é pensado pra busca rápida no catálogo interno, não pra vender bem no Mercado Livre. O título tem contador até 60 caracteres, o limite real do anúncio. Isso nunca altera o cadastro da peça, só o que aparece pro comprador.',
      },
      {
        tipo: 'feature',
        texto:
          'Também dá pra remover o fundo de qualquer foto antes de publicar — peça com fundo branco vende mais. É processado no próprio navegador, sem custo por foto. Mostra antes/depois pra aprovar, dá pra tentar de novo com outra foto se não gostar, e um botão separado permite trocar também as fotos da peça no estoque pelas versões sem fundo.',
      },
    ],
  },
  {
    versao: '1.2.10',
    data: '2026-08-13',
    titulo: 'Publicar no Mercado Livre: vínculo com produto de catálogo direto no formulário',
    itens: [
      {
        tipo: 'feature',
        texto:
          'Algumas categorias do Mercado Livre exigem que o anúncio seja vinculado a um produto já existente no catálogo deles — antes, quando isso acontecia, o sistema simplesmente bloqueava a publicação e mandava publicar manualmente pelo site do Mercado Livre. Agora, ao entrar numa categoria assim, o sistema busca sozinho os produtos de catálogo que combinam com a peça e mostra como opções clicáveis (com foto e nome) direto no formulário de publicação — é só escolher um pra vincular. Se nenhum bater com o que está sendo vendido, o botão "Não é o que eu vendo" publica o anúncio normalmente, sem vínculo com catálogo.',
      },
    ],
  },
  {
    versao: '1.2.9',
    data: '2026-08-13',
    titulo: 'Publicar no Mercado Livre: formulário de atributos sem campos genéricos',
    itens: [
      {
        tipo: 'fix',
        texto:
          'O formulário de atributos ao publicar um anúncio não mostrava mais campos genéricos que o Mercado Livre sempre retorna pra qualquer categoria (Voltagem, IVA para revenda, IEPS, dados de embalagem, alimentos e bebidas, medicamentos...) misturados com os campos realmente relevantes da peça. Agora só os campos relevantes aparecem direto; os genéricos ficam agrupados em "Mostrar mais campos", colapsado por padrão. A separação usa os próprios metadados que a API do Mercado Livre já devolve por atributo (não uma lista fixa de nomes) — funciona igual pra qualquer categoria de peça.',
      },
    ],
  },
  {
    versao: '1.2.8',
    data: '2026-08-13',
    titulo: 'Publicar no Mercado Livre: navegação de categoria, cards de tipo de anúncio e SKU automático',
    itens: [
      { tipo: 'fix', texto: 'Categoria do anúncio: quando a sugestão automática erra (ex: peça avulsa caindo em "Motos e Scooters" em vez da categoria certa de peça), agora dá pra navegar manualmente em árvore — "Não encontrou? Ver todas as categorias" — até achar a categoria certa, com trilha clicável no topo pra voltar níveis. Isso corrige o formulário de atributos mostrando campos de moto inteira (marca, modelo, cilindrada...) numa peça que não é uma moto.' },
      { tipo: 'melhoria', texto: 'Tipo de anúncio (Clássico/Premium) agora aparece como cards com o valor da taxa em R$ e os benefícios de cada um, igual ao site do Mercado Livre — antes era um menu com só a porcentagem da taxa.' },
      { tipo: 'melhoria', texto: 'O campo de SKU do anúncio já vem preenchido com o código interno da peça (editável), destacado no topo da lista de atributos. Os atributos obrigatórios da categoria aparecem primeiro na lista, antes dos opcionais.' },
    ],
  },
  {
    versao: '1.2.7',
    data: '2026-08-10',
    titulo: 'Fiado/Pendência no Caixa e aba de Lembretes',
    itens: [
      { tipo: 'feature', texto: 'No Caixa, "Fiado/Pendência" agora é uma 3ª opção ao lado de Entrada/Saída — o valor só entra no saldo depois que o recebimento é confirmado (parcial ou total) na nova sub-aba "Pendências", dentro de Caixa.' },
      { tipo: 'feature', texto: 'Nova aba "Lembretes", dentro de Tarefas: crie um aviso que repete a cada 5, 10, 25 minutos (ou outro intervalo) até você marcar como concluído, ou que dispara uma vez só num horário específico. Pode atribuir a qualquer usuário, não só a você mesmo.' },
    ],
  },
  {
    versao: '1.2.6',
    data: '2026-08-08',
    titulo: 'Sistema instalável direto do navegador (inclusive no iPhone)',
    itens: [
      { tipo: 'feature', texto: 'O site agora pode ser instalado como um app, sem precisar do APK: no navegador (Android/PC) aparece a opção de instalar, e no iPhone (Safari → Compartilhar → Adicionar à Tela de Início) o sistema vira um app de verdade na tela inicial, incluindo notificações.' },
    ],
  },
  {
    versao: '1.2.5',
    data: '2026-08-08',
    titulo: 'Corrige erro ao ativar notificações pelo navegador (Web Push)',
    itens: [
      { tipo: 'fix', texto: '"Ativar notificações" pelo navegador crashava com um erro técnico ("Cannot read properties of undefined") quando as chaves VAPID não estavam configuradas no servidor — agora mostra a mensagem correta.' },
    ],
  },
  {
    versao: '1.2.4',
    data: '2026-08-08',
    titulo: 'Erro de "ativar notificações" agora mostra o motivo real',
    itens: [
      { tipo: 'melhoria', texto: 'Quando "Ativar notificações" falha, a mensagem agora inclui o motivo técnico entre parênteses, em vez de só "tente novamente" — ajuda a identificar o problema sem precisar de acesso ao console do celular.' },
    ],
  },
  {
    versao: '1.2.3',
    data: '2026-08-08',
    titulo: 'Correção: ativar notificações no app Android não registrava o dispositivo',
    itens: [
      { tipo: 'fix', texto: 'Faltava declarar a permissão de notificação (obrigatória a partir do Android 13) no app — o pedido de permissão era recusado por baixo dos panos mesmo com tudo certo do lado do servidor.' },
      { tipo: 'fix', texto: 'O app avisava "notificações ativadas" mesmo quando o cadastro do dispositivo falhava no servidor — agora mostra o erro de verdade em vez de fingir sucesso.' },
    ],
  },
  {
    versao: '1.2.2',
    data: '2026-08-08',
    titulo: 'Correção: login dando "Failed to fetch" no app Android',
    itens: [
      { tipo: 'fix', texto: 'Login no app Android instalado (APK) falhava com "Failed to fetch": o servidor passou a checar de verdade a origem das requisições (CORS) e a lista não incluía a origem real usada pelo app empacotado no Android. Login volta a funcionar normalmente.' },
      { tipo: 'fix', texto: 'Envio de fotos de peça, foto de modelo de moto e comprovante Pix corrigido no app Android — usavam um endereço relativo que só funciona no navegador, não dentro do app empacotado.' },
    ],
  },
  {
    versao: '1.2.1',
    data: '2026-08-08',
    titulo: 'Correção: login pulando a tela de senha no app Android',
    itens: [
      { tipo: 'fix', texto: 'No app Android instalado (APK), o sistema pulava direto pra dentro sem pedir a senha de admin, e os dados de estoque/vendas/caixa apareciam zerados — um atalho de desenvolvimento local acabava disparando também dentro do app empacotado. Login e dados voltam ao normal.' },
      { tipo: 'fix', texto: 'Corrigido o botão "Ativar notificações" retornando "não foi possível" no app Android — era consequência do mesmo problema de login acima.' },
    ],
  },
  {
    versao: '1.2.0',
    data: '2026-08-07',
    titulo: 'Notificações no app Android + atualização automática',
    itens: [
      { tipo: 'feature', texto: 'Notificações (como "tarefa nova atribuída a você") agora chegam também no app Android instalado no celular, mesmo com o app fechado — antes só funcionava com o navegador aberto.' },
      { tipo: 'melhoria', texto: 'O app Android passa a se atualizar sozinho quando sai uma mudança de tela/funcionalidade, sem precisar baixar e instalar o APK de novo. Só quando a mudança mexe em algo mais profundo do app é que é preciso reinstalar.' },
    ],
  },
  {
    versao: '1.1.0',
    data: '2026-08-07',
    titulo: 'Fiado, fichas de estoque e tarefas no Dashboard',
    itens: [
      { tipo: 'melhoria', texto: 'Telefone e CPF/CNPJ de clientes agora são formatados automaticamente ao digitar.' },
      { tipo: 'feature', texto: 'Clientes ganham badges das motos que já procuraram peça, no lugar de usar etiquetas genéricas pra isso.' },
      { tipo: 'feature', texto: 'Novo filtro na listagem de Clientes por moto procurada.' },
      { tipo: 'fix', texto: '"Compartilhar no WhatsApp" não aparece mais no detalhe de uma venda — só fazia sentido pra peças de estoque.' },
      { tipo: 'feature', texto: 'Vendas fiado passam a mostrar a forma de pagamento real usada na quitação (ex: "Pix"), em vez de continuar como "Pendência" pra sempre.' },
      { tipo: 'feature', texto: 'Agora dá pra reverter um recebimento de fiado pela aba Fiado, e cancelar uma venda fiado já quitada (com estorno completo) direto pela aba Vendas.' },
      { tipo: 'melhoria', texto: 'Caixa passa a recusar a exclusão direta de um lançamento vinculado a um recebimento de fiado, orientando a reverter pela aba Fiado.' },
      { tipo: 'melhoria', texto: '"Compartilhar no WhatsApp" no estoque virou um botão de ação pequeno, junto de Editar/Excluir, em vez do botão principal do modal.' },
      { tipo: 'feature', texto: 'Agora dá pra vender uma ficha/unidade específica de um item (ex: "a com avaria"), em vez de sempre sair uma unidade genérica do lote.' },
      { tipo: 'melhoria', texto: 'Campo de valor (R$) no cadastro de item de estoque ganhou máscara de moeda.' },
      { tipo: 'fix', texto: '"Vender em partes": adicionar uma parte nova com Enter agora funciona também no teclado virtual do celular (antes só funcionava no desktop).' },
      { tipo: 'feature', texto: 'Ao vender a última parte restante de um item, o valor sugerido já vem calculado (valor original menos o que já foi vendido em partes).' },
      { tipo: 'feature', texto: 'Indicador persistente na listagem de estoque para itens com unidade incompleta (venda em partes em andamento).' },
      { tipo: 'feature', texto: 'Novo filtro "Sem foto" na listagem de estoque.' },
      { tipo: 'feature', texto: 'O sino de notificações do Dashboard passa a mostrar as tarefas pendentes do sistema.' },
      { tipo: 'feature', texto: 'Admin pode criar tarefas para si mesmo, e o Dashboard ganhou um card com as tarefas pendentes de todos os usuários.' },
      { tipo: 'melhoria', texto: 'Alerta de estoque baixo no Dashboard ficou com o número em destaque, seguindo o padrão do resto do painel.' },
      { tipo: 'feature', texto: 'Esta aba de Novidades — pra acompanhar o que muda no sistema a cada atualização.' },
      { tipo: 'feature', texto: 'Categorias e Motos ganham visualização em organograma (árvore visual, com linhas conectando os níveis) em Configurações, além de uma 3ª opção "Organograma" dentro do Estoque — clicar num nó filtra as peças direto por ali.' },
      { tipo: 'feature', texto: 'Nova aba "Notificações": dá pra ativar notificações reais no navegador (chegam mesmo com o sistema fechado). Primeiro aviso ligado: tarefa nova atribuída a você.' },
    ],
  },
];
