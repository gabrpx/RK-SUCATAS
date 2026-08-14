# Sincronização de vendas Mercado Livre ↔ estoque

**Data:** 2026-08-14
**Escopo:** Bloco B do pedido de 14/08 — itens 4 e 5 (venda no ML dá baixa no
estoque; venda no estoque ajusta o anúncio no ML).

Os itens 1–3 do mesmo pedido (predefinição de categoria, descrição padrão,
remoção de fundo antecipada) são mudanças pontuais no formulário de
publicação, já aprovadas em conversa e implementadas fora desta spec.

---

## Problema

O módulo do Mercado Livre já lê pedidos, já importa pedido como venda e já
sabe calcular e aplicar o ajuste de preço/quantidade/status de um anúncio.
O que falta em ambas as pontas é o **gatilho**:

- **ML → estoque.** Um pedido pago no Mercado Livre só vira venda quando
  alguém abre a aba, revisa a lista e clica importar. Até lá o estoque está
  mentindo: a peça continua contada como disponível, pode ser vendida de novo
  no balcão, e o caixa do dia não fecha com a realidade.
- **Estoque → ML.** Quando a peça sai pelo balcão, o anúncio no Mercado Livre
  continua anunciando quantidade que não existe mais. Hoje existe um toast
  "Sincronizar agora" ([VendasView.tsx:392](../../../src/features/vendas/VendasView.tsx))
  que abre a revisão já apontando pra peça vendida — mas ele é efêmero e
  local: some ao trocar de aba, não existe pra quem vendeu de outro aparelho,
  e não existe pra venda que nasceu de outro caminho (orçamento aprovado,
  importação automática de pedido do ML).

## Decisões

Tomadas com o usuário antes desta spec, e elas moldam tudo abaixo:

1. **Assimetria deliberada de automação.** ML → estoque roda sozinho; estoque
   → ML nunca roda sozinho. A razão é o raio do estrago: baixa de estoque é
   dado interno e reversível (cancelar venda já existe e já estorna); mutação
   de anúncio muda a vitrine real da loja pra qualquer comprador, e continua
   valendo a regra antiga de revisão com checkbox antes de aplicar.
2. **Forma de pagamento fixa pro canal.** Toda venda importada automaticamente
   entra numa forma de pagamento dedicada, `MERCADO LIVRE`, de natureza
   `avista`. Sem ela o `registrar_venda` não roda, e escolher uma forma
   existente ("PIX") misturaria canal ML com balcão no caixa.
3. **Nada é inventado.** Pedido que não casa com peça nenhuma do estoque, ou
   que casa com peça sem saldo, nunca vira venda automática — vira notificação
   pra resolver na mão.

## Arquitetura

### Parte 1 — consumidor de fila (ML → estoque)

Hoje duas fontes escrevem em `mercadolivre_notificacoes` e ninguém consome:
o webhook (`mercadolivreWebhookHandler`, tempo real) e o polling de 5 minutos
(`verificarNotificacoesPendentes`, rede de segurança contra webhook perdido e
contra hibernação do Render free). A tabela já tem índice único por
`(topic, resource)`, então o mesmo pedido visto pelas duas fontes é uma linha
só.

A migração transforma essa tabela em fila: `processado_em` e `erro`. O
consumidor novo (`processarPedidosPendentes`, em `mercadolivreSync.ts`, chamado
pelo scheduler que já existe) faz, a cada ciclo:

1. Lê as linhas `topic = 'orders_v2'` com `processado_em is null`, mais
   antigas primeiro, em lote limitado (20 por ciclo — teto de segurança contra
   rajada, e o que sobrar entra no ciclo seguinte).
2. Pra cada linha, extrai o id do pedido do `resource` (`/orders/{id}`) e busca
   o pedido na API. **Isso exige uma função nova** em `mercadolivreApi.ts`:
   `buscarPedido(token, orderId)` — hoje só existe busca por lista.
3. Decide o que fazer com o pedido que não está `paid`, distinguindo status
   **terminal** de **transitório** — a distinção é obrigatória, não detalhe:
   - `cancelled`/`invalid` (e pedido apagado, que a API devolve como 404):
     nunca mais mudam, então marca processado e descarta.
   - `payment_required`/`payment_in_process`/`confirmed`: o pagamento ainda
     pode ser aprovado (pix atrasado, boleto, análise de fraude). A linha
     **não** é marcada processada — fica pendente pro próximo ciclo. Marcar
     processado aqui perderia a venda em silêncio: o webhook enfileira a
     notificação do pedido recém-criado, e a segunda notificação do MESMO
     `resource` (quando o pagamento aprova) cai no `upsert(..., {
     ignoreDuplicates: true })`, que é `ON CONFLICT DO NOTHING` e **não**
     reabre a linha existente.
   - Teto de 7 dias contados do `recebido_em` pra esse reprocessamento, senão
     checkout abandonado vira linha eterna consumindo uma chamada de API por
     ciclo. Estourou o teto: marca processado com `erro` dizendo que o pedido
     nunca foi pago.

   Pedido cujo vendedor não é a conta conectada também é descartado.
4. Pra cada linha do pedido, resolve a peça pelo mapa `mlbId → estoque` que já
   existe (`construirMapaEstoquePorMlb`) e chama `importarPedidoComoVenda`,
   que já é idempotente por `(ml_order_id, ml_item_id)`.
5. Marca `processado_em`. Em falha, grava `erro` e **não** marca processado, pra
   o ciclo seguinte tentar de novo; depois de 5 tentativas marca processado com
   o erro preservado, pra um pedido quebrado não travar a fila pra sempre.

**Variações.** `buscarPreviewPedidos` casa pedido com peça só pelo `mlbId`,
ignorando `variation_id`. Desde que a publicação com variações existe, isso
significa que um pedido de uma ficha específica é registrado como venda
genérica da peça-mãe, sem saber qual unidade saiu. O consumidor resolve
`order_items[].item.variation_id` contra `estoque_anuncios_ml_variacoes.
ml_variation_id` (migração 043) pra achar o `unidade_id`, e grava esse vínculo
na venda (`vendas.unidade_id`, migração 038). Quando o pedido não tem variação,
o comportamento é o de hoje.

**Notificação.** Toda importação bem-sucedida dispara push (`notificarUsuarios`)
pros usuários ativos com papel `admin` ou `equipe` — mesmo público e mesmo
serviço do aviso diário existente. Texto agrega por ciclo ("2 peças vendidas no
Mercado Livre — baixa dada no estoque") e aponta pra aba do Mercado Livre.

**Casos que viram notificação em vez de venda:** pedido sem peça
correspondente ("Pedido X no ML não casou com nenhuma peça — registre na mão");
peça sem saldo; pedido cancelado no ML depois de já importado (aviso, nunca
estorno automático — cancelar venda continua sendo decisão humana).

### Parte 2 — gatilho na venda (estoque → ML)

`registrar_venda` é uma RPC do banco chamada por várias rotas (venda direta,
orçamento aprovado, e agora o consumidor da Parte 1). O gatilho vive **depois**
da RPC, em um único ponto compartilhado (`avisarAnunciosDesatualizados`, em
`mercadolivreSync.ts`), chamado por quem registra a venda:

1. Recebe os `estoque_id` afetados.
2. Pergunta se algum deles tem anúncio ML vinculado (`estoque_anuncios_ml`, com
   o mesmo fallback pro link legado que o resto do arquivo já faz).
3. Se tiver, dispara push: "1 anúncio no Mercado Livre precisa de ajuste" com
   destino que abre a revisão de sincronização já focada nessas peças —
   `useSincronizacaoMl().abrir(estoqueIds)` já aceita exatamente isso.
4. O usuário revisa a lista com checkbox e aplica. **Nenhuma lógica nova de
   ML:** `aplicarSincronizacao` já calcula a quantidade a partir do estoque e
   já manda `status: 'paused'` quando ela zera.

Isso não substitui o toast que já existe — o toast continua sendo o caminho
mais rápido pra quem está com a tela aberta. O push cobre o resto: outro
aparelho, outra aba, venda que nasceu do consumidor automático.

**Cuidado com laço.** Uma venda importada do ML também afeta os *outros*
anúncios da mesma peça (o anúncio vendido o próprio ML já decrementa). O
gatilho roda igual, e a notificação é agregada por ciclo do consumidor, nunca
uma por pedido — senão uma tarde movimentada vira uma enxurrada de push.

## Migração 044

Aditiva, no mesmo estilo das anteriores, e com degradação graciosa: enquanto
não rodar, o consumidor detecta a coluna ausente, loga um aviso e não importa
nada — o fluxo manual de importação continua idêntico ao de hoje.

```sql
alter table mercadolivre_notificacoes add column processado_em timestamptz;
alter table mercadolivre_notificacoes add column erro text;
alter table mercadolivre_notificacoes add column tentativas integer not null default 0;

create index idx_mercadolivre_notificacoes_pendentes
  on mercadolivre_notificacoes(recebido_em) where processado_em is null;

insert into formas_pagamento (nome, natureza) values ('MERCADO LIVRE', 'avista')
  on conflict (nome) do nothing;
```

Linhas antigas ficam com `processado_em` nulo, ou seja, entram na fila. Isso é
proposital: são pedidos das últimas semanas que talvez nunca tenham sido
importados. A dedupe por `(ml_order_id, ml_item_id)` garante que os já
importados sejam pulados sem virar venda duplicada.

## Testes

Seguindo o padrão do módulo (`mercadolivrePublicacao.test.ts`), com Supabase e
API do ML fingidos:

- Pedido pago casando com peça → uma venda, canal `mercado_livre`, forma
  `MERCADO LIVRE`, linha marcada processada.
- Mesmo pedido processado duas vezes → uma venda só (idempotência).
- Pedido cancelado → marcado processado, nenhuma venda.
- Pedido pendente de pagamento → linha intocada, nenhuma venda; passados 7 dias
  do `recebido_em`, marcado processado com o erro explicando.
- Pedido sem match → nenhuma venda, notificação disparada, linha processada.
- Pedido de variação → venda com `unidade_id` correto.
- Falha da API → linha não marcada, `tentativas` incrementado; na 5ª, processada
  com erro preservado.
- Migração ausente → consumidor não lança e não importa.
- `avisarAnunciosDesatualizados`: peça com anúncio → notifica; sem anúncio →
  silêncio.

## Fora de escopo

- Estorno automático de venda quando o pedido é cancelado no ML (vira aviso).
- Tela de administração da fila de notificações — `erro` fica no banco e no log
  do servidor; se virar necessidade recorrente, aí sim ganha tela.
- Reconciliação retroativa de vendas antigas do ML sem `unidade_id`.
- Qualquer mutação automática de anúncio, inclusive pausar.

## Pendências operacionais

- Migração 044 precisa rodar no Supabase de produção (soma-se às 022–043 já
  pendentes, que devem rodar em ordem antes desta).
- Patch notes atualizados em `src/features/patchnotes/data.ts` ao fim da
  implementação.
