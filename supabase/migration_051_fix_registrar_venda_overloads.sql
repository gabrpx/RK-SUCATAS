-- =============================================================================
-- RK Sucatas — Migração 051: remove overloads duplicados de registrar_venda
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 050
-- aplicadas).
--
-- Causa raiz: registrar_venda foi recriada 4 vezes com assinaturas crescentes
-- (9, 10, 11 e 12 parâmetros) via CREATE OR REPLACE — no Postgres, quando a
-- assinatura muda, isso cria um overload em vez de substituir a função
-- anterior. Resultado: o banco tem 4 versões coexistindo, e chamadas com 11
-- parâmetros nomeados (aba Vendas, importação ML) são ambíguas entre a de 11
-- e a de 12 parâmetros (a 12ª tem default null).
--
-- Fix: derrubar as 3 assinaturas antigas (9, 10 e 11 parâmetros), mantendo
-- só a de 12 (migration_048), que já está correta e cobre todos os casos.
-- =============================================================================

-- 9 parâmetros (migration_009)
drop function if exists registrar_venda(uuid, int, numeric, uuid, uuid, text, text, date, text);

-- 10 parâmetros (migration_029 — adicionou p_cliente_id)
drop function if exists registrar_venda(uuid, int, numeric, uuid, uuid, text, text, date, text, uuid);

-- 11 parâmetros (migration_038 — adicionou p_unidade_id)
drop function if exists registrar_venda(uuid, int, numeric, uuid, uuid, text, text, date, text, uuid, uuid);

NOTIFY pgrst, 'reload schema';
