-- =============================================================================
-- RK Sucatas — Migração 052: RPC para disparar cobranças devidas
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 051
-- aplicadas — depende da tabela cobrancas da migration_049).
--
-- Mesmo molde de disparar_lembretes_devidos (migration_042): claim atômico
-- via UPDATE...WHERE...RETURNING com for update skip locked, avança
-- proxima_notificacao_em para cobranças recorrentes, zera para horário fixo.
-- Diferente de lembretes, cobrança não tem atribuido_para (é da equipe toda),
-- então a RPC só devolve as linhas devidas — o scheduler notifica toda a
-- equipe via buscarDestinatariosEquipe.
-- =============================================================================

create or replace function disparar_cobrancas_devidas()
returns setof cobrancas as $$
begin
  return query
  update cobrancas
  set
    proxima_notificacao_em = case
      when intervalo_minutos is not null then now() + (intervalo_minutos || ' minutes')::interval
      else null
    end
  where id in (
    select id from cobrancas
    where timer_ativo = true
      and proxima_notificacao_em is not null
      and proxima_notificacao_em <= now()
    for update skip locked
  )
  returning *;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
