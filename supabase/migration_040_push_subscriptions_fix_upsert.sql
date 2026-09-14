-- =============================================================================
-- RK Sucatas — Migração 040: corrige índices únicos de push_subscriptions
-- =============================================================================
-- Rode isso no editor SQL do Supabase (depende da migration_039 já aplicada).
--
-- Problema: os índices únicos de endpoint/fcm_token criados na migration_039
-- são PARCIAIS (`where endpoint is not null` / `where fcm_token is not
-- null`). O Postgres não aceita um índice parcial como "arbiter" de um
-- `ON CONFLICT (coluna)` simples — que é exatamente o que
-- `.upsert(dados, { onConflict: 'endpoint' })` (ou 'fcm_token') gera em
-- src/server/routes/notificacoes.ts. Resultado: toda tentativa de ativar
-- notificação falhava com "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification".
--
-- Troca pros mesmos índices sem o WHERE — um índice único comum já permite
-- várias linhas com NULL na coluna (Postgres nunca trata NULL = NULL), então
-- o comportamento desejado (várias subscriptions 'fcm' com endpoint nulo, e
-- vice-versa) continua igual, só passa a funcionar como arbiter do upsert.
-- =============================================================================

drop index if exists idx_push_subscriptions_endpoint;
drop index if exists idx_push_subscriptions_fcm_token;

create unique index if not exists idx_push_subscriptions_endpoint on push_subscriptions(endpoint);
create unique index if not exists idx_push_subscriptions_fcm_token on push_subscriptions(fcm_token);

NOTIFY pgrst, 'reload schema';
