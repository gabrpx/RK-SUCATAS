-- =============================================================================
-- RK Sucatas — Migração 012: Tarefas (mandados)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 011 aplicadas — depende da tabela usuarios).
--
-- Uma tarefa = um responsável. Se a mesma coisa precisa ser feita por duas
-- pessoas, cria-se uma tarefa pra cada uma — mantém claro quem deve dar baixa
-- em quê. Só quem tem papel 'admin'/'equipe' cria/atribui tarefas; só quem
-- tem papel 'mandados' (o atribuído) dá baixa na própria (ver
-- src/server/routes/tarefas.ts pras regras de autorização).
--
-- on delete restrict nas duas FKs: não deixa apagar um usuário que já tem
-- tarefas (criadas ou atribuídas) — desativa (usuarios.ativo=false) em vez
-- de excluir, preservando o histórico.
-- =============================================================================

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  prazo timestamptz,
  atribuido_para uuid not null references usuarios(id) on delete restrict,
  criado_por uuid not null references usuarios(id) on delete restrict,
  status text not null check (status in ('pendente', 'concluida')) default 'pendente',
  concluida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_tarefas_atribuido on tarefas(atribuido_para);
create index idx_tarefas_status on tarefas(status);

create trigger trg_tarefas_atualizado_em
  before update on tarefas
  for each row execute function set_atualizado_em();

alter table tarefas enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
