// Tipos do módulo Shopee — espelham exatamente o formato que
// src/server/routes/shopee.ts devolve (a lógica de origem mora em
// src/services/shopee{Api,Publicacao}.ts, no backend). Companheiro de
// src/features/mercadolivre/types.ts.

// Um nó da navegação manual em árvore de categoria — GET /api/shopee/categorias
// (raiz, sem parâmetro) ou GET /api/shopee/categorias/:id (filhos + atributos
// dessa categoria). Sem preditor de categoria confirmado pra Shopee (ver
// docs/proposta-publicacao-shopee.md, seção 1.3) — diferente do Mercado
// Livre, a busca com sugestão por título não existe aqui, só navegação em
// árvore.
export interface CategoriaShopeeNo {
  categoryId: number;
  categoryName: string;
  hasChildren: boolean;
  parentCategoryId: number;
}

// Um atributo da categoria escolhida — o formulário dinâmico renderiza 1
// campo por atributo (lista = select com `values`, número = input numérico,
// boolean = toggle, texto = campo livre), mesmo padrão de AtributoMl.
export interface AtributoShopee {
  attributeId: number;
  name: string;
  isMandatory: boolean;
  inputType: string;
  values?: { valueId: number; originalValueName: string }[];
}

export interface CanalLogisticaShopee {
  logisticsChannelId: number;
  logisticsChannelName: string;
  enabled: boolean;
}

// logistics_channel_id é obrigatório já na criação do item na Shopee — sem
// equivalente ao "not_specified" do Mercado Livre. `sugerido` vem
// pré-preenchido quando só existe 1 canal habilitado na loja.
export interface CanalLogisticaSugestao {
  canais: CanalLogisticaShopee[];
  sugerido: CanalLogisticaShopee | null;
}

// Snapshot de visitas/vendas/status de um anúncio publicado na Shopee — ver
// supabase/migration_045_shopee_publicacao.sql. Escrito em background pelo
// scheduler (Fase 7) e lido junto com o link, pro modal de detalhes abrir
// instantâneo sem chamar a Shopee na hora. Campos exatos ainda não
// confirmados contra a API real (mesma ressalva do backend).
export interface EstatisticasAnuncioShopee {
  link_id: string;
  visitas_total: number | null;
  vendas_totais: number | null;
  status_shopee: string | null;
  atualizado_em: string;
}
