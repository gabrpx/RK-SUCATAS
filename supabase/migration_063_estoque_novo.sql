-- =============================================================================
-- RK Sucatas — Migração 063: flag "novo" na peça de estoque (Fase 2A)
-- =============================================================================
-- Rode no editor SQL do Supabase (schema.sql + migrations 002 a 062).
--
-- Adiciona um atributo booleano à PEÇA (estoque) indicando se ela é nova
-- (não-usada). Alimenta o badge "Novo" do VarianteCard (T02), que na Fase 1
-- ficou sem dado real por trás — condicao_ml não serve, pois mora no vínculo
-- de anúncio do Mercado Livre, não na peça.
--
-- Marcação 100% manual pelo dono (mesma filosofia da organização por gavetas).
-- default false: toda peça existente permanece "usada" — coerente com o
-- negócio (sucata/usado é a regra; "Novo" é a exceção que o dono marca).
--
-- Degrada com segurança: sem esta coluna o backend simplesmente não devolve
-- o campo e o badge não aparece — nada quebra. Suba o código junto ou depois.
--
-- NÃO renumerar as migrations históricas. Numeração é 063 de propósito: as
-- 060 e 061 têm colisão dupla em produção (mover_unidade_estoque/gavetas vs
-- tarefa_participantes/tarefa_imagens), documentada em
-- docs/migrations-colisao-060-061.md. 063 é o primeiro número livre.
-- =============================================================================

alter table estoque add column if not exists novo boolean not null default false;

NOTIFY pgrst, 'reload schema';
