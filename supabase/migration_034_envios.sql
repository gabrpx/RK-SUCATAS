-- =============================================================================
-- RK Sucatas — Migração 034: envios
-- =============================================================================
-- Rode isso no editor SQL do Supabase (depende de clientes, vendas, usuarios
-- — não depende de nenhuma outra migration da Fase 2).
--
-- Até aqui a aba Frete era só uma calculadora de cotação (Melhor Envio),
-- sem persistir nada. Esta tabela é o registro de "isso foi de fato
-- enviado" — cliente, transportadora, código de rastreio, status.
--
-- melhor_envio_order_id é separado de codigo_rastreio de propósito: rastreio
-- automático via API do Melhor Envio só funciona pra envios comprados
-- através dela (não pra um código colado de qualquer transportadora) — sem
-- melhor_envio_order_id, o envio funciona 100% no modo manual (ver
-- src/server/routes/envios.ts).
-- =============================================================================

create table envios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nome text,
  venda_id uuid references vendas(id) on delete set null,
  transportadora text,
  servico text,
  codigo_rastreio text,
  melhor_envio_order_id text,
  cep_destino text,
  valor_frete numeric(10,2),
  status text not null default 'aguardando_postagem'
    check (status in ('aguardando_postagem', 'postado', 'em_transito', 'entregue', 'problema', 'cancelado')),
  status_detalhe text,
  status_atualizado_em timestamptz,
  criado_por uuid references usuarios(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_envios_cliente on envios(cliente_id);
create index idx_envios_venda on envios(venda_id);
create index idx_envios_status on envios(status);

create trigger trg_envios_atualizado_em
  before update on envios
  for each row execute function set_atualizado_em();

alter table envios enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
