-- =============================================================================
-- RK Sucatas — Migração 033: peças procuradas
-- =============================================================================
-- Rode isso no editor SQL do Supabase, depois da migration_027 (depende de
-- clientes) — não depende de nenhuma outra migration da Fase 2.
--
-- Registra o pedido de um cliente por algo que não tinha em estoque no
-- momento. O match automático que fecha o ciclo (vira tarefa quando uma peça
-- compatível é cadastrada) roda no POST /api/estoque — ver
-- src/server/routes/estoque.ts — e marca o pedido como 'atendida' sozinho;
-- essa migration só cria a tabela.
--
-- categoria_id/modelo_moto_id são os filtros do match: ambos opcionais, mas
-- pelo menos um informado na prática (senão o match casaria com qualquer
-- peça nova). Índice parcial em status='aguardando' porque é exatamente
-- onde o match consulta a cada peça criada.
-- =============================================================================

create table pecas_procuradas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nome text,
  descricao text not null,
  categoria_id uuid references categorias(id) on delete set null,
  modelo_moto_id uuid references modelos_moto(id) on delete set null,
  status text not null default 'aguardando' check (status in ('aguardando', 'atendida', 'cancelada')),
  criado_por uuid not null references usuarios(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atendida_em timestamptz
);

create index idx_pecas_procuradas_cliente on pecas_procuradas(cliente_id);
create index idx_pecas_procuradas_aguardando on pecas_procuradas(status) where status = 'aguardando';

alter table pecas_procuradas enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
