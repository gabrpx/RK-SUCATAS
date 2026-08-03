-- =============================================================================
-- RK Sucatas — Migração 017: nota de condição da peça (1 a 10)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 016 aplicadas).
--
-- `estoque.condicao` (original/paralela) já existia, mas é sobre ORIGEM da
-- peça, não sobre o ESTADO físico dela. Este campo novo é independente: uma
-- peça original pode estar em condição 4/10 (bem desgastada) e uma paralela
-- pode estar em 10/10 (nova, na caixa). Nullable — nem toda peça precisa de
-- avaliação (ex: itens novos/lacrados, onde a nota não diz muita coisa).
-- =============================================================================

alter table estoque add column condicao_nota smallint check (condicao_nota between 1 and 10);

NOTIFY pgrst, 'reload schema';
