-- =============================================================================
-- RK Sucatas — Migração 053: vincular cliente a pendência manual
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 052).
--
-- Pendências manuais (caixa_pendencias, migration_041) não tinham cliente
-- vinculado — agora aceitam um cliente_id opcional, igual vendas.cliente_id.

alter table caixa_pendencias
  add column if not exists cliente_id uuid references clientes(id) on delete set null;

NOTIFY pgrst, 'reload schema';
