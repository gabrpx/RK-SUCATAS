-- =============================================================================
-- RK Sucatas — Migração 035: vínculo do cliente com o comprador do ML
-- =============================================================================
-- Rode isso no editor SQL do Supabase, depois da migration_027 (depende de
-- clientes) — não depende de nenhuma outra migration da Fase 2.
--
-- Sem matching automático de propósito (mesma regra já registrada pro resto
-- da integração ML: sync sempre disparado por ação humana). Isso só guarda
-- o nickname/id do comprador quando a equipe vincula manualmente um cliente
-- cadastrado a um pedido do Mercado Livre na hora de importar — ver
-- src/features/mercadolivre/MercadoLivreView.tsx.
-- =============================================================================

alter table clientes add column ml_nickname text;
alter table clientes add column ml_buyer_id bigint;

create unique index idx_clientes_ml_buyer_id on clientes(ml_buyer_id) where ml_buyer_id is not null;

NOTIFY pgrst, 'reload schema';
