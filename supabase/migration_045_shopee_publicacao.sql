-- =============================================================================
-- RK Sucatas — Migração 045: publicar anúncios na Shopee (2º canal)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 044 aplicadas).
--
-- Contexto: o sistema já publica peças do estoque no Mercado Livre
-- (migrations 021, 025, 026, 043). Esta migração adiciona a Shopee como um
-- SEGUNDO canal de publicação, em tabelas próprias e paralelas — nenhuma
-- tabela do Mercado Livre é alterada aqui.
--
-- Decisão de arquitetura (já fechada com o usuário, ver
-- docs/proposta-publicacao-shopee.md): tabela ESPECÍFICA por canal
-- (estoque_anuncios_shopee), não uma tabela genérica de marketplace com
-- coluna de canal — evita mexer no índice único/RLS/código de
-- estoque_anuncios_ml.
--
-- A "peça-mãe com itens-filho/variantes" que precisa mapear pra Shopee é a
-- MESMA que já existe no schema pro Mercado Livre: `estoque` (a peça) +
-- `estoque_unidades` (migração 014 — fichas de unidade física). Não existe
-- um conceito novo de variante aqui — estoque_unidades mapeia pro "model"
-- (tier_variation) da Shopee.
--
-- Diferenças de modelagem em relação ao Mercado Livre, todas propositais:
--
-- 1) `shopee_conexao.margem_sincronizacao_percentual` é uma coluna PRÓPRIA,
--    separada de `mercadolivre_conexao.margem_sincronizacao_percentual`
--    (migração 026) — canais diferentes podem ter margens diferentes.
--    partner_id/partner_key NÃO entram nesta tabela: são credenciais do
--    aplicativo (não da loja) e vivem em variável de ambiente
--    (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY).
--
-- 2) `estoque_anuncios_shopee` usa índice único COMPOSTO em (shop_id,
--    item_id) — diferente do `mlb_id` de `estoque_anuncios_ml` (migração
--    025), que é único globalmente. Na Shopee, item_id só é único DENTRO de
--    um shop_id.
--
-- 3) `estoque_anuncios_shopee_estatisticas` começa com um conjunto mínimo de
--    campos (visitas_total, vendas_totais, status_shopee) — os campos exatos
--    ainda não foram confirmados contra a API de estatísticas real da
--    Shopee; serão ajustados na FASE 7 da implementação se necessário.
--
-- 4) `shopee_categorias_cache` e `categorias.shopee_categoria_id_padrao`
--    espelham `mercadolivre_categorias_cache` / `mercadolivre_categoria_id_
--    padrao` (migração 043), mas são vocabulário de categoria DIFERENTE —
--    nunca sincronizados automaticamente entre si.
--
-- Todas as tabelas novas: RLS ligado sem policy (só service_role acessa),
-- igual ao resto do schema.
-- =============================================================================

create table shopee_conexao (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null unique,
  access_token text not null,
  refresh_token text not null,
  expira_em timestamptz not null,
  margem_sincronizacao_percentual numeric(5,2) not null default 30
    check (margem_sincronizacao_percentual >= 0),
  atualizado_em timestamptz not null default now()
);

create trigger trg_shopee_conexao_atualizado_em
  before update on shopee_conexao
  for each row execute function set_atualizado_em();

alter table shopee_conexao enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table estoque_anuncios_shopee (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references estoque(id) on delete cascade,
  shop_id text not null,
  item_id text not null,
  url text,
  category_id text,
  status_shopee text,
  atributos_shopee jsonb,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_estoque_anuncios_shopee_estoque on estoque_anuncios_shopee(estoque_id);

-- item_id da Shopee só é único DENTRO de um shop_id, não globalmente —
-- diferente do mlb_id do Mercado Livre (migração 025).
create unique index idx_estoque_anuncios_shopee_shop_item on estoque_anuncios_shopee(shop_id, item_id);

create trigger trg_estoque_anuncios_shopee_atualizado_em
  before update on estoque_anuncios_shopee
  for each row execute function set_atualizado_em();

alter table estoque_anuncios_shopee enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table estoque_anuncios_shopee_variacoes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references estoque_anuncios_shopee(id) on delete cascade,
  unidade_id uuid references estoque_unidades(id) on delete set null,
  model_id text not null,
  preco numeric(10,2),
  quantidade integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_estoque_anuncios_shopee_variacoes_link on estoque_anuncios_shopee_variacoes(link_id);

create trigger trg_estoque_anuncios_shopee_variacoes_atualizado_em
  before update on estoque_anuncios_shopee_variacoes
  for each row execute function set_atualizado_em();

alter table estoque_anuncios_shopee_variacoes enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table estoque_anuncios_shopee_estatisticas (
  link_id uuid primary key references estoque_anuncios_shopee(id) on delete cascade,
  visitas_total integer,
  vendas_totais integer,
  status_shopee text,
  atualizado_em timestamptz not null default now()
);

create trigger trg_estoque_anuncios_shopee_estatisticas_atualizado_em
  before update on estoque_anuncios_shopee_estatisticas
  for each row execute function set_atualizado_em();

alter table estoque_anuncios_shopee_estatisticas enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table shopee_categorias_cache (
  categoria_shopee_id text primary key,
  nome_shopee text not null,
  caminho text,
  atributos jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table shopee_categorias_cache enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

alter table categorias add column shopee_categoria_id_padrao text;

NOTIFY pgrst, 'reload schema';
