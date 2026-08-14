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
-- `processado_em` nulo = pendente. As linhas que já existem são marcadas
-- PROCESSADAS aqui, de propósito: a fila começa limpa. A dedupe por
-- (ml_order_id, ml_item_id) só protege venda que nasceu do importador — um
-- pedido do ML que o dono lançou como venda normal no balcão (caminho comum)
-- não tem ml_order_id, não seria pulado, e viraria SEGUNDA venda com SEGUNDA
-- baixa de estoque no primeiro ciclo, possivelmente em lote de madrugada.
-- O backlog não se perde: continua acessível pelo fluxo manual de importação,
-- com a lista na frente do dono — o que é decisão dele, não efeito colateral
-- do deploy.
--
-- Esta migração é idempotente (`if not exists` em tudo, e o update só toca
-- linha pendente) porque é rodada À MÃO em produção no fim de uma fila longa
-- de migrações pendentes: falhar no meio e re-rodar é o caso provável.
--
-- `tentativas` existe pra um pedido quebrado (item apagado no ML, resposta
-- fora do formato esperado) não travar a fila pra sempre: depois do teto que
-- a aplicação define, a linha é marcada processada com o `erro` preservado.
--
-- A forma de pagamento dedicada é requisito do `registrar_venda` (ele exige
-- forma de pagamento) e mantém o caixa separando canal ML de balcão. Natureza
-- 'avista' porque o Mercado Livre repassa o dinheiro — não é fiado.
-- =============================================================================

alter table mercadolivre_notificacoes add column if not exists processado_em timestamptz;
alter table mercadolivre_notificacoes add column if not exists erro text;
alter table mercadolivre_notificacoes add column if not exists tentativas integer not null default 0;

-- Índice parcial: a fila só consulta o que está pendente, e ela encolhe
-- conforme o consumidor trabalha — indexar a tabela inteira seria desperdício.
create index if not exists idx_mercadolivre_notificacoes_pendentes
  on mercadolivre_notificacoes(recebido_em) where processado_em is null;

-- Backlog fecha junto com a migração: o consumidor só enxerga o que chegar
-- DEPOIS daqui. Ver o comentário do cabeçalho — reprocessar o histórico
-- duplicaria as vendas que já foram lançadas na mão.
update mercadolivre_notificacoes set processado_em = now() where processado_em is null;

insert into formas_pagamento (nome, natureza) values ('MERCADO LIVRE', 'avista')
  on conflict (nome) do nothing;

NOTIFY pgrst, 'reload schema';
