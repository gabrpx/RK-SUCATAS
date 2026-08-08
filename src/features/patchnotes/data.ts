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
