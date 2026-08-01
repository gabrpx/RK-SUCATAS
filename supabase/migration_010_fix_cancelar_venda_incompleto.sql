-- =============================================================================
-- RK Sucatas — Migração 010: corrige item que continua marcado como
-- incompleto mesmo depois de cancelar a venda do componente que faltava.
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 009 aplicadas).
--
-- Bug: em cancelar_venda, quando a unidade incompleta encontrada só tinha
-- essa uma parte faltando (ex: par de setas, vendeu só a esquerda), ao
-- cancelar a venda o `v_faltando` vira um array vazio `[]`, mas o código
-- fazia jsonb_set direto e deixava a entrada `{"faltando": []}` pendurada em
-- unidades_incompletas — então o item seguia aparecendo como incompleto
-- mesmo com todas as partes de volta no estoque.
--
-- Fix: depois de tirar o componente de v_faltando, se o array ficou vazio a
-- unidade sai de vez de unidades_incompletas (mesma lógica de "poda" que
-- registrar_venda já usa quando uma unidade perde a última parte).
-- =============================================================================

create or replace function cancelar_venda(p_venda_id uuid)
returns void as $$
declare
  v_venda vendas;
  v_componentes jsonb;
  v_unidades jsonb;
  v_idx int;
  v_faltando jsonb;
begin
  select * into v_venda from vendas where id = p_venda_id;
  if v_venda is null then
    raise exception 'Venda não encontrada';
  end if;

  if v_venda.estoque_id is not null then
    if v_venda.componente_vendido is null then
      update estoque set quantidade = quantidade + v_venda.quantidade where id = v_venda.estoque_id;
    else
      select componentes, coalesce(unidades_incompletas, '[]'::jsonb)
        into v_componentes, v_unidades
      from estoque where id = v_venda.estoque_id
      for update;

      select (u.idx - 1) into v_idx
      from jsonb_array_elements(v_unidades) with ordinality as u(elem, idx)
      where coalesce(u.elem -> 'faltando', '[]'::jsonb) ? v_venda.componente_vendido
      limit 1;

      if v_idx is not null then
        v_faltando := (v_unidades -> v_idx -> 'faltando') - v_venda.componente_vendido;
        if jsonb_array_length(v_faltando) = 0 then
          -- Essa era a última parte faltando dessa unidade: ela volta a
          -- ficar 100% completa, então sai de unidades_incompletas.
          v_unidades := v_unidades - v_idx;
        else
          -- A unidade continua incompleta (faltava mais de uma parte) — só
          -- devolve a parte desta venda.
          v_unidades := jsonb_set(v_unidades, array[v_idx::text, 'faltando'], v_faltando);
        end if;
        update estoque set unidades_incompletas = v_unidades where id = v_venda.estoque_id;
      else
        -- Essa venda tinha sido a que esvaziou a unidade (ela saiu de
        -- `unidades_incompletas` e `quantidade` foi decrementada). Devolve 1
        -- unidade e recria o estado de "falta tudo, exceto o que esta venda tirou".
        v_faltando := coalesce(v_componentes, '[]'::jsonb) - v_venda.componente_vendido;
        v_unidades := v_unidades || jsonb_build_array(jsonb_build_object('faltando', v_faltando));
        update estoque set quantidade = quantidade + 1, unidades_incompletas = v_unidades where id = v_venda.estoque_id;
      end if;
    end if;
  end if;

  delete from caixa where venda_id = p_venda_id;
  delete from vendas where id = p_venda_id;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
