-- =============================================================================
-- RK Sucatas — Migração 037: cancelamento em cascata de venda fiado quitada
-- =============================================================================
-- Rode isso no editor SQL do Supabase (depende de vendas, caixa,
-- fiado_recebimentos — schema.sql + migrations 002 a 036 aplicadas).
--
-- fiado_recebimentos.venda_id é "on delete restrict" de propósito (ver
-- migration_031) — impede cancelar uma venda que já tem dinheiro recebido,
-- pra não perder o rastro. Isso é correto, mas deixava sem saída quem
-- precisa desfazer uma venda fiado inteira (ex: venda cadastrada errada,
-- cliente devolveu tudo) — tinha que reverter recebimento por recebimento
-- manualmente (DELETE /api/fiado/recebimentos/:id, já existente) antes de
-- conseguir cancelar a venda em si.
--
-- Esta função automatiza essa sequência inteira numa transação só: apaga
-- cada recebimento (e a entrada de caixa vinculada a ele, se houver) e por
-- fim chama cancelar_venda (migration_010), que devolve a quantidade ao
-- estoque e remove a venda. Reaproveita cancelar_venda em vez de duplicar a
-- lógica dela.
-- =============================================================================

create or replace function cancelar_venda_fiado_completa(p_venda_id uuid)
returns void as $$
declare
  v_recebimento record;
begin
  for v_recebimento in select id, caixa_id from fiado_recebimentos where venda_id = p_venda_id loop
    if v_recebimento.caixa_id is not null then
      delete from caixa where id = v_recebimento.caixa_id;
    end if;
    delete from fiado_recebimentos where id = v_recebimento.id;
  end loop;

  perform cancelar_venda(p_venda_id);
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
