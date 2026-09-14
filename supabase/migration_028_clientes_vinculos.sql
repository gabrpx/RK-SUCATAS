-- =============================================================================
-- RK Sucatas — Migração 028: vínculo de cliente em vendas/orçamentos/tarefas
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 027 aplicadas — depende da tabela clientes da 027).
--
-- Só colunas aditivas/nullable — zero mudança de comportamento até o backend
-- passar a preenchê-las (ver migration_029 pra registrar_venda, e
-- src/server/routes/{vendas,orcamentos,tarefas}.ts pro resto).
--
-- cliente_nome/cliente_telefone em vendas/orcamentos CONTINUAM como estão —
-- vínculo por cliente_id só vale daqui pra frente, sem tentativa automática
-- de casar histórico antigo (decisão de produto: nomes parecidos podem ser
-- pessoas diferentes).
-- =============================================================================

alter table vendas add column cliente_id uuid references clientes(id) on delete set null;
create index idx_vendas_cliente on vendas(cliente_id);

alter table orcamentos add column cliente_id uuid references clientes(id) on delete set null;
create index idx_orcamentos_cliente on orcamentos(cliente_id);

alter table tarefas add column cliente_id uuid references clientes(id) on delete set null;
alter table tarefas add column prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta'));
alter table tarefas add column tipo text not null default 'geral' check (tipo in ('geral', 'visita'));
-- Parcial: a maioria das tarefas continuará sem cliente vinculado.
create index idx_tarefas_cliente on tarefas(cliente_id) where cliente_id is not null;

NOTIFY pgrst, 'reload schema';
