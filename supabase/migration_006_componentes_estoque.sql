-- =============================================================================
-- RK Sucatas — Migração 006: peças compostas (vender uma parte sem
-- desmembrar o item no estoque)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002/003/004/005 aplicadas).
--
-- Problema: cadastrar "Mesa Completa" no estoque, mas às vezes vender só a
-- "Mesa Inferior" dela — sem criar um item de estoque separado pra cada
-- sub-parte, e sem perder o controle de que aquela unidade ficou incompleta.
--
-- Solução: `estoque.componentes` lista os nomes das partes em que o item
-- pode ser desmembrado (null = item sempre vendido inteiro, comportamento
-- de hoje). `estoque.unidades_incompletas` guarda, por unidade física ainda
-- em estoque, quais partes dela já foram vendidas avulsas — cada entrada é
-- `{"faltando": ["Inferior"]}`. Quando a última parte que falta também é
-- vendida, a unidade sai de vez do estoque (quantidade -1) e some da lista.
--
-- `quantidade` continua sendo o total de unidades físicas (completas ou
-- não) — só ela decide se há estoque, como já era antes. As unidades
-- incompletas só existem "dentro" desse total, nunca à parte dele.
-- =============================================================================

alter table estoque add column componentes jsonb;
alter table estoque add column unidades_incompletas jsonb not null default '[]'::jsonb;

alter table vendas add column componente_vendido text;

-- -----------------------------------------------------------------------------
-- registrar_venda: agora aceita p_componente (nome de uma parte cadastrada
-- em estoque.componentes). Quando informado, NÃO desconta uma unidade
-- inteira — marca a parte como vendida numa unidade incompleta existente
-- (ou abre uma nova incompleta a partir de uma unidade completa). Só
-- desconta 1 de `quantidade` quando a última parte que faltava também sai.
-- -----------------------------------------------------------------------------
create or replace function registrar_venda(
  p_estoque_id uuid,
  p_quantidade int,
  p_valor_unitario numeric,
  p_forma_pagamento_id uuid,
  p_modelo_moto_id uuid default null,
  p_cliente_nome text default null,
  p_observacoes text default null,
  p_data date default current_date,
  p_componente text default null
) returns vendas as $$
declare
  v_nome text;
  v_estoque_atual int;
  v_componentes jsonb;
  v_unidades jsonb;
  v_venda vendas;
  v_nome_para_venda text;
  v_idx int;
  v_faltando jsonb;
  v_unidades_completas int;
  v_achou boolean := false;
begin
  select nome, quantidade, componentes, coalesce(unidades_incompletas, '[]'::jsonb)
    into v_nome, v_estoque_atual, v_componentes, v_unidades
  from estoque where id = p_estoque_id
  for update; -- trava a linha até o fim da transação, evita venda concorrente furar o estoque

  if v_estoque_atual is null then
    raise exception 'Item de estoque não encontrado';
  end if;

  if p_componente is null then
    -- Venda do item inteiro: só pode sair de unidades que ainda estão 100%
    -- completas — não faria sentido vender como "inteira" uma unidade que já
    -- perdeu uma parte.
    v_unidades_completas := v_estoque_atual - jsonb_array_length(v_unidades);
    if v_unidades_completas < p_quantidade then
      raise exception 'Estoque insuficiente: % completa(s) disponível(is), % solicitada(s)', v_unidades_completas, p_quantidade;
    end if;

    update estoque set quantidade = quantidade - p_quantidade where id = p_estoque_id;
    v_nome_para_venda := v_nome;
  else
    if p_quantidade <> 1 then
      raise exception 'Venda de componente avulso só pode ser feita 1 de cada vez';
    end if;
    if v_componentes is null or not (v_componentes ? p_componente) then
      raise exception '"%" não é um componente cadastrado pra este item', p_componente;
    end if;

    -- Procura uma unidade já incompleta que ainda não perdeu essa parte
    -- específica (preferível a abrir uma nova unidade incompleta).
    for v_idx in 0 .. jsonb_array_length(v_unidades) - 1 loop
      v_faltando := coalesce(v_unidades -> v_idx -> 'faltando', '[]'::jsonb);
      if not (v_faltando ? p_componente) then
        v_achou := true;
        exit;
      end if;
    end loop;

    if v_achou then
      v_faltando := v_faltando || to_jsonb(p_componente);
      if (select count(*) from jsonb_array_elements_text(v_componentes) c where v_faltando ? c) = jsonb_array_length(v_componentes) then
        -- Essa unidade acabou de perder a última parte: sai de vez do estoque.
        v_unidades := v_unidades - v_idx;
        update estoque set quantidade = quantidade - 1, unidades_incompletas = v_unidades where id = p_estoque_id;
      else
        v_unidades := jsonb_set(v_unidades, array[v_idx::text, 'faltando'], v_faltando);
        update estoque set unidades_incompletas = v_unidades where id = p_estoque_id;
      end if;
    else
      v_unidades_completas := v_estoque_atual - jsonb_array_length(v_unidades);
      if v_unidades_completas < 1 then
        raise exception 'Nenhuma unidade disponível pra vender "%" avulso', p_componente;
      end if;
      v_unidades := v_unidades || jsonb_build_array(jsonb_build_object('faltando', jsonb_build_array(p_componente)));
      update estoque set unidades_incompletas = v_unidades where id = p_estoque_id;
    end if;

    v_nome_para_venda := v_nome || ' - ' || p_componente;
  end if;

  insert into vendas (
    estoque_id, nome_item, quantidade, valor_unitario, valor_total,
    forma_pagamento_id, modelo_moto_id, cliente_nome, observacoes, data, componente_vendido
  ) values (
    p_estoque_id, v_nome_para_venda, p_quantidade, p_valor_unitario, p_quantidade * p_valor_unitario,
    p_forma_pagamento_id, p_modelo_moto_id, p_cliente_nome, p_observacoes, coalesce(p_data, current_date), p_componente
  ) returning * into v_venda;

  insert into caixa (tipo, descricao, valor, forma_pagamento_id, venda_id, data)
  values ('entrada', 'Venda: ' || v_nome_para_venda, v_venda.valor_total, p_forma_pagamento_id, v_venda.id, v_venda.data);

  return v_venda;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- cancelar_venda: agora também reverte vendas de componente avulso —
-- devolve a parte pra unidade incompleta de onde ela saiu, ou, se a venda
-- tinha sido a que esvaziou a unidade por completo, devolve 1 unidade ao
-- estoque recriando o estado "incompleto" anterior a essa venda.
-- -----------------------------------------------------------------------------
create or replace function cancelar_venda(p_venda_id uuid)
returns void as $$
declare
  v_venda vendas;
  v_componentes jsonb;
  v_unidades jsonb;
  v_idx int;
  v_faltando jsonb;
  v_achou boolean := false;
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

      for v_idx in 0 .. jsonb_array_length(v_unidades) - 1 loop
        v_faltando := coalesce(v_unidades -> v_idx -> 'faltando', '[]'::jsonb);
        if v_faltando ? v_venda.componente_vendido then
          v_achou := true;
          exit;
        end if;
      end loop;

      if v_achou then
        -- A unidade continua incompleta (faltava mais de uma parte) — só
        -- devolve a parte desta venda.
        v_faltando := v_faltando - v_venda.componente_vendido;
        v_unidades := jsonb_set(v_unidades, array[v_idx::text, 'faltando'], v_faltando);
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
