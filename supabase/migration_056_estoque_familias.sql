-- =============================================================================
-- RK Sucatas — Migração 056: famílias de peça
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 055).
--
-- Problema: hoje cada combinação peça+modelo de moto é uma linha
-- independente em `estoque` — "Tanque de Combustível CG 125 Titan 99",
-- "... Today", "... CG 125 Fan" são 3 fichas sem relação estrutural
-- nenhuma além do nome parecido. Ver
-- docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md.
--
-- Solução: `estoque_familias` agrupa N fichas (`estoque`) sob um nome comum
-- ("Tanque de Combustível CG 125"), cada ficha mantendo seu próprio
-- modelo_moto_id — é isso que forma os grupos por modelo/ano dentro do
-- futuro modal de família. `estoque.familia_id` é opcional: peça sem
-- família continua se comportando exatamente como hoje (linha própria na
-- tabela, sem nenhum agrupamento).
--
-- Fusão das duplicatas já cadastradas é sempre assistida (sugestão +
-- confirmação manual) — nunca automática. Essa tela vem num plano à parte.
-- =============================================================================

create table estoque_familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid references categorias(id),
  descricao text,
  imagem_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_estoque_familias_atualizado_em
  before update on estoque_familias
  for each row execute function set_atualizado_em();

alter table estoque_familias enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

alter table estoque add column if not exists familia_id uuid references estoque_familias(id);
create index if not exists idx_estoque_familia on estoque(familia_id);

NOTIFY pgrst, 'reload schema';
