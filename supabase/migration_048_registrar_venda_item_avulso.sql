-- =============================================================================
-- RK Sucatas — Migração 048: registrar_venda passa a aceitar item avulso
-- (sem estoque_id) — corrige "Vender tudo"/"Vender item" travando com "Item
-- de estoque não encontrado" pra linhas de orçamento sem peça vinculada.
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 047
-- aplicadas — depende de vendas/registrar_venda no estado da migration_038).
--
-- Causa raiz: um orçamento pode ter linhas "avulsas" (nome_item digitado na
-- hora, sem estoque_id — ver POST /api/orcamentos/:id/itens). venderLinha
-- (src/server/routes/orcamentos.ts) sempre chama registrar_venda passando
-- p_estoque_id = item.estoque_id, que é null pra essas linhas. A função
-- sempre fazia `select ... from estoque where id = p_estoque_id` e, sem
-- nenhuma linha encontrada (id null não bate com nada), levantava
-- 'Item de estoque não encontrado' — pra QUALQUER venda de item avulso, tanto
-- vendendo um item por vez quanto no "Vender tudo" (que reporta a falha em
-- `falhas` em vez de derrubar a rota, mas ainda assim nunca vende a linha).
--
-- ATENÇÃO: este create or replace copia o corpo INTEIRO e vigente de
-- registrar_venda (o de migration_038_vendas_unidade.sql) — não é uma
-- reescrita do zero. Mudanças de lógica:
--   1. Parâmetro novo `p_nome_item` (default null, no FINAL da assinatura —
--      nenhuma chamada existente quebra): nome a gravar em vendas.nome_item
--      quando não há estoque_id pra tirar o nome de lá.
--   2. Quando p_estoque_id é null, pula inteiro o bloco de
--      select/lock/decremento de estoque (não existe linha de estoque pra
--      travar) e usa p_nome_item como nome da venda. Componente e ficha de
--      unidade exigem uma peça de estoque real, então são explicitamente
--      recusados nesse caso.
--   3. Quando p_estoque_id não é null, comportamento 100% idêntico ao de
--      antes (mesmo bloco de código, só reindentado dentro do `else`).
--
-- cancelar_venda NÃO muda nesta migração — já trata `estoque_id is null`
-- corretamente (só apaga a venda/caixa, sem tentar devolver estoque).
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
  p_cliente_id uuid default null,
  p_unidade_id uuid default null,
  p_nome_item text default null
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
  v_natureza_forma text;
  v_unidade_estoque_id uuid;
  v_unidade_vendida_em timestamptz;
begin
  if p_estoque_id is null then
    -- Item avulso (linha de orçamento sem peça vinculada): não há o que
    -- travar/decrementar em estoque. Componente e ficha só fazem sentido
    -- amarrados a uma peça real.
    if p_componente is not null then
      raise exception 'Não é possível vender um componente sem um item de estoque vinculado';
    end if;
    if p_unidade_id is not null then
      raise exception 'Não é possível vender uma ficha sem um item de estoque vinculado';
    end if;
    if p_nome_item is null or btrim(p_nome_item) = '' then
      raise exception 'Nome do item é obrigatório para venda avulsa';
    end if;

    v_nome_para_venda := p_nome_item;
  else
    select nome, quantidade, componentes, coalesce(unidades_incompletas, '[]'::jsonb)
      into v_nome, v_estoque_atual, v_componentes, v_unidades
    from estoque where id = p_estoque_id
    for update; -- trava a linha até o fim da transação, evita venda concorrente furar o estoque

    if v_estoque_atual is null then
      raise exception 'Item de estoque não encontrado';
    end if;

    if p_unidade_id is not null then
      if p_componente is not null then
        raise exception 'Não é possível vender uma ficha específica e uma parte avulsa na mesma venda';
      end if;
      if p_quantidade <> 1 then
        raise exception 'Venda de uma ficha específica só pode ser feita 1 de cada vez';
      end if;

      select estoque_id, vendida_em into v_unidade_estoque_id, v_unidade_vendida_em
      from estoque_unidades where id = p_unidade_id
      for update;

      if v_unidade_estoque_id is null then
        raise exception 'Ficha de unidade não encontrada';
      end if;
      if v_unidade_estoque_id <> p_estoque_id then
        raise exception 'Esta ficha pertence a outro item de estoque';
      end if;
      if v_unidade_vendida_em is not null then
        raise exception 'Esta ficha já foi vendida';
      end if;
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

      if p_unidade_id is not null then
        update estoque_unidades set vendida_em = now() where id = p_unidade_id;
      end if;
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

  insert into vendas (
    estoque_id, nome_item, quantidade, valor_unitario, valor_total,
    forma_pagamento_id, modelo_moto_id, cliente_nome, cliente_id, observacoes, data, componente_vendido, unidade_id
  ) values (
    p_estoque_id, v_nome_para_venda, p_quantidade, p_valor_unitario, p_quantidade * p_valor_unitario,
    p_forma_pagamento_id, p_modelo_moto_id, v_cliente_nome_final, p_cliente_id, p_observacoes, coalesce(p_data, current_date), p_componente, p_unidade_id
  ) returning * into v_venda;

  -- Fiado não lança no Caixa na hora — só quando um recebimento for
  -- confirmado (ver registrar_recebimento_fiado, migration_031).
  select natureza into v_natureza_forma from formas_pagamento where id = p_forma_pagamento_id;
  if coalesce(v_natureza_forma, 'avista') <> 'fiado' then
    insert into caixa (tipo, descricao, valor, forma_pagamento_id, venda_id, data)
    values ('entrada', 'Venda: ' || v_nome_para_venda, v_venda.valor_total, p_forma_pagamento_id, v_venda.id, v_venda.data);
  end if;

  return v_venda;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
