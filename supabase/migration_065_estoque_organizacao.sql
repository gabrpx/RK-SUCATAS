-- Organização física do estoque. Aplicar depois da migration_064.
-- Não cria prateleiras fictícias nem altera endereços de unidades existentes.
begin;

create table estoque_locais (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (length(trim(codigo)) between 2 and 32),
  deposito text not null default 'Principal' check (length(trim(deposito)) > 0),
  zona text not null default 'Geral' check (length(trim(zona)) > 0),
  prateleira text not null check (length(trim(prateleira)) > 0),
  secao text not null check (length(trim(secao)) > 0),
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (deposito, zona, prateleira, secao)
);

create trigger trg_estoque_locais_atualizado_em
  before update on estoque_locais
  for each row execute function set_atualizado_em();

create table estoque_local_categorias (
  local_id uuid not null references estoque_locais(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  prioridade smallint not null default 1 check (prioridade between 1 and 3),
  primary key (local_id, categoria_id)
);
create index idx_estoque_local_categorias_categoria on estoque_local_categorias(categoria_id);

alter table estoque_unidades
  add column endereco_id uuid references estoque_locais(id) on delete restrict,
  add column origem_identificacao text,
  add column arquivada_em timestamptz,
  add column motivo_arquivamento text,
  add column organizada_em timestamptz;
create index idx_estoque_unidades_endereco on estoque_unidades(endereco_id) where endereco_id is not null;
create index idx_estoque_unidades_organizada_em on estoque_unidades(organizada_em) where organizada_em is not null;

create function registrar_organizacao_unidade() returns trigger language plpgsql as $$
begin
  if new.endereco_id is distinct from old.endereco_id and new.endereco_id is not null then
    new.organizada_em := now();
  end if;
  return new;
end;
$$;
create trigger trg_registrar_organizacao_unidade
  before update on estoque_unidades
  for each row execute function registrar_organizacao_unidade();

-- A sincronização histórica removia fichas em branco. Agora endereço,
-- origem e arquivamento também tornam uma ficha não descartável.
create or replace function sincronizar_unidades_estoque(p_estoque_id uuid, p_quantidade_alvo int)
returns void language plpgsql as $$
declare
  v_atual int;
  v_sobrando int;
  v_descartaveis int;
begin
  if p_quantidade_alvo < 0 then raise exception 'Quantidade não pode ser negativa'; end if;
  select count(*) into v_atual from estoque_unidades
    where estoque_id = p_estoque_id and vendida_em is null;
  if v_atual < p_quantidade_alvo then
    insert into estoque_unidades (estoque_id, avaria)
    select p_estoque_id, false from generate_series(1, p_quantidade_alvo - v_atual);
    return;
  end if;
  v_sobrando := v_atual - p_quantidade_alvo;
  if v_sobrando = 0 then return; end if;
  select count(*) into v_descartaveis from estoque_unidades
    where estoque_id = p_estoque_id and vendida_em is null and arquivada_em is null
      and nome is null and avaria = false and avaria_descricao is null
      and descricao is null and valor is null and condicao_nota is null
      and fotos = '[]'::jsonb and endereco_id is null
      and origem_identificacao is null and organizada_em is null;
  if v_descartaveis < v_sobrando then
    raise exception 'Reduza a quantidade excluindo as unidades específicas primeiro';
  end if;
  delete from estoque_unidades where id in (
    select id from estoque_unidades
    where estoque_id = p_estoque_id and vendida_em is null and arquivada_em is null
      and nome is null and avaria = false and avaria_descricao is null
      and descricao is null and valor is null and condicao_nota is null
      and fotos = '[]'::jsonb and endereco_id is null
      and origem_identificacao is null and organizada_em is null
    order by criado_em desc limit v_sobrando
  );
end;
$$;

-- A inclusão de uma peça física incrementa quantidade e cria sua ficha na
-- mesma transação. O POST anterior tentava inserir uma ficha adicional quando
-- a quantidade já estava totalmente representada (migration_057).
create function adicionar_unidade_estoque(p_estoque_id uuid, p_payload jsonb)
returns estoque_unidades language plpgsql security invoker as $$
declare
  v_quantidade int;
  v_unidade estoque_unidades;
begin
  select quantidade into v_quantidade from estoque where id = p_estoque_id for update;
  if v_quantidade is null then raise exception 'Peça não encontrada'; end if;
  insert into estoque_unidades (
    estoque_id, nome, avaria, avaria_descricao, descricao, fotos, valor,
    condicao_nota, endereco_id, origem_identificacao, organizada_em
  ) values (
    p_estoque_id,
    nullif(trim(p_payload->>'nome'), ''),
    coalesce((p_payload->>'avaria')::boolean, false),
    nullif(trim(p_payload->>'avaria_descricao'), ''),
    nullif(trim(p_payload->>'descricao'), ''),
    coalesce(p_payload->'fotos', '[]'::jsonb),
    (p_payload->>'valor')::numeric,
    (p_payload->>'condicao_nota')::smallint,
    nullif(p_payload->>'endereco_id', '')::uuid,
    nullif(trim(p_payload->>'origem_identificacao'), ''),
    case when p_payload->>'endereco_id' is not null then now() else null end
  ) returning * into v_unidade;
  update estoque set quantidade = v_quantidade + 1 where id = p_estoque_id;
  return v_unidade;
end;
$$;
revoke all on function adicionar_unidade_estoque(uuid, jsonb) from public, anon, authenticated;
grant execute on function adicionar_unidade_estoque(uuid, jsonb) to service_role;

-- Somente o backend com service role acessa estas tabelas, como no estoque.
alter table estoque_locais enable row level security;
alter table estoque_local_categorias enable row level security;
revoke all on estoque_locais, estoque_local_categorias from anon, authenticated;
notify pgrst, 'reload schema';
commit;
