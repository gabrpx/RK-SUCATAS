-- =============================================================================
-- RK Sucatas — Migração 031: fiado_baixas
-- =============================================================================
-- Rode isso no editor SQL do Supabase, depois da migration_030 (depende da
-- coluna formas_pagamento.natureza pra fazer sentido, embora não tenha FK
-- direta pra ela) e de vendas/usuarios (schema.sql).
--
-- Migração isolada: só cria uma tabela nova, não toca em vendas/caixa nem na
-- função registrar_venda — decisão explícita do dono da loja de que "fiado"
-- na Fase 2 é só acompanhamento/cobrança em cima do que já existe, nunca uma
-- reescrita de como o dinheiro é lançado. Uma linha em fiado_baixas = uma
-- venda fiado marcada como "já foi acertada" pra sair da lista de em aberto;
-- isso é só um marcador informativo, não gera nenhum lançamento novo no caixa.
-- =============================================================================

create table fiado_baixas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null unique references vendas(id) on delete cascade,
  quitado_por uuid not null references usuarios(id) on delete restrict,
  quitado_em timestamptz not null default now(),
  observacao text
);

create index idx_fiado_baixas_venda on fiado_baixas(venda_id);

alter table fiado_baixas enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
