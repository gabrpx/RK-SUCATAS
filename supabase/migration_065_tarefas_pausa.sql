-- Pausa operacional é ortogonal ao status de conclusão existente.
-- Não alteramos tarefas.status, que continua restrito a pendente/concluida.
alter table public.tarefas
  add column if not exists pausada boolean not null default false,
  add column if not exists pausada_em timestamptz,
  add column if not exists pausada_por uuid references public.usuarios(id) on delete set null,
  add column if not exists pausa_motivo text;

alter table public.tarefas
  add constraint tarefas_pausa_motivo_consistente check (
    (pausada = false and pausada_em is null and pausada_por is null and pausa_motivo is null)
    or
    (pausada = true and length(trim(coalesce(pausa_motivo, ''))) > 0)
  );

create index if not exists tarefas_pausadas_idx
  on public.tarefas (pausada, atualizado_em desc);
