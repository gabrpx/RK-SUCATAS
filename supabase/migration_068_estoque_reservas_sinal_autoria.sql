-- =============================================================================
-- RK Sucatas — Migração 068: sinal obrigatório na reserva + autoria/histórico
-- =============================================================================
-- CRIADA EM 23/09/2026 A PEDIDO DO USUÁRIO. **NÃO APLICADA.**
-- Ordem obrigatória: 065 → 066 (aplicadas) → 067 → 068. Testar primeiro em
-- homologação com o roteiro docs/validacao-estoque-reservas-067-068.sql.
--
-- Decisões do usuário (23/09/2026):
--   * A reserva só existe com sinal pago: valor mínimo de 20% do preço da
--     unidade (pode ser maior, nunca acima do preço) e forma de pagamento
--     cadastrada (formas_pagamento, natureza à vista). O sinal NÃO é lançado
--     no Caixa por esta migration — decisão explícita; lançamento financeiro
--     exigiria RPC transacional própria e revisão do Codex.
--   * Unidade sem preço não pode ser reservada.
--   * Registrar QUEM reservou, liberou, arquivou e restaurou.
--
-- Não altera registrar_venda/cancelar_venda nem dados existentes. Reservas
-- antigas continuam válidas com sinal nulo (anteriores à regra).
--
-- Autoria: usuario_id NÃO tem FK para usuarios de propósito — o acesso de
-- desenvolvimento via localhost usa o id fixo 00000000-...-000000000000, que
-- não existe na tabela; uma FK derrubaria a operação. O nome é gravado como
-- retrato (snapshot) para o histórico continuar legível se o usuário sair.
-- =============================================================================
begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'estoque_reservas' and column_name = 'cliente_id'
  ) then
    raise exception 'Aplique a migration_067 antes da 068';
  end if;
end;
$$;

-- 1. Sinal e autoria na reserva ------------------------------------------------
alter table estoque_reservas
  add column valor_sinal numeric(12,2) check (valor_sinal is null or valor_sinal > 0),
  add column preco_referencia numeric(12,2) check (preco_referencia is null or preco_referencia > 0),
  add column forma_pagamento_sinal_id uuid references formas_pagamento(id) on delete set null,
  add column criada_por uuid,
  add column criada_por_nome text,
  add column liberada_por uuid,
  add column liberada_por_nome text;

-- 2. Linha do tempo de eventos da unidade física -------------------------------
-- Reservas já têm sua própria tabela (com criação/liberação); aqui ficam os
-- eventos que sobrescrevem colunas e perderiam o histórico: arquivar,
-- restaurar e mudança de endereço.
create table estoque_unidade_eventos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references estoque_unidades(id) on delete cascade,
  tipo text not null check (tipo in ('arquivada', 'restaurada', 'endereco_alterado')),
  detalhe jsonb not null default '{}'::jsonb,
  usuario_id uuid,
  usuario_nome text,
  criado_em timestamptz not null default now()
);
create index idx_estoque_unidade_eventos_unidade on estoque_unidade_eventos(unidade_id, criado_em desc);
alter table estoque_unidade_eventos enable row level security;
revoke all on estoque_unidade_eventos from anon, authenticated;

-- Mudança de endereço é gravada pela rota PATCH (update simples), sem RPC:
-- o trigger registra o evento sem autoria. Só dispara quando endereco_id
-- muda — não participa do caminho de registrar_venda/cancelar_venda.
create function registrar_evento_endereco_unidade() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into estoque_unidade_eventos (unidade_id, tipo, detalhe)
  values (new.id, 'endereco_alterado', jsonb_build_object(
    'de', (select codigo from estoque_locais where id = old.endereco_id),
    'para', (select codigo from estoque_locais where id = new.endereco_id)
  ));
  return new;
end;
$$;
create trigger trg_registrar_evento_endereco_unidade
  after update of endereco_id on estoque_unidades
  for each row when (old.endereco_id is distinct from new.endereco_id)
  execute function registrar_evento_endereco_unidade();

-- 3. reservar_unidade_estoque com sinal obrigatório ---------------------------
drop function reservar_unidade_estoque(uuid, text, timestamptz, uuid);
create function reservar_unidade_estoque(
  p_unidade_id uuid,
  p_responsavel text,
  p_ate timestamptz,
  p_cliente_id uuid default null,
  p_valor_sinal numeric default null,
  p_forma_pagamento_id uuid default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns estoque_reservas language plpgsql security invoker set search_path = public as $$
declare v_estoque_id uuid; v_unidade estoque_unidades; v_reserva estoque_reservas;
  v_cliente_nome text; v_cliente_banido boolean; v_responsavel text;
  v_preco numeric; v_minimo numeric; v_natureza text; v_sinal numeric;
  v_quantidade int; v_reservadas int;
begin
  v_responsavel := btrim(coalesce(p_responsavel, ''));
  if p_cliente_id is not null then
    select nome, banido into v_cliente_nome, v_cliente_banido from clientes where id = p_cliente_id;
    if v_cliente_nome is null then raise exception 'Cliente não encontrado'; end if;
    if v_cliente_banido then raise exception 'Cliente banido não pode reservar peças'; end if;
    if v_responsavel = '' then v_responsavel := btrim(v_cliente_nome); end if;
  end if;
  if length(v_responsavel) not between 2 and 120 then
    raise exception 'Informe o responsável pela reserva (2 a 120 caracteres)';
  end if;
  -- Mesma regra da UI e da API: duração máxima de 30 × 24 h a partir de agora.
  if p_ate is null or p_ate <= now() or p_ate > now() + interval '30 days' then
    raise exception 'Vencimento da reserva deve estar entre agora e 30 dias';
  end if;
  if p_valor_sinal is null or p_valor_sinal <= 0 then
    raise exception 'Informe o valor do sinal pago (mínimo de 20%% do preço)';
  end if;
  if p_forma_pagamento_id is null then
    raise exception 'Informe a forma de pagamento do sinal';
  end if;
  select natureza into v_natureza from formas_pagamento where id = p_forma_pagamento_id;
  if v_natureza is null then raise exception 'Forma de pagamento do sinal não encontrada'; end if;
  if v_natureza = 'fiado' then raise exception 'O sinal precisa ser pago: forma de pagamento fiado não é aceita'; end if;

  select estoque_id into v_estoque_id from estoque_unidades where id = p_unidade_id;
  if v_estoque_id is null then raise exception 'Unidade não encontrada'; end if;
  select quantidade into v_quantidade from estoque where id = v_estoque_id for update;
  select * into v_unidade from estoque_unidades where id = p_unidade_id for update;
  if v_unidade.id is null then raise exception 'Unidade não encontrada'; end if;
  if v_unidade.vendida_em is not null or v_unidade.arquivada_em is not null then
    raise exception 'Unidade vendida ou arquivada não pode ser reservada';
  end if;
  update estoque_reservas set liberada_em = now(), motivo_liberacao = 'Expirada'
    where unidade_id = p_unidade_id and liberada_em is null and reservada_ate <= now();
  if exists (select 1 from estoque_reservas where unidade_id = p_unidade_id and liberada_em is null) then
    raise exception 'Esta unidade já está reservada';
  end if;
  -- Venda sem p_unidade_id (orçamento, Mercado Livre) baixa a quantidade sem
  -- marcar uma ficha como vendida. Não aceite sinal por uma peça que o saldo
  -- já não cobre: cada reserva ativa precisa de uma unidade de quantidade.
  select count(*) into v_reservadas from estoque_reservas r
    join estoque_unidades u on u.id = r.unidade_id
    where u.estoque_id = v_estoque_id and u.vendida_em is null and u.arquivada_em is null
      and r.liberada_em is null and r.reservada_ate > now();
  if coalesce(v_quantidade, 0) <= v_reservadas then
    raise exception 'Sem estoque disponível: a quantidade da peça já está vendida ou reservada';
  end if;

  -- Preço vigente da unidade: o próprio ou, se nulo, o da peça (mesma regra
  -- de herança usada no cadastro de unidades).
  select coalesce(v_unidade.valor, e.valor) into v_preco from estoque e where e.id = v_estoque_id;
  if v_preco is null or v_preco <= 0 then
    raise exception 'Defina o preço da unidade antes de reservar';
  end if;
  v_minimo := greatest(round(v_preco * 0.20, 2), 0.01);
  v_sinal := round(p_valor_sinal, 2);
  if v_sinal < v_minimo or v_sinal <= 0 then
    raise exception 'Sinal abaixo de 20%% do preço: mínimo de R$ %', replace(to_char(v_minimo, 'FM999999990.00'), '.', ',');
  end if;
  if v_sinal > v_preco then
    raise exception 'O sinal não pode ser maior que o preço da unidade';
  end if;

  insert into estoque_reservas (
    unidade_id, responsavel, reservada_ate, cliente_id,
    valor_sinal, preco_referencia, forma_pagamento_sinal_id, criada_por, criada_por_nome
  ) values (
    p_unidade_id, v_responsavel, p_ate, p_cliente_id,
    v_sinal, v_preco, p_forma_pagamento_id, p_usuario_id, nullif(btrim(coalesce(p_usuario_nome, '')), '')
  ) returning * into v_reserva;
  return v_reserva;
end;
$$;

-- 4. Liberar, arquivar e restaurar com autoria --------------------------------
drop function liberar_reserva_estoque(uuid);
create function liberar_reserva_estoque(p_reserva_id uuid, p_usuario_id uuid default null, p_usuario_nome text default null)
returns estoque_reservas language plpgsql security invoker set search_path = public as $$
declare v_estoque_id uuid; v_unidade_id uuid; v_reserva estoque_reservas;
begin
  select u.estoque_id, r.unidade_id into v_estoque_id, v_unidade_id
    from estoque_reservas r join estoque_unidades u on u.id = r.unidade_id where r.id = p_reserva_id;
  if v_estoque_id is null then raise exception 'Reserva não encontrada'; end if;
  perform 1 from estoque where id = v_estoque_id for update;
  perform 1 from estoque_unidades where id = v_unidade_id for update;
  update estoque_reservas set liberada_em = now(), motivo_liberacao = 'Liberada pela equipe',
      liberada_por = p_usuario_id, liberada_por_nome = nullif(btrim(coalesce(p_usuario_nome, '')), '')
    where id = p_reserva_id and liberada_em is null returning * into v_reserva;
  if v_reserva.id is null then raise exception 'Reserva já foi liberada'; end if;
  return v_reserva;
end;
$$;

drop function arquivar_unidade_estoque(uuid, text);
create function arquivar_unidade_estoque(p_unidade_id uuid, p_motivo text, p_usuario_id uuid default null, p_usuario_nome text default null)
returns estoque_unidades language plpgsql security invoker set search_path = public as $$
declare v_estoque_id uuid; v_unidade estoque_unidades;
begin
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 240 then
    raise exception 'Informe um motivo de 3 a 240 caracteres';
  end if;
  select estoque_id into v_estoque_id from estoque_unidades where id = p_unidade_id;
  if v_estoque_id is null then raise exception 'Unidade não encontrada'; end if;
  perform 1 from estoque where id = v_estoque_id for update;
  select * into v_unidade from estoque_unidades where id = p_unidade_id for update;
  if v_unidade.id is null then raise exception 'Unidade não encontrada'; end if;
  if v_unidade.vendida_em is not null or v_unidade.arquivada_em is not null then
    raise exception 'Unidade vendida ou já arquivada';
  end if;
  if exists (select 1 from estoque_reservas where unidade_id = p_unidade_id
    and liberada_em is null and reservada_ate > now()) then
    raise exception 'Libere a reserva antes de arquivar a unidade';
  end if;
  update estoque_unidades set arquivada_em = now(), motivo_arquivamento = btrim(p_motivo)
    where id = p_unidade_id returning * into v_unidade;
  update estoque set quantidade = quantidade - 1 where id = v_estoque_id and quantidade > 0;
  if not found then raise exception 'Quantidade inconsistente; arquivamento cancelado'; end if;
  insert into estoque_unidade_eventos (unidade_id, tipo, detalhe, usuario_id, usuario_nome)
    values (p_unidade_id, 'arquivada', jsonb_build_object('motivo', btrim(p_motivo)),
      p_usuario_id, nullif(btrim(coalesce(p_usuario_nome, '')), ''));
  return v_unidade;
end;
$$;

drop function restaurar_unidade_estoque(uuid);
create function restaurar_unidade_estoque(p_unidade_id uuid, p_usuario_id uuid default null, p_usuario_nome text default null)
returns estoque_unidades language plpgsql security invoker set search_path = public as $$
declare v_estoque_id uuid; v_unidade estoque_unidades; v_motivo text;
begin
  select estoque_id into v_estoque_id from estoque_unidades where id = p_unidade_id;
  if v_estoque_id is null then raise exception 'Unidade não encontrada'; end if;
  perform 1 from estoque where id = v_estoque_id for update;
  select * into v_unidade from estoque_unidades where id = p_unidade_id for update;
  if v_unidade.id is null then raise exception 'Unidade não encontrada'; end if;
  if v_unidade.vendida_em is not null or v_unidade.arquivada_em is null then
    raise exception 'Apenas unidade arquivada e não vendida pode ser restaurada';
  end if;
  v_motivo := v_unidade.motivo_arquivamento;
  update estoque_unidades set arquivada_em = null, motivo_arquivamento = null
    where id = p_unidade_id returning * into v_unidade;
  update estoque set quantidade = quantidade + 1 where id = v_estoque_id;
  insert into estoque_unidade_eventos (unidade_id, tipo, detalhe, usuario_id, usuario_nome)
    values (p_unidade_id, 'restaurada', jsonb_build_object('motivo_anterior', v_motivo),
      p_usuario_id, nullif(btrim(coalesce(p_usuario_nome, '')), ''));
  return v_unidade;
end;
$$;

revoke all on function
  reservar_unidade_estoque(uuid, text, timestamptz, uuid, numeric, uuid, uuid, text),
  liberar_reserva_estoque(uuid, uuid, text),
  arquivar_unidade_estoque(uuid, text, uuid, text),
  restaurar_unidade_estoque(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function
  reservar_unidade_estoque(uuid, text, timestamptz, uuid, numeric, uuid, uuid, text),
  liberar_reserva_estoque(uuid, uuid, text),
  arquivar_unidade_estoque(uuid, text, uuid, text),
  restaurar_unidade_estoque(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
commit;
