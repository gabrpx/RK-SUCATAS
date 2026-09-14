-- =============================================================================
-- RK Sucatas — Migração 008: links de anúncio (Mercado Livre / Facebook) por peça
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 007 aplicadas). Usado pela coluna "Anúncios" da tela de
-- Estoque, que mostra um badge clicável por canal quando o link existe.
-- =============================================================================

alter table estoque add column anuncio_ml_url text;
alter table estoque add column anuncio_fb_url text;

NOTIFY pgrst, 'reload schema';
