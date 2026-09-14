-- =============================================================================
-- RK Sucatas — Migração 007: Orçamentos
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 006 aplicadas).
--
-- Camada de conveniência/rastreabilidade sobre estoque+vendas — NÃO é uma
-- segunda fonte de verdade de estoque (isso continua 100% garantido por
-- registrar_venda/cancelar_venda, sem alteração de assinatura). Um orçamento
-- vira venda(s) real(is) linha a linha através de registrar_venda; orçamento
-- nunca mexe em estoque direto.
--
-- Regra de status: orcamentos.status só vira 'convertido' quando TODA linha
-- de orcamento_itens tiver venda_id preenchido. Uma venda de "só uma parte"
-- (componente) fica linkada via vendas.orcamento_item_id mas não seta o
-- venda_id da linha — o orçamento continua 'aberto', mostrando progresso
-- parcial. Isso é recalculado pelo Express a cada venda, não por trigger.
-- =============================================================================

create sequence orcamento_codigo_seq start 1;

create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('ORC-' || lpad(nextval('orcamento_codigo_seq')::text, 4, '0')),
  cliente_nome text not null,
  cliente_telefone text,
  desconto_tipo text check (desconto_tipo in ('fixo', 'percentual')),
  desconto_valor numeric(10,2) not null default 0,
  observacoes text,
  validade date,
  status text not null check (status in ('aberto', 'convertido', 'cancelado')) default 'aberto',
  cancelado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_orcamentos_status on orcamentos(status);

create table orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references orcamentos(id) on delete cascade,
  -- on delete set null: linha sobrevive à exclusão do item de estoque
  -- (snapshot, igual vendas.nome_item/estoque_id).
  estoque_id uuid references estoque(id) on delete set null,
  nome_item text not null,               -- snapshot do nome no momento do orçamento
  -- Snapshot de estoque.componentes na hora da cotação — garante que a UI
  -- ainda ofereça "vender só: X" mesmo que o item de estoque mude depois.
  componentes_disponiveis jsonb,
  componente text,                       -- preenchido se esta linha foi cotada como só uma parte
  quantidade integer not null default 1 check (quantidade > 0),
  valor_unitario numeric(10,2) not null default 0,  -- livre, independente de estoque.valor
  venda_id uuid references vendas(id) on delete set null,  -- setado quando a linha inteira vira venda
  criado_em timestamptz not null default now()
);

create index idx_orcamento_itens_orcamento on orcamento_itens(orcamento_id);
create index idx_orcamento_itens_estoque on orcamento_itens(estoque_id);
create index idx_orcamento_itens_venda on orcamento_itens(venda_id);

-- Rastreia de qual linha do orçamento uma venda veio (sem mexer na assinatura
-- de registrar_venda — o Express seta isso num update logo após a RPC).
alter table vendas add column orcamento_item_id uuid references orcamento_itens(id) on delete set null;

create trigger trg_orcamentos_atualizado_em
  before update on orcamentos
  for each row execute function set_atualizado_em();

alter table orcamentos enable row level security;
alter table orcamento_itens enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessas tabelas, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
