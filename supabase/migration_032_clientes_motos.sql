-- =============================================================================
-- RK Sucatas — Migração 032: motos vinculadas ao cliente
-- =============================================================================
-- Rode isso no editor SQL do Supabase, depois da migration_027 (depende de
-- clientes) — não depende de nenhuma migration da Fase 2.
--
-- clientes_motos é uma entidade nova, distinta de modelos_moto (que continua
-- sendo só o catálogo/taxonomia usado pra classificar peças e vendas —
-- "essa peça serve nesse modelo"). Aqui é o inverso: "o Fulano tem essa moto
-- física", com dados do veículo (placa, chassi, ano, cor) que não fazem
-- sentido dentro do catálogo. modelo_moto_id é opcional só pra reaproveitar
-- marca/modelo já cadastrados quando existir; sem ele, os campos livres
-- (placa/chassi/ano/cor) ainda bastam pra identificar a moto.
-- =============================================================================

create table clientes_motos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  modelo_moto_id uuid references modelos_moto(id) on delete set null,
  placa text,
  chassi text,
  ano text,
  cor text,
  observacoes text,
  criado_em timestamptz not null default now()
);

create index idx_clientes_motos_cliente on clientes_motos(cliente_id);

alter table clientes_motos enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
