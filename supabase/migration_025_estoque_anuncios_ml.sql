-- =============================================================================
-- RK Sucatas — Migração 025: múltiplos anúncios do Mercado Livre por peça
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 024 aplicadas — inclusive as migrations 022, 023 e 024,
-- que ainda podem não ter rodado quando esta for aplicada).
--
-- Problema: `estoque.anuncio_ml_url` (migração 008) só guarda 1 link por
-- peça. Mas é comum a mesma peça estar anunciada mais de uma vez no Mercado
-- Livre (ex: anúncio antigo + anúncio novo, ou variações de kit) — hoje só
-- dá pra sincronizar o primeiro.
--
-- Solução: `estoque_anuncios_ml` guarda N anúncios por peça, mesma forma de
-- `estoque_unidades` (migração 014) — tabela filha com `estoque_id` e
-- `on delete cascade`.
--
-- `mlb_id` é extraído e PERSISTIDO no momento da escrita (POST/PATCH do
-- link, ver src/server/routes/estoque.ts), diferente de como
-- `anuncio_ml_url` funciona hoje (extraído em runtime a cada leitura via
-- extrairMlbId() em src/services/mercadolivreApi.ts). Precisa estar
-- persistido por dois motivos: sustenta o índice único abaixo (um mesmo
-- anúncio só pode estar vinculado a uma peça — sem isso não dá pra saber de
-- qual peça tirar o preço/estoque pra mandar pro mesmo anúncio) e evita
-- re-regexar centenas de URLs a cada consulta nas verificações de anúncio
-- órfão/duplicado.
--
-- IMPORTANTE — esta migração NÃO apaga `estoque.anuncio_ml_url`. A coluna
-- antiga fica sem uso pelo formulário a partir deste deploy (a edição do
-- link passa a ser só pelas rotas aninhadas /estoque/:id/anuncios-ml), mas
-- continua existindo com os dados que já tinha — a limpeza fica pra uma
-- migração futura, só depois de confirmar que esta aqui já rodou em
-- produção há um bom tempo. `anuncio_fb_url` não é tocada, fora do escopo.
--
-- ANTES DE RODAR EM PRODUÇÃO — auditar se já existe duplicidade (duas peças
-- apontando pro mesmo anúncio), porque o índice único abaixo não permitiria
-- isso e o INSERT de migração de dados descarta silenciosamente a segunda
-- ocorrência via ON CONFLICT DO NOTHING:
--
--   select anuncio_ml_url, count(*) from estoque
--   where anuncio_ml_url is not null group by 1 having count(*) > 1;
-- =============================================================================

create table estoque_anuncios_ml (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references estoque(id) on delete cascade,
  url text not null,
  mlb_id text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_estoque_anuncios_ml_estoque on estoque_anuncios_ml(estoque_id);

-- Um mesmo anúncio do Mercado Livre só pode estar vinculado a UMA peça por
-- vez — sem isso, sincronizar não saberia de qual peça tirar o preço/
-- estoque pra mandar pro mesmo mlbId.
create unique index idx_estoque_anuncios_ml_mlb_id on estoque_anuncios_ml(mlb_id);

create trigger trg_estoque_anuncios_ml_atualizado_em
  before update on estoque_anuncios_ml
  for each row execute function set_atualizado_em();

alter table estoque_anuncios_ml enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

-- Migra o link único que já existir em produção (migração 008). O regex
-- abaixo espelha MLB_ID_REGEX de src/services/mercadolivreApi.ts
-- (/MLB-?(\d{6,12})/i) só pra esta migração pontual — registros novos daqui
-- pra frente são sempre validados pelo código (extrairMlbId), não por SQL.
--
-- ON CONFLICT DO NOTHING: rede de segurança se duas peças já apontassem por
-- engano pro mesmo anúncio hoje — a primeira (por criado_em) fica, o resto
-- exige resolução manual depois. Preferível a migração inteira falhar no
-- meio por causa de um dado sujo isolado.
insert into estoque_anuncios_ml (estoque_id, url, mlb_id, criado_em, atualizado_em)
select
  id,
  anuncio_ml_url,
  upper('MLB' || substring(anuncio_ml_url from '(?i)MLB-?([0-9]{6,12})')),
  criado_em,
  atualizado_em
from estoque
where anuncio_ml_url is not null
  and anuncio_ml_url ~* 'MLB-?[0-9]{6,12}'
order by criado_em
on conflict (mlb_id) do nothing;

NOTIFY pgrst, 'reload schema';
