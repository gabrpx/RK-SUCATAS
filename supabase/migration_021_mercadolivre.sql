-- =============================================================================
-- RK Sucatas — Migração 021: conexão com a API do Mercado Livre
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 020 aplicadas).
--
-- Guarda o access_token/refresh_token da conta do Mercado Livre da loja,
-- depois do login OAuth (ver src/server/routes/mercadolivre.ts). Só uma
-- linha é esperada — é uma conta só, a da própria loja, não por usuário do
-- sistema — mas `ml_user_id` é único pra o upsert do refresh de token nunca
-- duplicar linha por engano.
-- =============================================================================

create table mercadolivre_conexao (
  id uuid primary key default gen_random_uuid(),
  ml_user_id text not null unique,
  access_token text not null,
  refresh_token text not null,
  expira_em timestamptz not null,
  atualizado_em timestamptz not null default now()
);

-- Mesmo padrão do resto do schema (ver schema.sql): RLS ligado sem policy —
-- só a service role key (usada pelo backend) acessa a tabela. Os tokens
-- nunca passam pelo frontend.
alter table mercadolivre_conexao enable row level security;

NOTIFY pgrst, 'reload schema';
