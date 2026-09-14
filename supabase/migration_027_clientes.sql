-- =============================================================================
-- RK Sucatas — Migração 027: Clientes
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 026 aplicadas — depende da tabela usuarios).
--
-- Migração isolada: só cria tabelas novas, não toca em vendas/orcamentos/
-- tarefas (isso vem na migration_028). Pode rodar e testar sozinha.
--
-- clientes_notas é uma timeline (append-only, com autor e data) — diferente
-- de clientes.observacoes, que é uma nota fixada única (ex: "só liga depois
-- das 18h"). Um `text` só não serve pra timeline porque perde data por
-- entrada e a edição sobrescreve o histórico.
--
-- on delete restrict em clientes_notas.criado_por: mesma convenção de
-- tarefas.criado_por — não deixa apagar um usuário que já escreveu nota,
-- desativa (usuarios.ativo=false) em vez de excluir, preservando o histórico
-- e a autoria de cada entrada.
-- =============================================================================

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  documento text,
  data_nascimento date,
  origem text check (origem in ('balcao', 'indicacao', 'mercado_livre', 'redes_sociais', 'outro')),
  preferencia_contato text check (preferencia_contato in ('whatsapp', 'ligacao', 'sms', 'nenhuma')),
  tags text[] not null default '{}',
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_clientes_nome on clientes(nome);
-- Parcial: bloqueia duplicidade só entre cadastros com o MESMO documento
-- preenchido — não afeta os clientes sem documento (maioria esperada).
create unique index idx_clientes_documento on clientes(documento) where documento is not null;
create index idx_clientes_tags on clientes using gin(tags);

create trigger trg_clientes_atualizado_em
  before update on clientes
  for each row execute function set_atualizado_em();

alter table clientes enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table clientes_notas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  texto text not null,
  criado_por uuid references usuarios(id) on delete restrict,
  criado_em timestamptz not null default now()
);

create index idx_clientes_notas_cliente on clientes_notas(cliente_id);

alter table clientes_notas enable row level security;

NOTIFY pgrst, 'reload schema';
