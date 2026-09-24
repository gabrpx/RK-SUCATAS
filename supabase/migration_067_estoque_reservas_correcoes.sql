-- Correções da 066 (já aplicada). Aplicar DEPOIS da 066, primeiro em homologação.
-- Não altera dados existentes.
--  1. estoque_reservas.unidade_id era ON DELETE RESTRICT: como estoque_unidades
--     cascateia de estoque, peça com qualquer histórico de reserva (mesmo
--     liberada) não podia ser excluída, e sincronizar_unidades_estoque quebrava
--     ao apagar ficha em branco com reserva antiga. Passa a CASCADE, e um
--     trigger impede excluir ficha com reserva ATIVA (direto, cascata ou sync).
--  2. Sincronização considerava reserva vencida-não-liberada como ativa.
--  3. search_path fixo em todas as funções de reserva/arquivamento.
--  4. Reserva pode ser vinculada a um cliente cadastrado (clientes.id). Com
--     cliente, `responsavel` passa a ser o nome do cadastro quando não for
--     informado. Cliente banido não pode reservar. Sem cliente, continua
--     valendo o nome livre em `responsavel` (cliente de balcão sem cadastro).
begin;

alter table estoque_reservas drop constraint estoque_reservas_unidade_id_fkey;
alter table estoque_reservas add constraint estoque_reservas_unidade_id_fkey
  foreign key (unidade_id) references estoque_unidades(id) on delete cascade;

create function bloquear_exclusao_unidade_reservada() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from estoque_reservas r where r.unidade_id = old.id
    and r.liberada_em is null and r.reservada_ate > now()) then
    raise exception 'Unidade reservada: libere a reserva antes de excluir';
  end if;
  return old;
end;
$$;
create trigger trg_bloquear_exclusao_unidade_reservada before delete on estoque_unidades
  for each row execute function bloquear_exclusao_unidade_reservada();

create or replace function validar_quantidade_reservada() returns trigger
language plpgsql set search_path = public as $$
declare v_reservadas int;
begin
  if new.quantidade >= old.quantidade then return new; end if;
  select count(*) into v_reservadas from estoque_reservas r
    join estoque_unidades u on u.id = r.unidade_id
    where u.estoque_id = old.id and u.vendida_em is null and u.arquivada_em is null
      and r.liberada_em is null and r.reservada_ate > now();
  if new.quantidade < v_reservadas then
    raise exception 'Peça com unidade reservada: libere a reserva antes de vender ou baixar a quantidade';
  end if;
  return new;
end;
$$;

alter function validar_saida_unidade_estoque() set search_path = public;
alter function liberar_reserva_estoque(uuid) set search_path = public;
alter function arquivar_unidade_estoque(uuid, text) set search_path = public;
alter function restaurar_unidade_estoque(uuid) set search_path = public;

create or replace function sincronizar_unidades_estoque(p_estoque_id uuid, p_quantidade_alvo int)
returns void language plpgsql set search_path = public as $$
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
      and not exists (select 1 from estoque_reservas r where r.unidade_id = u.id
        and r.liberada_em is null and r.reservada_ate > now());
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
      and not exists (select 1 from estoque_reservas r where r.unidade_id = u.id
        and r.liberada_em is null and r.reservada_ate > now())
    order by u.criado_em desc limit v_sobrando
  );
end;
$$;

-- 4. Vínculo opcional com clientes. ON DELETE SET NULL preserva a reserva
-- (e o nome gravado em responsavel) se o cadastro for excluído.
alter table estoque_reservas add column cliente_id uuid references clientes(id) on delete set null;
create index idx_estoque_reservas_cliente on estoque_reservas(cliente_id) where cliente_id is not null;

-- Assinatura muda (novo parâmetro): remove a de 3 argumentos para não
-- deixar duas sobrecargas ambíguas no PostgREST.
drop function reservar_unidade_estoque(uuid, text, timestamptz);
create function reservar_unidade_estoque(p_unidade_id uuid, p_responsavel text, p_ate timestamptz, p_cliente_id uuid default null)
returns estoque_reservas language plpgsql security invoker set search_path = public as $$
declare v_estoque_id uuid; v_unidade estoque_unidades; v_reserva estoque_reservas;
  v_cliente_nome text; v_cliente_banido boolean; v_responsavel text;
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
  insert into estoque_reservas (unidade_id, responsavel, reservada_ate, cliente_id)
    values (p_unidade_id, v_responsavel, p_ate, p_cliente_id) returning * into v_reserva;
  return v_reserva;
end;
$$;
revoke all on function reservar_unidade_estoque(uuid, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function reservar_unidade_estoque(uuid, text, timestamptz, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
