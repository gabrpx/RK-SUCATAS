-- =============================================================================
-- RK Sucatas — Migração 044: fila de pedidos do Mercado Livre
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 043 aplicadas, em ordem — esta depende da 022
-- (vendas.ml_order_id), da 023 (mercadolivre_notificacoes), da 030
-- (formas_pagamento.natureza) e da 038 (vendas.unidade_id)).
--
-- `mercadolivre_notificacoes` nasceu (migração 023) como log auxiliar de
-- "houve atividade recente": webhook e polling escrevem, e ninguém lê além
-- de um indicador visual. Estas colunas a promovem a FILA — um consumidor no
-- scheduler processa cada linha de pedido uma única vez, transformando
-- pedido pago em venda com baixa de estoque.
--
-- `processado_em` nulo = pendente. Linhas antigas nascem pendentes de
-- propósito: são pedidos das últimas semanas que talvez nunca tenham sido
-- importados. Quem já virou venda é pulado pelo índice único de
-- (ml_order_id, ml_item_id) em `vendas` (migração 022), então reprocessar é
-- seguro por construção.
--
-- `tentativas` existe pra um pedido quebrado (item apagado no ML, resposta
-- fora do formato esperado) não travar a fila pra sempre: depois do teto que
-- a aplicação define, a linha é marcada processada com o `erro` preservado.
--
-- A forma de pagamento dedicada é requisito do `registrar_venda` (ele exige
-- forma de pagamento) e mantém o caixa separando canal ML de balcão. Natureza
-- 'avista' porque o Mercado Livre repassa o dinheiro — não é fiado.
-- =============================================================================

alter table mercadolivre_notificacoes add column processado_em timestamptz;
alter table mercadolivre_notificacoes add column erro text;
alter table mercadolivre_notificacoes add column tentativas integer not null default 0;

-- Índice parcial: a fila só consulta o que está pendente, e ela encolhe
-- conforme o consumidor trabalha — indexar a tabela inteira seria desperdício.
create index idx_mercadolivre_notificacoes_pendentes
  on mercadolivre_notificacoes(recebido_em) where processado_em is null;

insert into formas_pagamento (nome, natureza) values ('MERCADO LIVRE', 'avista')
  on conflict (nome) do nothing;

NOTIFY pgrst, 'reload schema';
