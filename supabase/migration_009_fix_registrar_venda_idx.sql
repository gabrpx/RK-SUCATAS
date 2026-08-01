-- =============================================================================
-- RK Sucatas — Migração 009: corrige bug de índice nulo em registrar_venda/
-- cancelar_venda ao vender um componente avulso quando o item já tem outra
-- unidade incompleta em estoque.
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 008 aplicadas).
--
-- Bug: as duas funções percorriam `unidades_incompletas` com
-- `for v_idx in 0 .. jsonb_array_length(v_unidades) - 1 loop ... exit`
-- pra achar a unidade certa, e usavam v_idx depois do loop em
-- `jsonb_set(v_unidades, array[v_idx::text, 'faltando'], ...)`. Na prática
-- isso falhava com "path element at position 1 is null" (venda de um
-- componente avulso quando já existia outra unidade incompleta do mesmo
-- item) — sintoma reproduzido tanto vendendo direto quanto vendendo a
-- partir de um orçamento, já que ambos chamam a mesma RPC.
--
-- Fix: troca o loop por `jsonb_array_elements(...) with ordinality`, que dá
-- o índice de forma explícita (NULL quando não encontra, sem depender do
-- estado do loop) — elimina a ambiguidade por completo.
-- =============================================================================

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
    -- específica (preferível a abrir uma nova unidade incompleta). Índice
    -- 0-based explícito via ordinality — nunca fica "pendurado" num v_idx
    -- indefinido como o loop antigo deixava em certos casos.
    select (u.idx - 1) into v_idx
    from jsonb_array_elements(v_unidades) with ordinality as u(elem, idx)
    where not (coalesce(u.elem -> 'faltando', '[]'::jsonb) ? p_componente)
    limit 1;

    if v_idx is not null then
      v_faltando := coalesce(v_unidades -> v_idx -> 'faltando', '[]'::jsonb) || to_jsonb(p_componente);
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

-- Mesmo fix aplicado aqui: trocado o loop por busca explícita via ordinality.
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
        -- A unidade continua incompleta (faltava mais de uma parte) — só
        -- devolve a parte desta venda.
        v_faltando := (v_unidades -> v_idx -> 'faltando') - v_venda.componente_vendido;
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
