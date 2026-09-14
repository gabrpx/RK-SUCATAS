-- =============================================================================
-- RK Sucatas — Migração 029: registrar_venda passa a aceitar cliente_id
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 028 aplicadas — depende de vendas.cliente_id da 028).
--
-- ATENÇÃO: este create or replace copia o corpo INTEIRO e vigente de
-- registrar_venda (o de migration_009_fix_registrar_venda_idx.sql, já com o
-- fix de unidades_incompletas/componente avulso) — não é uma reescrita do
-- zero. A única mudança de lógica é a adição de p_cliente_id (parâmetro novo
-- no FINAL da assinatura, com default null, então nenhuma chamada existente
-- quebra) e a variável v_cliente_nome_final: quando um cliente cadastrado é
-- informado, o nome dele vira o snapshot gravado em vendas.cliente_nome
-- (mesmo padrão que nome_item já é um snapshot de estoque.nome); quando não,
-- comportamento atual de nome livre (p_cliente_nome) é mantido.
--
-- cancelar_venda NÃO muda nesta migração — ela só deleta a linha de
-- vendas/caixa, nunca recria o snapshot de cliente.
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
  p_componente text default null,
  p_cliente_id uuid default null
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
  v_cliente_nome_final text;
begin
  select nome, quantidade, componentes, coalesce(unidades_incompletas, '[]'::jsonb)
    into v_nome, v_estoque_atual, v_componentes, v_unidades
  from estoque where id = p_estoque_id
  for update; -- trava a linha até o fim da transação, evita venda concorrente furar o estoque

  if v_estoque_atual is null then
    raise exception 'Item de estoque não encontrado';
  end if;

  -- Cliente cadastrado tem prioridade sobre o nome livre — o nome vira só um
  -- retrato (snapshot) do cadastro no momento da venda, igual nome_item já é
  -- um retrato de estoque.nome.
  if p_cliente_id is not null then
    select nome into v_cliente_nome_final from clientes where id = p_cliente_id;
    if v_cliente_nome_final is null then
      raise exception 'Cliente não encontrado';
    end if;
  else
    v_cliente_nome_final := p_cliente_nome;
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
    forma_pagamento_id, modelo_moto_id, cliente_nome, cliente_id, observacoes, data, componente_vendido
  ) values (
    p_estoque_id, v_nome_para_venda, p_quantidade, p_valor_unitario, p_quantidade * p_valor_unitario,
    p_forma_pagamento_id, p_modelo_moto_id, v_cliente_nome_final, p_cliente_id, p_observacoes, coalesce(p_data, current_date), p_componente
  ) returning * into v_venda;

  insert into caixa (tipo, descricao, valor, forma_pagamento_id, venda_id, data)
  values ('entrada', 'Venda: ' || v_nome_para_venda, v_venda.valor_total, p_forma_pagamento_id, v_venda.id, v_venda.data);

  return v_venda;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
