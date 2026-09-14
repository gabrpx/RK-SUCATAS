-- =============================================================================
-- RK Sucatas — Migração 031: recebimentos de fiado (com parcial)
-- =============================================================================
-- Rode isso no editor SQL do Supabase, DEPOIS da migration_030 — essa ordem
-- agora é uma dependência real, não só numérica: registrar_venda (recriada
-- abaixo) lê formas_pagamento.natureza, que só existe depois da 030.
--
-- Substitui a ideia original de "fiado_baixas" (marcador único por venda,
-- sem efeito no Caixa) por um modelo de verdade: venda com forma de
-- pagamento fiado NÃO lança no Caixa na hora; cada recebimento (podendo ser
-- parcial) lança sua própria entrada, com a forma de pagamento real
-- escolhida no momento (dinheiro, pix etc.).
--
-- fiado_recebimentos.venda_id é "on delete restrict" de propósito: se
-- alguém tentar cancelar (cancelar_venda) uma venda que já tem recebimento,
-- o Postgres barra a exclusão sozinho (violação de FK) — sem isso seria
-- possível cancelar uma venda com dinheiro já recebido e perder o rastro.
-- vendas.ts trata esse erro com uma mensagem amigável.
--
-- A entrada de caixa de um recebimento NÃO leva venda_id (diferente da
-- entrada de uma venda à vista) — só assim porque cancelar_venda faz
-- `delete from caixa where venda_id = ...`, e uma entrada de recebimento
-- não pode ser apagada se a venda original for cancelada depois (o que nem
-- deveria ser possível, dado o "on delete restrict" acima, mas evita a
-- armadilha por completo em vez de depender só disso). O vínculo com a
-- venda fica só em fiado_recebimentos.venda_id.
-- =============================================================================

create table fiado_recebimentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete restrict,
  valor numeric(10,2) not null check (valor > 0),
  forma_pagamento_id uuid not null references formas_pagamento(id) on delete restrict,
  caixa_id uuid references caixa(id) on delete set null,
  recebido_por uuid not null references usuarios(id) on delete restrict,
  recebido_em timestamptz not null default now()
);

create index idx_fiado_recebimentos_venda on fiado_recebimentos(venda_id);

alter table fiado_recebimentos enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

-- Transacional, no mesmo espírito de registrar_venda/cancelar_venda: lança a
-- entrada no Caixa e registra o recebimento juntos, validando que o valor
-- não estoura o saldo ainda em aberto. `for update` na venda evita que dois
-- recebimentos simultâneos (ex: dois atendentes ao mesmo tempo) juntos
-- ultrapassem o saldo.
create or replace function registrar_recebimento_fiado(
  p_venda_id uuid,
  p_valor numeric,
  p_forma_pagamento_id uuid,
  p_usuario_id uuid
) returns fiado_recebimentos as $$
declare
  v_venda vendas;
  v_ja_recebido numeric;
  v_saldo numeric;
  v_natureza_forma text;
  v_caixa caixa;
  v_recebimento fiado_recebimentos;
begin
  select * into v_venda from vendas where id = p_venda_id for update;
  if v_venda is null then
    raise exception 'Venda não encontrada';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor precisa ser maior que zero';
  end if;

  select natureza into v_natureza_forma from formas_pagamento where id = p_forma_pagamento_id;
  if v_natureza_forma is null then
    raise exception 'Forma de pagamento não encontrada';
  end if;
  if v_natureza_forma = 'fiado' then
    raise exception 'Escolha uma forma de pagamento que não seja fiado pra confirmar o recebimento';
  end if;

  select coalesce(sum(valor), 0) into v_ja_recebido from fiado_recebimentos where venda_id = p_venda_id;
  v_saldo := v_venda.valor_total - v_ja_recebido;

  if p_valor > v_saldo + 0.01 then
    raise exception 'Valor (%) maior que o saldo em aberto (%)', p_valor, v_saldo;
  end if;

  insert into caixa (tipo, descricao, valor, forma_pagamento_id, data)
  values ('entrada', 'Recebimento fiado: ' || v_venda.nome_item, p_valor, p_forma_pagamento_id, current_date)
  returning * into v_caixa;

  insert into fiado_recebimentos (venda_id, valor, forma_pagamento_id, caixa_id, recebido_por)
  values (p_venda_id, p_valor, p_forma_pagamento_id, v_caixa.id, p_usuario_id)
  returning * into v_recebimento;

  return v_recebimento;
end;
$$ language plpgsql;

-- ATENÇÃO: copia o corpo INTEIRO e vigente de registrar_venda (o de
-- migration_029_registrar_venda_cliente_id.sql) — mesma convenção já usada
-- lá (que por sua vez copiou de migration_009). A única mudança de lógica é
-- o insert em caixa virar condicional: só acontece quando a forma de
-- pagamento NÃO é fiado. Assinatura idêntica (mesmos parâmetros, mesma
-- ordem) — nenhuma chamada existente quebra.
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
  v_natureza_forma text;
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

  -- Fiado não lança no Caixa na hora — só quando um recebimento for
  -- confirmado (ver registrar_recebimento_fiado acima).
  select natureza into v_natureza_forma from formas_pagamento where id = p_forma_pagamento_id;
  if coalesce(v_natureza_forma, 'avista') <> 'fiado' then
    insert into caixa (tipo, descricao, valor, forma_pagamento_id, venda_id, data)
    values ('entrada', 'Venda: ' || v_nome_para_venda, v_venda.valor_total, p_forma_pagamento_id, v_venda.id, v_venda.data);
  end if;

  return v_venda;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
