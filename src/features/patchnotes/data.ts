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
