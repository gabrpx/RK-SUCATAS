-- =============================================================================
-- RK Sucatas — Migração 023: log de notificações do Mercado Livre
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 022 aplicadas).
--
-- Sinal auxiliar de "chegou uma notificação" (webhook do ML ou polling de
-- fallback) — nunca é a fonte de verdade: pergunta/pedido continuam sendo
-- buscados ao vivo na API do ML quando alguém abre a tela (uma pergunta pode
-- ser respondida direto no app do Mercado Livre, e este log nunca saberia).
-- Serve só pra alimentar um indicador leve de "houve atividade recente" sem
-- precisar bater na API do ML a cada abertura de aba. Por ser só um sinal
-- auxiliar (não a fonte de verdade), esta tabela é gracefully-degradável —
-- mesmo padrão de estoque_unidades/promocoes: se a migration ainda não rodou,
-- o indicador de pendências simplesmente fica sem o "houve atividade agora",
-- sem derrubar nada.
-- =============================================================================

create table mercadolivre_notificacoes (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  resource text not null,
  ml_user_id text,
  origem text not null default 'webhook' check (origem in ('webhook', 'polling')),
  recebido_em timestamptz not null default now()
);

-- Webhook e polling podem ver o mesmo evento — só 1 linha por (topic, resource).
create unique index idx_mercadolivre_notificacoes_dedup on mercadolivre_notificacoes(topic, resource);
create index idx_mercadolivre_notificacoes_recebido on mercadolivre_notificacoes(recebido_em desc);

alter table mercadolivre_notificacoes enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
