-- =============================================================================
-- RK Sucatas — Migração 039: push_subscriptions (notificações push reais)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (depende de usuarios da migration_011 —
-- schema.sql + migrations 002 a 038 aplicadas).
--
-- Problema: usuarios.push_token (migration_011) foi pensado só pra um token
-- FCM simples, 1 por usuário — sobrescreveria o token do desktop se a mesma
-- pessoa também ativasse no celular, e não serve pro formato de uma Web Push
-- subscription (que é um objeto {endpoint, keys:{p256dh,auth}}, não uma
-- string). Essa coluna fica intocada (nunca teve dado escrito) — a tabela
-- abaixo é quem passa a guardar as inscrições de push de verdade, uma linha
-- por dispositivo/navegador, suportando N por usuário.
--
-- 'fcm' (Android via Firebase Cloud Messaging) já entra no check de `tipo`
-- pra não precisar migrar de novo quando o app Android ganhar push nativo,
-- mas só o branch 'web' é usado por enquanto.
-- =============================================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('web', 'fcm')),
  endpoint text,
  p256dh text,
  auth_key text,
  fcm_token text,
  user_agent text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint push_subscriptions_formato_valido check (
    (tipo = 'web' and endpoint is not null and p256dh is not null and auth_key is not null and fcm_token is null)
    or
    (tipo = 'fcm' and fcm_token is not null and endpoint is null)
  )
);

create unique index if not exists idx_push_subscriptions_endpoint on push_subscriptions(endpoint) where endpoint is not null;
create unique index if not exists idx_push_subscriptions_fcm_token on push_subscriptions(fcm_token) where fcm_token is not null;
create index if not exists idx_push_subscriptions_usuario_ativo on push_subscriptions(usuario_id) where ativo;

-- Reaproveita a função genérica já criada em schema.sql (mesma usada por
-- trg_estoque_atualizado_em) — não recria a função, só o trigger nesta tabela.
create trigger trg_push_subscriptions_atualizado_em
  before update on push_subscriptions
  for each row execute function set_atualizado_em();

alter table push_subscriptions enable row level security;
-- Sem policy de propósito, mesmo padrão do resto do schema: só o backend
-- (service_role) acessa essa tabela, nunca o client direto.

NOTIFY pgrst, 'reload schema';
