// Fonte única do sistema de PERMISSÕES GRANULARES por tela/ação — substitui o
// controle por CARGO (ver roles.ts). Importado tanto pelo frontend (helper
// `pode`/hook usePermissao, editor em UsuariosView) quanto pelo backend
// (middleware exigirPermissao, validação do CRUD de usuários), pra back e
// front sempre lerem a MESMA definição (mesmo raciocínio de roles.ts —
// server.ts roda no mesmo projeto TS via tsx).
//
// Cada TELA tem uma ação `ver` (a primeira, obrigatória) e ações granulares
// que dependem dela: não dá pra criar/deletar numa tela que a pessoa nem vê.
// Chave completa de uma permissão = `${tela}.${acao}` (ex: 'estoque.criar').
//
// As ações abaixo foram derivadas das rotas reais (src/server/routes/*) e das
// Views (src/features/*) — nada aqui é ação inventada; cada uma corresponde a
// um handler/botão que já existe. `admin` continua super-usuário: ignora este
// mapa inteiro (acesso total) e segue sendo o único gestor de usuários, então
// a gestão de usuários NÃO aparece como ação aqui de propósito.

export interface AcaoPermissao {
  /** Chave curta, estável e única dentro da tela (ex: 'criar'). */
  chave: string;
  /** Rótulo em PT-BR pro editor de permissões. */
  rotulo: string;
  /** Explicação curta opcional (o que essa ação libera de concreto). */
  descricao?: string;
}

export interface TelaPermissao {
  /** Chave estável da tela — bate com Tab em navigation.ts quando é uma aba. */
  chave: string;
  /** Rótulo em PT-BR pro editor de permissões. */
  rotulo: string;
  /** Descrição curta opcional da tela. */
  descricao?: string;
  /** A PRIMEIRA ação é sempre `ver`; as demais dependem dela. */
  acoes: AcaoPermissao[];
}

// Mapa de permissões de um usuário: { "<tela>": { "<acao>": boolean } }.
// Armazenado como JSONB na coluna usuarios.permissoes (ver migration).
export type Permissoes = Record<string, Record<string, boolean>>;

// ---------------------------------------------------------------------------
// CATÁLOGO — a fonte da verdade de "quais telas existem e o que dá pra fazer
// em cada uma". A ordem aqui é a ordem em que o editor de permissões mostra as
// seções.
// ---------------------------------------------------------------------------
export const CATALOGO_PERMISSOES: TelaPermissao[] = [
  {
    chave: 'dashboard',
    rotulo: 'Dashboard',
    descricao: 'Painel geral com visão do negócio.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver o painel', descricao: 'Abrir o Dashboard (alertas, listas, tarefas pendentes).' },
      {
        chave: 'ver_valores',
        rotulo: 'Ver os valores',
        descricao: 'Ver os cards de estatística com dinheiro (estoque, vendas, saídas, ticket) e os gráficos.',
      },
      {
        chave: 'ver_visao_dono',
        rotulo: 'Ver a Visão do Dono',
        descricao: 'Ver a seção "Visão completa do negócio" (faturamento, desempenho, caixa e vendas detalhados) — hoje só admin.',
      },
    ],
  },
  {
    chave: 'estoque',
    rotulo: 'Estoque',
    descricao: 'Catálogo de peças, unidades e anúncios.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver o estoque', descricao: 'Consultar peças, fichas de unidade e anúncios vinculados.' },
      { chave: 'criar', rotulo: 'Cadastrar peças', descricao: 'Adicionar novas peças ao estoque.' },
      { chave: 'editar', rotulo: 'Editar peças', descricao: 'Alterar dados, fichas de unidade, quantidade e categoria (inclusive em lote).' },
      { chave: 'deletar', rotulo: 'Excluir peças', descricao: 'Apagar peças (uma ou em lote).' },
      { chave: 'anunciar_ml', rotulo: 'Anunciar no Mercado Livre', descricao: 'Publicar, vincular e republicar anúncios da peça no Mercado Livre.' },
      { chave: 'anunciar_shopee', rotulo: 'Anunciar na Shopee', descricao: 'Publicar e republicar anúncios da peça na Shopee.' },
    ],
  },
  {
    chave: 'frete',
    rotulo: 'Frete',
    descricao: 'Cotação e rastreamento de envios.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver frete', descricao: 'Calcular cotação e consultar os envios registrados.' },
      { chave: 'criar', rotulo: 'Registrar envio', descricao: 'Registrar um novo envio.' },
      { chave: 'editar', rotulo: 'Editar/rastrear envio', descricao: 'Alterar dados e atualizar o rastreio de um envio.' },
      { chave: 'deletar', rotulo: 'Excluir envio', descricao: 'Apagar um envio registrado.' },
    ],
  },
  {
    chave: 'mercadolivre',
    rotulo: 'Mercado Livre',
    descricao: 'Integração com a conta do Mercado Livre.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver Mercado Livre', descricao: 'Ver status da conta, perguntas, pedidos, anúncios órfãos/duplicados e pendências.' },
      { chave: 'conectar', rotulo: 'Conectar/desconectar conta', descricao: 'Vincular ou desvincular a conta e ajustar a margem de repasse.' },
      { chave: 'sincronizar', rotulo: 'Sincronizar anúncios', descricao: 'Aplicar preço/estoque atuais nos anúncios selecionados.' },
      { chave: 'importar_pedidos', rotulo: 'Importar pedidos', descricao: 'Importar um pedido do Mercado Livre como venda.' },
      { chave: 'responder_perguntas', rotulo: 'Responder perguntas', descricao: 'Responder perguntas de clientes nos anúncios.' },
      { chave: 'pausar_anuncio', rotulo: 'Pausar anúncios', descricao: 'Pausar anúncios órfãos ou duplicados.' },
    ],
  },
  {
    chave: 'vendas',
    rotulo: 'Vendas',
    descricao: 'Registro e gestão de vendas.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver vendas', descricao: 'Consultar as vendas registradas.' },
      { chave: 'criar', rotulo: 'Registrar venda', descricao: 'Registrar uma nova venda (baixa de estoque + caixa).' },
      { chave: 'editar', rotulo: 'Editar venda', descricao: 'Alterar forma de pagamento, cliente e observações e anexar comprovantes.' },
      { chave: 'cancelar', rotulo: 'Cancelar venda', descricao: 'Cancelar uma venda (estorna estoque e caixa).' },
      { chave: 'cancelar_fiado', rotulo: 'Cancelar venda fiado quitada', descricao: 'Cancelar em cascata uma venda fiado já recebida (reverte os recebimentos).' },
      { chave: 'excluir_comprovante', rotulo: 'Excluir comprovante PIX', descricao: 'Remover um comprovante de PIX anexado a uma venda.' },
    ],
  },
  {
    chave: 'orcamentos',
    rotulo: 'Orçamentos',
    descricao: 'Orçamentos e conversão em venda.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver orçamentos', descricao: 'Consultar os orçamentos.' },
      { chave: 'criar', rotulo: 'Criar orçamento', descricao: 'Montar um novo orçamento.' },
      { chave: 'editar', rotulo: 'Editar orçamento', descricao: 'Alterar dados e itens de um orçamento em aberto.' },
      { chave: 'vender', rotulo: 'Vender orçamento', descricao: 'Converter itens (ou tudo) do orçamento em venda.' },
      { chave: 'cancelar', rotulo: 'Cancelar orçamento', descricao: 'Marcar um orçamento em aberto como cancelado.' },
      { chave: 'excluir', rotulo: 'Excluir orçamento', descricao: 'Apagar um orçamento definitivamente.' },
    ],
  },
  {
    chave: 'clientes',
    rotulo: 'Clientes',
    descricao: 'Cadastro e ficha dos clientes.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver clientes', descricao: 'Consultar a lista e a ficha dos clientes.' },
      { chave: 'criar', rotulo: 'Cadastrar cliente', descricao: 'Adicionar um novo cliente.' },
      { chave: 'editar', rotulo: 'Editar cliente', descricao: 'Alterar cadastro, notas, motos, pedidos e visitas.' },
      {
        chave: 'administrar',
        rotulo: 'Administrar clientes',
        descricao: 'Corrigir origem histórica, bloquear, desbloquear, desativar, reativar e administrar sinônimos.',
      },
    ],
  },
  {
    chave: 'caixa',
    rotulo: 'Caixa',
    descricao: 'Livro de caixa, fiado e pendências.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver o caixa', descricao: 'Consultar lançamentos, recebimentos de fiado e pendências.' },
      { chave: 'criar', rotulo: 'Lançar no caixa', descricao: 'Registrar uma entrada ou saída manual.' },
      { chave: 'editar', rotulo: 'Editar lançamento', descricao: 'Alterar um lançamento de caixa.' },
      { chave: 'excluir', rotulo: 'Excluir lançamento', descricao: 'Apagar um lançamento manual de caixa.' },
      { chave: 'receber_fiado', rotulo: 'Receber fiado', descricao: 'Registrar e reverter recebimentos de vendas fiado.' },
      { chave: 'gerenciar_pendencias', rotulo: 'Gerenciar pendências', descricao: 'Criar pendências e registrar/reverter seus recebimentos.' },
    ],
  },
  {
    chave: 'tarefas',
    rotulo: 'Tarefas',
    descricao: 'Tarefas de campo e lembretes.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver tarefas', descricao: 'Ver as tarefas (e usar os lembretes). Quem não pode criar vê só as próprias.' },
      { chave: 'criar', rotulo: 'Criar e atribuir tarefas', descricao: 'Criar tarefas e atribuir a outra pessoa (também dá a visão de todas as tarefas).' },
      { chave: 'editar', rotulo: 'Editar tarefas', descricao: 'Alterar tarefas que pode gerenciar.' },
      { chave: 'excluir', rotulo: 'Excluir tarefas', descricao: 'Apagar tarefas que pode gerenciar.' },
      { chave: 'concluir', rotulo: 'Concluir tarefas', descricao: 'Dar baixa, reabrir e marcar itens do checklist.' },
    ],
  },
  {
    chave: 'configuracoes',
    rotulo: 'Configurações',
    descricao: 'Tabelas de apoio do sistema.',
    acoes: [
      { chave: 'ver', rotulo: 'Ver configurações', descricao: 'Abrir a tela de Configurações.' },
      { chave: 'gerenciar_categorias', rotulo: 'Gerenciar categorias', descricao: 'Criar, renomear, mover e excluir categorias de peça.' },
      { chave: 'gerenciar_motos', rotulo: 'Gerenciar motos', descricao: 'Criar, renomear, reordenar e excluir modelos de moto.' },
      { chave: 'gerenciar_pagamento', rotulo: 'Gerenciar formas de pagamento', descricao: 'Criar, renomear, excluir e marcar/desmarcar como fiado.' },
      { chave: 'gerenciar_promocoes', rotulo: 'Gerenciar promoções', descricao: 'Criar, editar e excluir promoções.' },
    ],
  },
  {
    chave: 'patchnotes',
    rotulo: 'Novidades',
    descricao: 'Changelog do produto.',
    acoes: [{ chave: 'ver', rotulo: 'Ver novidades', descricao: 'Ler o histórico de novidades do sistema.' }],
  },
  {
    chave: 'notificacoes',
    rotulo: 'Notificações',
    descricao: 'Preferências de notificação por push.',
    acoes: [{ chave: 'ver', rotulo: 'Ver notificações', descricao: 'Gerenciar as próprias inscrições de notificação por push.' }],
  },
];

// ---------------------------------------------------------------------------
// Derivados do catálogo — usados por validação (backend) e pelo helper `pode`.
// ---------------------------------------------------------------------------

/** Todas as chaves válidas de tela (ex: 'estoque'). */
export const TELAS_VALIDAS: string[] = CATALOGO_PERMISSOES.map((t) => t.chave);

/** Todas as chaves completas válidas (ex: 'estoque.criar'). */
export const CHAVES_VALIDAS: string[] = CATALOGO_PERMISSOES.flatMap((t) => t.acoes.map((a) => `${t.chave}.${a.chave}`));

/** true se `${tela}.${acao}` existe no catálogo. */
export function chaveExiste(tela: string, acao: string): boolean {
  const t = CATALOGO_PERMISSOES.find((x) => x.chave === tela);
  return !!t && t.acoes.some((a) => a.chave === acao);
}

// Normaliza o que veio do cliente pra um mapa de permissões limpo: mantém só
// as chaves conhecidas do catálogo e só o valor `true` (o resto é omitido).
// Usado no CRUD de usuários pra nunca gravar lixo em usuarios.permissoes.
export function sanitizarPermissoes(raw: unknown): Permissoes {
  const out: Permissoes = {};
  if (!raw || typeof raw !== 'object') return out;
  const entrada = raw as Record<string, unknown>;
  for (const tela of CATALOGO_PERMISSOES) {
    const mapaRaw = entrada[tela.chave];
    if (!mapaRaw || typeof mapaRaw !== 'object') continue;
    const acoesRaw = mapaRaw as Record<string, unknown>;
    for (const a of tela.acoes) {
      if (acoesRaw[a.chave] === true) (out[tela.chave] ??= {})[a.chave] = true;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// `pode` — a checagem central, compartilhada por frontend e backend.
// Regras:
//   - admin é super-usuário: sempre true.
//   - `<tela>.ver` depende só de permissoes[tela].ver.
//   - qualquer outra ação exige ver=true E a própria ação=true (dependência).
// ---------------------------------------------------------------------------
export function pode(permissoes: Permissoes | null | undefined, isAdmin: boolean, chave: string): boolean {
  if (isAdmin) return true;
  if (!permissoes) return false;

  const ponto = chave.indexOf('.');
  if (ponto <= 0) return false;
  const tela = chave.slice(0, ponto);
  const acao = chave.slice(ponto + 1);

  const mapa = permissoes[tela];
  if (!mapa) return false;

  const podeVer = mapa.ver === true;
  if (acao === 'ver') return podeVer;
  // Dependência: só vale a ação se a pessoa também vê a tela.
  return podeVer && mapa[acao] === true;
}

// ---------------------------------------------------------------------------
// BACKFILL — equivalência 1:1 com o comportamento por CARGO de hoje, pra
// ninguém perder nem ganhar acesso no deploy. A migration SQL replica ESTE
// mapa; qualquer divergência quebra o critério de aceite "usuários existentes
// mantêm exatamente o acesso de hoje" (coberto por permissoes.test.ts).
//
// Referência do que cada cargo vê/faz hoje: TAB_ROLES em roles.ts + os gates
// por rota em server.ts e src/server/routes/*.
// ---------------------------------------------------------------------------

// Ações que hoje são exclusivas de admin mesmo dentro de rotas admin+equipe:
// vendas.cancelar_fiado / vendas.excluir_comprovante (ver vendas.ts) e a
// Visão do Dono do Dashboard (só admin, ver VisaoDono.tsx). Equipe NÃO as
// recebe no backfill, mas todas continuam GRANTÁVEIS individualmente pelo dono
// (é o ganho do novo sistema — ex: dar só a Visão do Dono a uma pessoa).
const SEM_EQUIPE = new Set<string>([
  'vendas.cancelar_fiado',
  'vendas.excluir_comprovante',
  'dashboard.ver_visao_dono',
  'clientes.administrar',
]);

function ligar(p: Permissoes, tela: string, acao: string): void {
  (p[tela] ??= {})[acao] = true;
}

function ligarTudo(p: Permissoes): void {
  for (const tela of CATALOGO_PERMISSOES) for (const a of tela.acoes) ligar(p, tela.chave, a.chave);
}

function ligarEquipe(p: Permissoes): void {
  for (const tela of CATALOGO_PERMISSOES) {
    for (const a of tela.acoes) {
      const chave = `${tela.chave}.${a.chave}`;
      if (!SEM_EQUIPE.has(chave)) ligar(p, tela.chave, a.chave);
    }
  }
}

/**
 * Converte a lista de cargos antigos no mapa de permissões equivalente.
 * União quando há mais de um cargo (um usuário pode ter vários, ver
 * migration_020). Admin preenche tudo por consistência, mas na prática o
 * middleware/`pode` já o trata como super-usuário e ignora o mapa.
 */
export function permissoesDeRoles(roles: string[]): Permissoes {
  const p: Permissoes = {};
  for (const role of roles) {
    switch (role) {
      case 'admin':
        ligarTudo(p);
        break;
      case 'equipe':
        ligarEquipe(p);
        break;
      case 'estoque_leitura':
        // Eloisa: só consulta o estoque (+ changelog e notificações, que hoje
        // são visíveis a todo cargo logado — ALL_ROLES em TAB_ROLES).
        ligar(p, 'estoque', 'ver');
        ligar(p, 'patchnotes', 'ver');
        ligar(p, 'notificacoes', 'ver');
        break;
      case 'mandados':
      case 'mecanico':
        // Cargos de campo: recebem tarefa e dão baixa nas próprias (o escopo
        // "só as minhas" continua no backend). Também veem changelog e
        // notificações (ALL_ROLES).
        ligar(p, 'tarefas', 'ver');
        ligar(p, 'tarefas', 'concluir');
        ligar(p, 'patchnotes', 'ver');
        ligar(p, 'notificacoes', 'ver');
        break;
    }
  }
  return p;
}
