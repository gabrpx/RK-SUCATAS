-- =============================================================================
-- RK Sucatas — Migração 061: Imagens anexadas em tarefas
-- =============================================================================
-- Rode no editor SQL do Supabase DEPOIS de schema.sql + migrations 002..060.
--
-- Tabela NOVA, sem alterar `tarefas`. Sem limite de quantidade por tarefa na
-- aplicação — a única restrição é o bucket do Supabase Storage (mesmo bucket
-- de estoque.imagens, via uploadImagem() em storageService.ts / rota
-- POST /api/upload/imagem já existente).
-- =============================================================================

create table tarefa_imagens (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  url text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index idx_tarefa_imagens_tarefa on tarefa_imagens(tarefa_id);

alter table tarefa_imagens enable row level security;
-- sem policy de propósito: só o backend (service_role) acessa, igual ao resto.

NOTIFY pgrst, 'reload schema';
