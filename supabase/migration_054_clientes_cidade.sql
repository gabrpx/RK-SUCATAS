-- =============================================================================
-- RK Sucatas — Migração 054: campo cidade no cliente
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 053).

alter table clientes add column if not exists cidade text;

NOTIFY pgrst, 'reload schema';
