-- =============================================================================
-- RK Sucatas — Migração 046: Checklist de tarefas (tarefa_itens)
-- =============================================================================
-- Rode no editor SQL do Supabase DEPOIS de schema.sql + migrations 002..045.
-- Adiciona checkboxes dentro de uma tarefa. A tarefa passa a poder existir só
-- como uma lista de itens (título opcional) — a regra "título OU >=1 item" e a
-- derivação do status a partir dos itens ficam no backend (src/server/routes/
-- tarefas.ts), não no banco.
-- =============================================================================

create table tarefa_itens (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  texto text not null,
  concluido boolean not null default false,
  ordem integer not null default 0,
  concluido_em timestamptz,
  concluido_por uuid references usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index idx_tarefa_itens_tarefa on tarefa_itens(tarefa_id);

alter table tarefa_itens enable row level security;
-- sem policy de propósito: só o backend (service_role) acessa, igual ao resto.

-- Título deixa de ser obrigatório: uma tarefa pode ser só uma lista de itens.
alter table tarefas alter column titulo drop not null;

NOTIFY pgrst, 'reload schema';
