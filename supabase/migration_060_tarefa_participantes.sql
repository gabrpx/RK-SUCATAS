-- =============================================================================
-- RK Sucatas — Migração 060: Tarefas com múltiplos participantes
-- =============================================================================
-- Rode no editor SQL do Supabase DEPOIS de schema.sql + migrations 002..059.
--
-- Tabela NOVA (não altera `tarefas` nem sua constraint de status) — o estado
-- "aguardando aprovação" (todos os participantes marcaram, falta o criador
-- finalizar) é DERIVADO em runtime (participantes.concluido todos true) e
-- nunca persistido em tarefas.status, que continua só 'pendente'/'concluida'
-- exatamente como antes. Tarefas antigas (sem nenhuma linha aqui) continuam
-- usando só tarefas.atribuido_para, sem nenhuma mudança de comportamento.
--
-- `usuario_id` usa ON DELETE CASCADE (diferente de tarefa_itens.concluido_por,
-- que é ON DELETE SET NULL): aqui a linha É a participação da pessoa na
-- tarefa, não só um registro de "quem marcou" — sem a pessoa, a linha perde o
-- sentido. usuarios.ts (reatribuição ao desativar/excluir usuário) não foi
-- tocado de propósito (fora do escopo desta migração).
-- =============================================================================

create table tarefa_participantes (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  concluido boolean not null default false,
  concluido_em timestamptz,
  -- Fase 2 (borda animada): true quando o participante já abriu os detalhes
  -- da tarefa pelo menos uma vez.
  lida boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (tarefa_id, usuario_id)
);

create index idx_tarefa_participantes_tarefa on tarefa_participantes(tarefa_id);
create index idx_tarefa_participantes_usuario on tarefa_participantes(usuario_id);

alter table tarefa_participantes enable row level security;
-- sem policy de propósito: só o backend (service_role) acessa, igual ao resto.

NOTIFY pgrst, 'reload schema';
