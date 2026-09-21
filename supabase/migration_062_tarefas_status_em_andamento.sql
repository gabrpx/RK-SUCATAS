-- RK Sucatas — Migração 062: estado operacional de execução de tarefas
--
-- A alteração é aditiva: mantém as linhas pendentes/concluídas existentes e
-- permite que a nova tela persista o estado "em_andamento" ao iniciar o foco.
-- Aplicar somente depois de validar em homologação; esta migration não é
-- executada automaticamente pelo backend.

alter table tarefas
  drop constraint if exists tarefas_status_check;

alter table tarefas
  add constraint tarefas_status_check
  check (status = any (array['pendente'::text, 'em_andamento'::text, 'concluida'::text]));

create index if not exists idx_tarefas_status_prazo
  on tarefas(status, prazo);

notify pgrst, 'reload schema';
