-- =============================================================================
-- RK Sucatas — Migração 042: Lembretes (sub-aba dentro de Tarefas)
-- =============================================================================
-- Rode isso no editor SQL do Supabase, DEPOIS de schema.sql + migrations
-- 002 a 041 aplicadas (usa a tabela usuarios e a trigger set_atualizado_em).
--
-- Diferente de notificacoesScheduler.ts (varredura agregada 1x/dia, sem
-- granularidade por registro, usando uma variável em memória que reseta a
-- cada deploy/restart — aceitável só pro caso de uso dele), Lembretes
-- precisa de precisão de minutos e sobreviver a restart/hibernação do
-- Render free tier. Por isso o "próximo disparo" é persistido em
-- proxima_notificacao_em, não guardado em memória.
--
-- Disparo único (intervalo_minutos is null): depois de disparar,
-- proxima_notificacao_em vira null (não dispara de novo sozinho), mas o
-- lembrete continua 'pendente'/visível até o usuário concluir manualmente.
-- Disparo recorrente: depois de disparar, proxima_notificacao_em vira
-- now() + intervalo_minutos (continua disparando até status='concluido').
-- Editar o intervalo/horário recalcula proxima_notificacao_em a partir de
-- AGORA (ver src/server/routes/lembretes.ts) — nunca a partir do valor antigo.
-- =============================================================================

create table lembretes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  atribuido_para uuid not null references usuarios(id) on delete restrict,
  criado_por uuid not null references usuarios(id) on delete restrict,
  status text not null check (status in ('pendente', 'concluido')) default 'pendente',
  -- null = disparo único (horário fixo); not null = recorrente a cada N min.
  intervalo_minutos integer check (intervalo_minutos is null or intervalo_minutos >= 5),
  proxima_notificacao_em timestamptz,
  ultima_notificacao_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_lembretes_atribuido on lembretes(atribuido_para);
create index idx_lembretes_criado_por on lembretes(criado_por);
-- Parcial: cobre exatamente a query do scheduler (só pendentes com próximo
-- disparo definido) sem indexar o resto da tabela à toa.
create index idx_lembretes_disparo on lembretes(proxima_notificacao_em)
  where status = 'pendente' and proxima_notificacao_em is not null;

create trigger trg_lembretes_atualizado_em
  before update on lembretes
  for each row execute function set_atualizado_em();

alter table lembretes enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

-- Claim atômico dos lembretes devidos: um único UPDATE...WHERE...RETURNING
-- com `for update skip locked` no subselect evita duplicar disparo se por
-- acaso rodar mais de um processo Node ao mesmo tempo (não é o caso do
-- Render free tier hoje, mas sai de graça desenhar assim). Recalcula
-- proxima_notificacao_em por linha, de acordo com intervalo_minutos de cada
-- lembrete — não dá pra fazer isso com um simples .update() do
-- supabase-js (que só aceita valores fixos, não expressão por coluna), por
-- isso vira RPC.
create or replace function disparar_lembretes_devidos()
returns setof lembretes as $$
begin
  return query
  update lembretes
  set
    ultima_notificacao_em = now(),
    proxima_notificacao_em = case
      when intervalo_minutos is not null then now() + (intervalo_minutos || ' minutes')::interval
      else null
    end
  where id in (
    select id from lembretes
    where status = 'pendente'
      and proxima_notificacao_em is not null
      and proxima_notificacao_em <= now()
    for update skip locked
  )
  returning *;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
