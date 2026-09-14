-- =============================================================================
-- RK Sucatas — Migração 022: canal da venda + importação de pedidos do
-- Mercado Livre
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 021 aplicadas).
--
-- Diferente das migrations de estoque_unidades/promocoes/etc (tabela extra
-- que um recurso já funcionando enriquece opcionalmente), esta aqui é
-- pré-condição de verdade: sem estas colunas, importar um pedido do Mercado
-- Livre não tem onde gravar canal/id do pedido — não dá pra "degradar" um
-- INSERT que precisa dessas colunas pra existir.
--
-- `ml_order_id`/`ml_item_id`/`ml_shipping_id` como text, não bigint/numeric:
-- mesmo padrão já usado em mercadolivre_conexao.ml_user_id (migration_021).
-- Esses ids nunca entram em conta aritmética aqui, então texto evita
-- qualquer risco de overflow/precisão e mantém o módulo inteiro consistente.
-- =============================================================================

alter table vendas add column canal text not null default 'balcao' check (canal in ('balcao', 'mercado_livre'));
alter table vendas add column ml_order_id text;
alter table vendas add column ml_item_id text;
alter table vendas add column ml_shipping_id text;

-- Nunca colide em vendas de balcão (as duas colunas ficam null ali) — só
-- impede importar o mesmo item do mesmo pedido do ML duas vezes.
create unique index idx_vendas_ml_order_item on vendas(ml_order_id, ml_item_id);

-- Comprador de venda do Mercado Livre já pagou via Mercado Pago antes da
-- venda chegar aqui — nenhuma forma de pagamento existente descreve isso.
-- Continua editável em Configurações como qualquer outra forma de pagamento.
insert into formas_pagamento (nome) values ('MERCADO PAGO') on conflict (nome) do nothing;

NOTIFY pgrst, 'reload schema';
