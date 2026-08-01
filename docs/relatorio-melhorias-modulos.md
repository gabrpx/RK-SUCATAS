# Relatório de melhorias por módulo

> Gerado em 31/07/2026 a partir de leitura direta do código (frontend, backend
> e schema). Objetivo: guiar decisões futuras de implementação — nada aqui foi
> implementado ainda, é só diagnóstico + opinião sobre onde vale investir.

## Observações estruturais (afetam vários módulos ao mesmo tempo)

Antes de ir módulo a módulo, tem 3 coisas na base do sistema que limitam o que
qualquer módulo individual pode fazer:

**1. Não existe campo de custo em lugar nenhum.** `Estoque.valor` é um preço
único (usado tanto pra "valor em estoque" no Dashboard quanto como preço de
venda padrão). Sem um `valor_custo`, é estruturalmente impossível calcular
margem, lucro real, ou "menor preço aceitável" — isso não é um problema de UI,
é um buraco no schema que bloqueia a métrica de negócio mais óbvia (quanto
você realmente lucra). Seria a mudança de maior alavancagem do sistema
inteiro: um campo novo que destrava Dashboard (lucro real, não só
faturamento), Vendas (margem por venda) e relatórios futuros.

**2. Login é uma senha única compartilhada, sem conceito de usuário.**
Resolvemos isso de propósito recentemente (destravou o deploy no Render), mas
vale registrar como limitação: não dá pra saber quem vendeu o quê, não dá pra
restringir quem mexe no caixa vs. quem só vê estoque, não dá pra ter uma
"vendedora Fulana" vs "dono". Se a loja crescer para mais de uma pessoa
operando o sistema, isso vai doer.

**3. Não existe exportação/relatório em lugar nenhum.** Nenhuma dependência de
PDF/CSV/Excel no projeto, nenhum botão de exportar em Estoque, Vendas ou
Caixa. Hoje, se o contador ou o dono quiser os dados fora do sistema, não tem
como — teria que copiar manualmente.

Um quarto ponto, técnico: o app mobile (Capacitor/Android) aponta pro Google
Cloud Run (`PROD_URL` fixo em `src/utils/api.ts`), enquanto a web aponta pro
Render. Depois da separação de projetos que fizemos, vale confirmar se o app
Android ainda deveria existir/ser mantido, e se sim, apontar pro mesmo backend
que a web usa — hoje são dois backends diferentes servindo o mesmo app.

Outros pontos técnicos observados durante a análise (menor prioridade, mas
vale registrar):
- Nenhum teste automatizado no projeto (sem vitest/jest/playwright).
- Bundle do frontend é um chunk único de ~950kB (sem `React.lazy`/code
  splitting das views) — o build já avisa sobre isso.
- `DataContext` carrega estoque/vendas/caixa inteiros na memória e faz
  polling a cada 10s independente da aba ativa — funciona bem no volume atual,
  mas não escala indefinidamente.

---

## Dashboard

**O que tem:** 4 cards (valor em estoque, vendas do mês, saídas do mês, ticket
médio), aviso de estoque baixo (≤2 un., fixo no código), gráfico de
entradas/saídas dos últimos 30 dias, pizza de vendas por forma de pagamento,
últimas vendas/itens.

**Onde investir:**
- **Lucro real, não só faturamento** — depende do campo de custo (ver
  observação estrutural #1), mas seria o upgrade mais impactante do dashboard
  inteiro.
- **Comparação com o mês anterior** (seta de alta/queda) — os ícones
  `TrendingUp`/`TrendingDown` já estão importados, só `TrendingDown` é usado
  hoje. Mudança pequena, efeito visual grande.
- **Itens parados/mais vendidos** — os dados já estão todos na memória
  (`vendas`, `estoque`), só falta agregar por frequência. "Essas 5 peças não
  vendem há 60+ dias" é o tipo de insight que ajuda a decidir
  promoção/desconto.
- **Saldo de caixa como card** — hoje só mostra saídas do mês; o saldo
  (entradas − saídas) nunca aparece como número isolado, só dentro do
  gráfico.

## Estoque

**O que tem:** busca com múltiplos filtros, ordenação, paginação, visão
tabela/cards, operações em massa (excluir, +1/-1 de quantidade, trocar
categoria), upload de 1 foto por item com limpeza automática da antiga,
detecção automática de categoria pelo nome digitado, filtro por categoria já
entendendo subcategorias.

**Onde investir:**
- **Quantidade mínima configurável por item** (hoje o "estoque baixo" é um
  número fixo de 2, só visível no Dashboard — não dentro do próprio Estoque,
  nem por peça).
- **Campo de custo** (ver observação estrutural #1).
- **Múltiplas fotos por item** — pra peça usada, "várias fotos do estado
  real" é mais relevante que pra produto novo; hoje é só uma.
- **Importação em massa (CSV/planilha)** — cadastrar peça por peça é o único
  caminho hoje; se o volume de estoque crescer, isso vira o gargalo
  operacional.
- Caminho morto encontrado: `estoqueApi.atualizarParcial` existe no código
  mas nunca é chamado — não é urgente, só uma limpeza futura.

## Vendas

**O que tem:** venda atômica (baixa estoque + lança caixa numa transação só
via função no banco), cancelamento que reverte tudo, filtro por
período/forma de pagamento/busca, nome do item é "congelado" no momento da
venda (não muda se o item for renomeado depois).

**Onde investir:**
- **Múltiplos itens por venda** — hoje cada venda é 1 item só; um cliente que
  compra 3 peças diferentes vira 3 vendas separadas, o que distorce ticket
  médio e dificulta emitir um recibo único.
- **Pagamento misto** (parte dinheiro, parte cartão) — hoje é uma única forma
  de pagamento por venda, sem parcelamento.
- **Comprovante/recibo** — não existe geração de PDF ou mensagem de WhatsApp
  com o resumo da venda; o botão de WhatsApp que existe hoje é só um "tenho
  interesse" genérico, não um recibo.
- **Devolução parcial** — hoje só existe cancelamento total da venda; devolver
  1 de 3 unidades vendidas não é possível sem cancelar tudo e recriar.

## Caixa

**O que tem:** livro simples de entradas/saídas, vínculo automático com
vendas, totais calculados no filtro atual, opção de ocultar valores
sensíveis.

**Onde investir:**
- **Fechamento de caixa diário de verdade** — hoje "saldo" é só a soma do
  período filtrado, recalculada na hora; não existe o conceito de "abrir o
  caixa com X, fechar com Y, contei Z na gaveta" (reconciliação). Pra um
  comércio físico isso costuma ser o processo diário mais importante e hoje
  simplesmente não existe.
- **Categorização de saída** — hoje é texto livre; não dá pra saber "quanto
  foi em aluguel vs. compra de peça vs. salário" sem ler descrição por
  descrição.
- Ponto de atenção encontrado (registro, não é urgente): a trava que impede
  editar/excluir um lançamento vinculado a uma venda é só visual — a API não
  bloqueia isso no servidor. Não é urgente porque o acesso já é restrito a
  admin, mas é uma inconsistência entre o que a tela promete e o que o banco
  permite.

## Frete

**O que tem hoje:** é só uma calculadora de cotação (Melhor Envio), isolada —
não depende do DataContext, não referencia nenhuma venda ou peça específica.

**Onde investir (se valer a pena pro negócio):**
- **Ligar com Vendas** — hoje fechar uma venda e gerar o frete daquele
  produto são dois mundos sem nenhuma conexão. Poder calcular/gerar frete
  direto a partir de uma venda existente evitaria digitar tudo de novo.
- O "Seguro: R$ 0,00" que aparece na tela é decorativo — não é calculado de
  verdade, vale considerar remover pra não parecer um dado real.
- Este é o módulo mais simples e mais desconectado do resto — antes de
  investir nele, vale confirmar se frete é realmente usado no dia a dia ou é
  secundário.

## Configurações

**O que tem:** árvore de categorias (já bem resolvida, com drag-and-drop) e
formas de pagamento — só isso.

**Onde investir:**
- Hoje "Configurações" não é de fato a central de configuração do sistema —
  falta cadastro de modelos de moto (existe, mas escondido dentro do
  formulário de Estoque), dados da loja (CEP de origem é fixo no código, não
  editável em tela), e qualquer coisa de permissão de usuário.

---

## Se eu tivesse que escolher só 3 coisas pra priorizar

1. **Campo de custo no estoque** → destrava margem real em Dashboard e Vendas
   de uma vez.
2. **Itens parados / mais vendidos no Dashboard** → dado que já existe, só
   falta agregar; alto valor, baixo esforço.
3. **Fechamento de caixa com reconciliação** → resolve a maior lacuna
   operacional pra um comércio físico do dia a dia.
