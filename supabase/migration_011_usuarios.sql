-- =============================================================================
-- RK Sucatas — Migração 011: Usuários (login individual + papéis)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 010 aplicadas).
--
-- Substitui a senha única (ADMIN_PASSWORD) por login individual: cada pessoa
-- tem seu próprio username/senha e um papel fixo que define o que ela vê no
-- sistema (ver middleware/auth.ts e server.ts para o restante da migração de
-- autenticação).
--
-- role:
--   admin           — acesso total, único que gerencia usuários (Ayrton)
--   equipe          — todas as abas operacionais, exceto gestão de usuários (Ryan, PC)
--   estoque_leitura — só visualiza Estoque, sem criar/editar/excluir (Eloisa)
--   mandados        — só vê a aba Tarefas, recebe e dá baixa nas suas (Itinho, Pitoco)
--
-- ativo: desativação lógica, nunca delete — tarefas referenciam usuários e
-- precisam manter o histórico mesmo depois que alguém sai da equipe.
--
-- push_token: token de dispositivo (FCM) pra notificação push das tarefas.
-- Coluna já entra aqui (nullable, sem uso ainda) pra não precisar migrar de
-- novo quando o push for ligado.
-- =============================================================================

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  nome_exibicao text not null,
  senha_hash text not null,
  role text not null check (role in ('admin', 'equipe', 'estoque_leitura', 'mandados')),
  ativo boolean not null default true,
  push_token text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_usuarios_ativo on usuarios(ativo);

create trigger trg_usuarios_atualizado_em
  before update on usuarios
  for each row execute function set_atualizado_em();

alter table usuarios enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
