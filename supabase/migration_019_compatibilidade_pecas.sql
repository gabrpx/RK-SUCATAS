-- =============================================================================
-- RK Sucatas — Migração 019: compatibilidade de peça com múltiplos modelos
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 018 aplicadas).
--
-- Problema: uma lanterna traseira da CG 150 carburada 2004-2008 é a MESMA
-- peça física que serve na CG 125 Fan 2009-2013 — mas `estoque.modelo_moto_id`
-- só aponta pra um nó da árvore `modelos_moto` (migration_004). A árvore já
-- resolve compatibilidade VERTICAL (peça em "CG 150" cobre também as
-- variações abaixo dela, tipo Carburada/Mix/Injetada), mas CG 150 e CG 125
-- Fan são ramos diferentes (cilindradas diferentes) sem esse parentesco —
-- não tem como resolver só com a árvore.
--
-- Solução: `estoque_modelos_compativeis` guarda modelos SECUNDÁRIOS de uma
-- peça, além do principal (que continua em `estoque.modelo_moto_id`). Uma
-- peça sem nenhuma linha aqui se comporta exatamente como hoje.
--
-- `on delete restrict` em modelo_moto_id espelha o mesmo comportamento já
-- existente de estoque.modelo_moto_id/vendas.modelo_moto_id: não dá pra
-- apagar um modelo que ainda está em uso (ver checagem em
-- src/server/routes/modelosMoto.ts DELETE /:id).
-- =============================================================================

create table estoque_modelos_compativeis (
  estoque_id uuid not null references estoque(id) on delete cascade,
  modelo_moto_id uuid not null references modelos_moto(id) on delete restrict,
  criado_em timestamptz not null default now(),
  primary key (estoque_id, modelo_moto_id)
);

create index idx_estoque_modelos_compativeis_modelo on estoque_modelos_compativeis(modelo_moto_id);

alter table estoque_modelos_compativeis enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
