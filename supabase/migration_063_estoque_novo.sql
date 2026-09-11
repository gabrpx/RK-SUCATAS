-- =============================================================================
-- RK Sucatas — Migração 063: flag "novo" na peça de estoque (Fase 2A)
-- =============================================================================
-- Rode no editor SQL do Supabase (schema.sql + as migrations históricas 002+;
-- não existe migration 062 — a sequência vai de 061 direto para 063).
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
-- ATENÇÃO — PRÉ-REQUISITO OBRIGATÓRIO DO DEPLOY (rode ANTES de subir o código):
-- só a LEITURA degrada bem (sem a coluna, o GET apenas não devolve `novo`). A
-- ESCRITA NÃO: o formulário de peça sempre envia `novo` (booleano) e
-- montarPayload() sempre o inclui no INSERT/UPDATE, então criar ou editar peça
-- FALHA com "column novo does not exist" enquanto esta migration não rodar.
--
-- NÃO renumerar as migrations históricas. Numeração é 063 de propósito: as
-- 060 e 061 têm colisão dupla em produção (mover_unidade_estoque/gavetas vs
-- tarefa_participantes/tarefa_imagens), documentada em
-- docs/migrations-colisao-060-061.md. O número 062 foi pulado; 063 é o próximo.
-- =============================================================================

alter table estoque add column if not exists novo boolean not null default false;

NOTIFY pgrst, 'reload schema';
