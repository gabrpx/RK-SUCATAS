-- =============================================================================
-- RK Sucatas — Migração 016: múltiplas fotos por peça (capa)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 015 aplicadas).
--
-- Até aqui `estoque.imagem_url` guardava uma única foto de capa por peça.
-- A loja quer poder anexar várias fotos do mesmo item (ângulos diferentes,
-- estado geral) — não só das unidades avariadas (migration_014, que já é
-- array). Substitui a coluna única por um array ordenado: a primeira foto é
-- a capa mostrada nas listagens; as demais só aparecem ao abrir o item.
--
-- Mesmo formato (jsonb array de URLs do Storage) já usado em
-- estoque_unidades.fotos, pra reaproveitar exatamente a mesma lógica de
-- upload/remoção incremental no frontend e no backend.
-- =============================================================================

alter table estoque add column imagens jsonb not null default '[]'::jsonb;

update estoque
set imagens = jsonb_build_array(imagem_url)
where imagem_url is not null and imagem_url <> '';

alter table estoque drop column imagem_url;

NOTIFY pgrst, 'reload schema';
