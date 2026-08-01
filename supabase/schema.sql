-- =============================================================================
-- RK Sucatas — Schema Supabase (Estoque, Vendas, Caixa)
-- =============================================================================
-- Rode este script no editor SQL do Supabase (SQL Editor > New query) numa
-- instalação NOVA/vazia. Se seu projeto já rodou uma versão anterior deste
-- schema (sem formas_pagamento/storage), use supabase/migration_002_pagamentos_e_imagens.sql
-- em vez de rodar este arquivo de novo. Depois de rodar, configure
-- SUPABASE_SERVICE_ROLE_KEY no .env do backend (Project Settings > API).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas de apoio (categoria, modelo de moto, forma de pagamento) — todas
-- editáveis pela aba Configurações do sistema, sem hardcode no código.
-- -----------------------------------------------------------------------------
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  parent_id uuid references categorias(id) on delete restrict,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  constraint categorias_nao_e_pai_de_si_mesma check (id <> parent_id)
);

-- Nome único só dentro do mesmo nível (mesmo pai), não globalmente — permite
-- por exemplo duas subcategorias "Dianteira" em ramos diferentes da árvore.
create unique index categorias_parent_nome_uidx
  on categorias (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

create index idx_categorias_parent on categorias(parent_id);

-- Árvore por parent_id (mesmo formato de `categorias`): Marca (raiz) >
-- Cilindrada (filho) > Modelo (neto, com ano). estoque/vendas.modelo_moto_id
-- pode apontar pra um nó em qualquer profundidade dessa árvore.
create table modelos_moto (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  parent_id uuid references modelos_moto(id) on delete restrict,
  ordem integer not null default 0,
  ano text,
  criado_em timestamptz not null default now(),
  constraint modelos_moto_nao_e_pai_de_si_mesma check (id <> parent_id)
);

create unique index modelos_moto_parent_nome_uidx
  on modelos_moto (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

create index idx_modelos_moto_parent on modelos_moto(parent_id);

create table formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

insert into formas_pagamento (nome) values
  ('CRÉDITO'), ('DÉBITO'), ('DINHEIRO'), ('MARCELO'), ('PENDÊNCIA'), ('PIX');

-- -----------------------------------------------------------------------------
-- Estoque
-- -----------------------------------------------------------------------------
-- Sequência pro código humano do item (RK-0001, RK-0002...), sem race condition
-- do jeito que o código antigo fazia (escanear o maior código existente).
create sequence estoque_codigo_seq start 1;

create table estoque (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('RK-' || lpad(nextval('estoque_codigo_seq')::text, 4, '0')),
  nome text not null,
  categoria_id uuid references categorias(id),
  modelo_moto_id uuid references modelos_moto(id),
  condicao text not null check (condicao in ('original', 'paralela')),
  ano text,
  valor numeric(10,2) not null default 0,
  quantidade integer not null default 0 check (quantidade >= 0),
  imagem_url text,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_estoque_categoria on estoque(categoria_id);
create index idx_estoque_modelo_moto on estoque(modelo_moto_id);

-- -----------------------------------------------------------------------------
-- Vendas
-- -----------------------------------------------------------------------------
create table vendas (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid references estoque(id) on delete set null,
  nome_item text not null,          -- snapshot do nome do item no momento da venda
  quantidade integer not null default 1 check (quantidade > 0),
  valor_unitario numeric(10,2) not null,
  valor_total numeric(10,2) not null,
  forma_pagamento_id uuid references formas_pagamento(id) on delete set null,
  modelo_moto_id uuid references modelos_moto(id),
  cliente_nome text,
  observacoes text,
  data date not null default current_date,
  criado_em timestamptz not null default now()
);

create index idx_vendas_estoque on vendas(estoque_id);
create index idx_vendas_data on vendas(data);

-- -----------------------------------------------------------------------------
-- Caixa (livro de entradas e saídas)
-- -----------------------------------------------------------------------------
create table caixa (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text not null,
  valor numeric(10,2) not null check (valor > 0),
  forma_pagamento_id uuid references formas_pagamento(id) on delete set null,
  venda_id uuid references vendas(id) on delete set null,
  data date not null default current_date,
  criado_em timestamptz not null default now()
);

create index idx_caixa_data on caixa(data);
create index idx_caixa_venda on caixa(venda_id);

-- -----------------------------------------------------------------------------
-- Trigger genérico de atualizado_em
-- -----------------------------------------------------------------------------
create or replace function set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_estoque_atualizado_em
  before update on estoque
  for each row execute function set_atualizado_em();

-- -----------------------------------------------------------------------------
-- registrar_venda: cria a venda, baixa o estoque e lança a entrada no caixa,
-- tudo em uma transação (evita o bug do sistema antigo, onde vender um item
-- não descontava o estoque).
-- -----------------------------------------------------------------------------
create or replace function registrar_venda(
  p_estoque_id uuid,
  p_quantidade int,
  p_valor_unitario numeric,
  p_forma_pagamento_id uuid,
  p_modelo_moto_id uuid default null,
  p_cliente_nome text default null,
  p_observacoes text default null,
  p_data date default current_date
) returns vendas as $$
declare
  v_nome text;
  v_estoque_atual int;
  v_venda vendas;
begin
  select nome, quantidade into v_nome, v_estoque_atual
  from estoque where id = p_estoque_id
  for update; -- trava a linha até o fim da transação, evita venda concorrente furar o estoque

  if v_estoque_atual is null then
    raise exception 'Item de estoque não encontrado';
  end if;
  if v_estoque_atual < p_quantidade then
    raise exception 'Estoque insuficiente: disponível %, solicitado %', v_estoque_atual, p_quantidade;
  end if;

  update estoque set quantidade = quantidade - p_quantidade where id = p_estoque_id;

  insert into vendas (
    estoque_id, nome_item, quantidade, valor_unitario, valor_total,
    forma_pagamento_id, modelo_moto_id, cliente_nome, observacoes, data
  ) values (
    p_estoque_id, v_nome, p_quantidade, p_valor_unitario, p_quantidade * p_valor_unitario,
    p_forma_pagamento_id, p_modelo_moto_id, p_cliente_nome, p_observacoes, coalesce(p_data, current_date)
  ) returning * into v_venda;

  insert into caixa (tipo, descricao, valor, forma_pagamento_id, venda_id, data)
  values ('entrada', 'Venda: ' || v_nome, v_venda.valor_total, p_forma_pagamento_id, v_venda.id, v_venda.data);

  return v_venda;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- cancelar_venda: devolve a quantidade ao estoque e remove a venda + a entrada
-- de caixa vinculada a ela.
-- -----------------------------------------------------------------------------
create or replace function cancelar_venda(p_venda_id uuid)
returns void as $$
declare
  v_venda vendas;
begin
  select * into v_venda from vendas where id = p_venda_id;
  if v_venda is null then
    raise exception 'Venda não encontrada';
  end if;

  if v_venda.estoque_id is not null then
    update estoque set quantidade = quantidade + v_venda.quantidade where id = v_venda.estoque_id;
  end if;

  delete from caixa where venda_id = p_venda_id;
  delete from vendas where id = p_venda_id;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- Storage: bucket público pras imagens de peças do estoque (upload via anexo,
-- não mais URL colada manualmente). Público de leitura pra <img src> funcionar
-- direto no navegador; escrita só pelo backend (service_role).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('estoque', 'estoque', true)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- RLS: só o backend (usando a service_role key, que ignora RLS por padrão)
-- mexe nessas tabelas. Sem policy nenhuma pra anon/authenticated de propósito —
-- o frontend nunca fala direto com o Supabase, sempre passa pelo Express.
-- -----------------------------------------------------------------------------
alter table categorias enable row level security;
alter table modelos_moto enable row level security;
alter table formas_pagamento enable row level security;
alter table estoque enable row level security;
alter table vendas enable row level security;
alter table caixa enable row level security;
