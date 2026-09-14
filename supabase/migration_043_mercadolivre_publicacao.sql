-- =============================================================================
-- RK Sucatas — Migração 043: publicar anúncios novos no Mercado Livre
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 042 aplicadas — inclusive as migrations 025 e 026, das
-- quais esta depende conceitualmente).
--
-- Problema: o sistema já LÊ o Mercado Livre (OAuth, sincroniza preço/estoque
-- de anúncios já existentes, importa pedidos, responde perguntas), mas todo
-- anúncio precisa nascer no site do Mercado Livre e depois ter o link colado
-- em `estoque_anuncios_ml` (migração 025). Falta a ponta que cria o anúncio
-- (POST /items da API do ML) direto do catálogo, com suporte a variações
-- (peça-mãe + fichas de `estoque_unidades`, migração 014) e a estatísticas
-- do anúncio aparecendo instantâneas no modal de detalhes.
--
-- Solução, em 4 partes:
--
-- 1) `estoque_anuncios_ml` ganha colunas que só existem quando o anúncio foi
--    CRIADO pelo sistema (não só colado) — guardam a configuração usada na
--    publicação, pra reabrir o formulário de edição sem reperguntar tudo, e
--    pra permitir republicar/atualizar depois. `publicado_via_sistema` é o
--    discriminador: `false` (default) cobre todo o histórico de links
--    colados manualmente até hoje, sem exigir backfill.
--
-- 2) `estoque_anuncios_ml_variacoes` liga cada variação criada no Mercado
--    Livre (`variations[].id` da resposta do POST /items) à ficha de
--    unidade (`estoque_unidades`) que a originou — permite atualizar
--    preço/estoque de UMA variação específica depois (republicar), e
--    permite reconstruir o payload de PUT sem perder combinações.
--    `unidade_id` é nullable com `on delete set null` porque a ficha pode
--    ser apagada no futuro sem que isso deva apagar o histórico do que foi
--    publicado no Mercado Livre — só perde o vínculo de origem.
--
-- 3) `estoque_anuncios_ml_estatisticas` é o snapshot de visitas/perguntas/
--    vendas/saúde do anúncio, atualizado em background por um scheduler
--    (companheiro de `mercadolivreScheduler.ts`). É o que o modal de
--    detalhes lê — nunca chama o Mercado Livre no momento em que abre, só
--    usa o que já está pronto no banco.
--
-- 4) `mercadolivre_categorias_cache` evita ida-e-volta na API do Mercado
--    Livre a cada tecla digitada no formulário de publicação (categoria +
--    atributos mudam raramente). TTL controlado na aplicação (reconsultar
--    se `atualizado_em` estiver velho — ex: mais de 7 dias), não em SQL.
--
--    `categorias.mercadolivre_categoria_id_padrao` memoriza qual categoria
--    do Mercado Livre costuma ser usada por categoria INTERNA — pré-
--    preenche a sugestão nas próximas peças da mesma categoria, reduzindo
--    fricção sem esconder a possibilidade de trocar manualmente. É uma
--    sugestão, não uma trava: categoria do Mercado Livre é vocabulário
--    DIFERENTE da árvore de `categorias` já existente, nunca 1:1 automático
--    e permanente.
-- =============================================================================

alter table estoque_anuncios_ml add column publicado_via_sistema boolean not null default false;
alter table estoque_anuncios_ml add column ml_category_id text;
alter table estoque_anuncios_ml add column listing_type_id text;
alter table estoque_anuncios_ml add column condicao_ml text check (condicao_ml in ('new', 'used'));
alter table estoque_anuncios_ml add column status_ml text;
alter table estoque_anuncios_ml add column atributos_ml jsonb;
alter table estoque_anuncios_ml add column publicado_em timestamptz;

create table estoque_anuncios_ml_variacoes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references estoque_anuncios_ml(id) on delete cascade,
  unidade_id uuid references estoque_unidades(id) on delete set null,
  ml_variation_id text not null,
  preco numeric(10,2),
  quantidade integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_estoque_anuncios_ml_variacoes_link on estoque_anuncios_ml_variacoes(link_id);

-- Uma variação do Mercado Livre pertence a um único anúncio — mesmo espírito
-- do índice único de mlb_id em estoque_anuncios_ml (migração 025).
create unique index idx_estoque_anuncios_ml_variacoes_ml_id on estoque_anuncios_ml_variacoes(ml_variation_id);

create trigger trg_estoque_anuncios_ml_variacoes_atualizado_em
  before update on estoque_anuncios_ml_variacoes
  for each row execute function set_atualizado_em();

alter table estoque_anuncios_ml_variacoes enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table estoque_anuncios_ml_estatisticas (
  link_id uuid primary key references estoque_anuncios_ml(id) on delete cascade,
  visitas_total integer,
  visitas_ultimos_15_dias integer,
  perguntas_abertas integer not null default 0,
  vendas_totais integer,
  saude_anuncio numeric(5,2),
  status_ml text,
  atualizado_em timestamptz not null default now()
);

create trigger trg_estoque_anuncios_ml_estatisticas_atualizado_em
  before update on estoque_anuncios_ml_estatisticas
  for each row execute function set_atualizado_em();

alter table estoque_anuncios_ml_estatisticas enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table mercadolivre_categorias_cache (
  categoria_ml_id text primary key,
  nome_ml text not null,
  caminho text,
  atributos jsonb not null,
  listing_types jsonb,
  atualizado_em timestamptz not null default now()
);

alter table mercadolivre_categorias_cache enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

alter table categorias add column mercadolivre_categoria_id_padrao text;

NOTIFY pgrst, 'reload schema';
