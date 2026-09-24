-- Reserva e retirada física sem reescrever registrar_venda/cancelar_venda.
-- Aplicar SOMENTE depois da 065, primeiro em homologação. Não altera dados existentes.
begin;

create table estoque_reservas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references estoque_unidades(id) on delete restrict,
  responsavel text not null check (length(btrim(responsavel)) between 2 and 120),
  reservada_ate timestamptz not null,
  criada_em timestamptz not null default now(),
  liberada_em timestamptz,
  motivo_liberacao text,
  check (reservada_ate > criada_em)
);
create unique index idx_estoque_reserva_aberta on estoque_reservas(unidade_id) where liberada_em is null;
create index idx_estoque_reservas_validas on estoque_reservas(unidade_id, reservada_ate) where liberada_em is null;
alter table estoque_reservas enable row level security;
revoke all on estoque_reservas from anon, authenticated;

-- O bloqueio na própria ficha cobre TODAS as chamadas atuais de registrar_venda,
-- inclusive as que chegam por orçamento, sem duplicar uma RPC financeira longa.
create function validar_saida_unidade_estoque() returns trigger language plpgsql as $$
begin
  if new.vendida_em is not null and old.vendida_em is null then
    if old.arquivada_em is not null then
      raise exception 'Unidade arquivada não pode ser vendida';
    end if;
    if exists (select 1 from estoque_reservas r where r.unidade_id = old.id
      and r.liberada_em is null and r.reservada_ate > now()) then
      raise exception 'Unidade reservada: libere a reserva antes da venda';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_validar_saida_unidade_estoque before update of vendida_em on estoque_unidades
  for each row execute function validar_saida_unidade_estoque();

-- Vendas sem p_unidade_id também devem preservar as unidades reservadas.
-- A RPC de venda já trava a linha de estoque antes de atualizar quantidade;
-- reservas e arquivamento usam a mesma ordem de locks.
create function validar_quantidade_reservada() returns trigger language plpgsql as $$
declare v_reservadas int;
begin
  if new.quantidade >= old.quantidade then return new; end if;
  select count(*) into v_reservadas from estoque_reservas r
    join estoque_unidades u on u.id = r.unidade_id
    where u.estoque_id = old.id and u.vendida_em is null and u.arquivada_em is null
      and r.liberada_em is null and r.reservada_ate > now();
  if new.quantidade < v_reservadas then
    raise exception 'Estoque reservado: libere as reservas antes de baixar a quantidade';
  end if;
  return new;
end;
$$;
create trigger trg_validar_quantidade_reservada before update of quantidade on estoque
  for each row execute function validar_quantidade_reservada();

create function reservar_unidade_estoque(p_unidade_id uuid, p_responsavel text, p_ate timestamptz)
returns estoque_reservas language plpgsql security invoker as $$
declare v_estoque_id uuid; v_unidade estoque_unidades; v_reserva estoque_reservas;
begin
  if length(btrim(coalesce(p_responsavel, ''))) not between 2 and 120 then
    raise exception 'Informe o responsável pela reserva (2 a 120 caracteres)';
  end if;
  if p_ate is null or p_ate <= now() or p_ate > now() + interval '30 days' then
    raise exception 'Vencimento da reserva deve estar entre agora e 30 dias';
  end if;
  select estoque_id into v_estoque_id from estoque_unidades where id = p_unidade_id;
  if v_estoque_id is null then raise exception 'Unidade não encontrada'; end if;
  perform 1 from estoque where id = v_estoque_id for update;
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
  insert into estoque_reservas (unidade_id, responsavel, reservada_ate)
    values (p_unidade_id, btrim(p_responsavel), p_ate) returning * into v_reserva;
  return v_reserva;
end;
$$;

create function liberar_reserva_estoque(p_reserva_id uuid) returns estoque_reservas
language plpgsql security invoker as $$
declare v_estoque_id uuid; v_unidade_id uuid; v_reserva estoque_reservas;
begin
  select u.estoque_id, r.unidade_id into v_estoque_id, v_unidade_id
    from estoque_reservas r join estoque_unidades u on u.id = r.unidade_id where r.id = p_reserva_id;
  if v_estoque_id is null then raise exception 'Reserva não encontrada'; end if;
  perform 1 from estoque where id = v_estoque_id for update;
  perform 1 from estoque_unidades where id = v_unidade_id for update;
  update estoque_reservas set liberada_em = now(), motivo_liberacao = 'Liberada pela equipe'
    where id = p_reserva_id and liberada_em is null returning * into v_reserva;
  if v_reserva.id is null then raise exception 'Reserva já foi liberada'; end if;
  return v_reserva;
end;
$$;

create function arquivar_unidade_estoque(p_unidade_id uuid, p_motivo text) returns estoque_unidades
language plpgsql security invoker as $$
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
  return v_unidade;
end;
$$;

create function restaurar_unidade_estoque(p_unidade_id uuid) returns estoque_unidades
language plpgsql security invoker as $$
declare v_estoque_id uuid; v_unidade estoque_unidades;
begin
  select estoque_id into v_estoque_id from estoque_unidades where id = p_unidade_id;
  if v_estoque_id is null then raise exception 'Unidade não encontrada'; end if;
  perform 1 from estoque where id = v_estoque_id for update;
  select * into v_unidade from estoque_unidades where id = p_unidade_id for update;
  if v_unidade.id is null then raise exception 'Unidade não encontrada'; end if;
  if v_unidade.vendida_em is not null or v_unidade.arquivada_em is null then
    raise exception 'Apenas unidade arquivada e não vendida pode ser restaurada';
  end if;
  update estoque_unidades set arquivada_em = null, motivo_arquivamento = null
    where id = p_unidade_id returning * into v_unidade;
  update estoque set quantidade = quantidade + 1 where id = v_estoque_id;
  return v_unidade;
end;
$$;

-- A contagem de fichas ativas deve ignorar as arquivadas, senão uma edição
-- posterior de quantidade pode apagar fichas em branco ou criar discrepância.
create or replace function sincronizar_unidades_estoque(p_estoque_id uuid, p_quantidade_alvo int)
returns void language plpgsql as $$
declare v_atual int; v_sobrando int; v_descartaveis int;
begin
  if p_quantidade_alvo < 0 then raise exception 'Quantidade não pode ser negativa'; end if;
  select count(*) into v_atual from estoque_unidades
    where estoque_id = p_estoque_id and vendida_em is null and arquivada_em is null;
  if v_atual < p_quantidade_alvo then
    insert into estoque_unidades (estoque_id, avaria)
    select p_estoque_id, false from generate_series(1, p_quantidade_alvo - v_atual);
    return;
  end if;
  v_sobrando := v_atual - p_quantidade_alvo;
  if v_sobrando = 0 then return; end if;
  select count(*) into v_descartaveis from estoque_unidades u
    where u.estoque_id = p_estoque_id and u.vendida_em is null and u.arquivada_em is null
      and u.nome is null and u.avaria = false and u.avaria_descricao is null
      and u.descricao is null and u.valor is null and u.condicao_nota is null
      and u.fotos = '[]'::jsonb and u.endereco_id is null
      and u.origem_identificacao is null and u.organizada_em is null
      and not exists (select 1 from estoque_reservas r where r.unidade_id = u.id and r.liberada_em is null);
  if v_descartaveis < v_sobrando then
    raise exception 'Reduza a quantidade excluindo as unidades específicas primeiro';
  end if;
  delete from estoque_unidades where id in (
    select u.id from estoque_unidades u
    where u.estoque_id = p_estoque_id and u.vendida_em is null and u.arquivada_em is null
      and u.nome is null and u.avaria = false and u.avaria_descricao is null
      and u.descricao is null and u.valor is null and u.condicao_nota is null
      and u.fotos = '[]'::jsonb and u.endereco_id is null
      and u.origem_identificacao is null and u.organizada_em is null
      and not exists (select 1 from estoque_reservas r where r.unidade_id = u.id and r.liberada_em is null)
    order by u.criado_em desc limit v_sobrando
  );
end;
$$;

revoke all on function reservar_unidade_estoque(uuid,text,timestamptz), liberar_reserva_estoque(uuid),
  arquivar_unidade_estoque(uuid,text), restaurar_unidade_estoque(uuid) from public, anon, authenticated;
grant execute on function reservar_unidade_estoque(uuid,text,timestamptz), liberar_reserva_estoque(uuid),
  arquivar_unidade_estoque(uuid,text), restaurar_unidade_estoque(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
