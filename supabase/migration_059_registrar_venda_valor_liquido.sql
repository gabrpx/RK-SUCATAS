-- =============================================================================
-- RK Sucatas — Migração 059: vendas do Mercado Livre com valor líquido
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 058
-- aplicadas — depende de registrar_venda no estado da migration_058).
--
-- Mudança de escopo: migration_058 usava valor líquido APENAS no Caixa,
-- mantendo vendas.valor_unitario/valor_total = preço cheio. Reavaliação:
-- o sistema agora quer que a própria venda reflita o valor líquido recebido,
-- não o preço nominal. Razão: relatórios de cliente (totalGasto, ranking
-- "campeão") devem refletir o valor REAL que o vendedor recebeu, não o preço
-- nominal.
--
-- Mudança de lógica:
--   1. Quando `p_valor_recebido` não é null:
--      - vendas.valor_total := p_valor_recebido (não mais p_quantidade * p_valor_unitario)
--      - vendas.valor_unitario := p_valor_recebido / p_quantidade (não mais p_valor_unitario)
--   2. Quando `p_valor_recebido` é null (venda avulsa, loja física, orçamento):
--      - Sem mudança nenhuma — continua preço cheio em tudo
--   3. O Caixa usa o MESMO valor_total da venda agora (já vai estar líquido)
--
-- Confirmado via API real (pedido 2000018236472830, verificado em 03/09/2026):
-- valor líquido do Mercado Livre = preço - taxa_venda - custo_envio_vendedor.
--
-- Igualdade à migration_058: como a assinatura de registrar_venda não muda
-- (p_valor_recebido já existe), nenhum drop novo é necessário.
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
  p_nome_item text default null,
  p_valor_recebido numeric default null
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
  v_valor_unitario_final numeric;
  v_valor_total_final numeric;
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

  -- Quando há valor_recebido (Mercado Livre), usa esse valor líquido na venda.
  -- Quando não há (venda avulsa/loja física), usa preço cheio como antes.
  if p_valor_recebido is not null then
    v_valor_total_final := p_valor_recebido;
    v_valor_unitario_final := case when p_quantidade > 0 then p_valor_recebido / p_quantidade else 0 end;
  else
    v_valor_total_final := p_quantidade * p_valor_unitario;
    v_valor_unitario_final := p_valor_unitario;
  end if;

  insert into vendas (
    estoque_id, nome_item, quantidade, valor_unitario, valor_total,
    forma_pagamento_id, modelo_moto_id, cliente_nome, cliente_id, observacoes, data, componente_vendido, unidade_id
  ) values (
    p_estoque_id, v_nome_para_venda, p_quantidade, v_valor_unitario_final, v_valor_total_final,
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
