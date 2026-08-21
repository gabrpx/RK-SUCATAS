# Plano de reestruturação mobile-first — RK Sucatas

> **Status:** proposta para aprovação. **Nada aqui foi implementado** (exceto os
> dois bugs de mobile, que já foram corrigidos e estão listados no fim como
> referência). Este documento descreve _o que fazer_ e _por que_, tela por tela.
> Não contém código.

---

## 1. Princípios que guiam o plano

1. **Mobile-first de verdade, não "desktop encolhido".** Hoje a maioria das
   telas é o layout desktop reaproveitado num container estreito — grids de 2
   colunas que apertam valores em moeda, tipografia grande demais pra caber e
   textos que estouram e são cortados com reticências. A meta é desenhar o
   celular como cidadão de primeira classe (memória do projeto: _mobile e
   desktop pensados igualmente_).
2. **Reaproveitar o que já existe.** Detecção de contexto usa o que o app já
   tem: breakpoint `md:` do Tailwind (layout) e o hook `useHoverCapable()`
   (`(hover: hover) and (pointer: fine)`) para "isto é toque?". Não inventar
   mecanismo novo.
3. **Design system manda.** Só classes/tokens (`bg-surface-card`,
   `text-text-primary`, `text-positive`…). Nada de hex cru. Hierarquia: número >
   label. No máximo um botão `accent` preenchido por tela. Todo alerta com ação.
4. **Alvo de toque ≥ 44px** em qualquer coisa clicável (botões, itens de lista,
   ícones de ação, chips de filtro).
5. **Cortar antes de encolher.** Em tela pequena, esconder/colapsar o que é
   secundário (números de documento, colunas auxiliares, filtros avançados)
   em vez de espremer tudo.

### Escala de prioridade e esforço

- **Prioridade:** Alta = dói no uso diário / quebra leitura · Média = incomoda ·
  Baixa = polimento.
- **Esforço:** P = pequeno (poucas horas) · M = médio (1 dia) · G = grande
  (vários dias / precisa de decisão de layout).

---

## 2. Diagnóstico transversal (problemas que se repetem)

Estes aparecem em várias telas; resolvê-los na base derruba metade dos sintomas.

| # | Problema | Onde dói mais | Correção-base |
|---|----------|---------------|---------------|
| T1 | **Grid de 2 colunas para valores em moeda.** `R$ 4.766,00` não cabe em meia largura de celular e é cortado (`R$ 4.766…`). Visível no painel. | Dashboard, Caixa | 1 coluna no mobile para cards de valor (`grid-cols-1`), ou par só quando o valor é curto (contagem, %). |
| T2 | **Labels e subtítulos truncados.** `QUANTO E…`, `VENDIDO …`, `Não dá pra co…`, `R$ 81.370,00 e…`. O usuário não lê a informação inteira. | Dashboard, cards em geral | Labels curtos próprios pro mobile; subtítulo que quebra em 2 linhas em vez de truncar; número nunca trunca. |
| T3 | **Tipografia desktop em tela pequena.** Número gigante rouba a largura e força o corte. | Todos os cards de métrica | Escala tipográfica responsiva (número um degrau menor no mobile, ainda dominante sobre o label). |
| T4 | **Interações dependentes de hover.** Popovers de filtro, tooltips e "abre ao passar o mouse" não têm equivalente de toque claro. | Estoque (filtros), tooltips | Onde há hover, garantir gatilho de toque (tap abre/fecha). O bug do card de notificações era um caso disto — já corrigido. |
| T5 | **Densidade de informação alta demais.** Muita coisa por linha (nome + documento + valor + data). | Listas "Quem mais compra", Vendas, Clientes | Reduzir a 2 níveis por item (principal + apoio); mover o resto pro detalhe. |
| T6 | **Botão flutuante de busca sobrepõe conteúdo** e a barra inferior come o rodapé das listas. | Global | Padding inferior seguro nas listas (`pb-nav-safe` já existe em parte) e reposicionar/￼encaixar a busca. |

---

## 3. Tela por tela

### 3.1 Dashboard / Início — **Prioridade Alta · Esforço G**

**Problemas hoje** (direto das capturas):
- Cards "Faturamento & Crescimento" em 2 colunas cortam os valores
  (`R$ 4.766…`) e os labels (`QUANTO E…`) e subtítulos (`Não dá pra co…`) — T1,
  T2, T3 num só lugar.
- "Desempenho da loja" repete o mesmo problema (`R$ 595,7…`).
- "Caixa detalhado" idem (`R$ 7.881…`, `R$ 8.048…`, `- R$ 167,0…`).
- Gráfico "Como o faturamento andou nos últimos 6 meses": barras minúsculas, só
  a última com dado visível, muito espaço vertical gasto pra pouca leitura.
- "Quem mais compra": nome + nº de documento (`6195257188`) + valor competindo
  na mesma linha — o documento é ruído no celular (T5).
- Cabeçalho "Visão completa d…" truncado com o selo "Só para administradores"
  disputando espaço.

**Proposta mobile-first:**
- **Cards de métrica em 1 coluna** no mobile (largura total → o valor respira e
  nunca trunca). Reservar 2 colunas só para métricas de valor curto (contagens,
  %), agrupadas.
- **Labels curtos dedicados ao mobile** ("Em estoque", "Vendido no mês", "Saídas
  do mês") e subtítulo com quebra de linha permitida (sem `truncate`).
- **Número com escala responsiva**: um degrau menor no celular, ainda dominante.
- **Gráfico**: no mobile virar um resumo compacto (ex.: número do mês atual +
  variação + sparkline pequeno) ou dar altura/legenda maior às barras; não
  manter o mesmo desenho do desktop encolhido.
- **"Quem mais compra"**: 2 níveis — nome (forte) + valor à direita; nº de
  compras vira apoio pequeno; **esconder o documento** no mobile (fica no
  detalhe do cliente).
- **Cabeçalho da seção**: título curto no mobile; o selo de papel vira um ícone
  ou some (a permissão já é aplicada no back).

### 3.2 Estoque — **Prioridade Média · Esforço M**

**Problemas hoje:** já tem caminho mobile (cards em `md:hidden`, tabela em
`hidden md:block`) — melhor que a média. Mas: o **popover de filtros** é
pensado pra mouse (T4); ações por item (editar/publicar) podem ficar abaixo de
44px; densidade dos cards de peça alta.

**Proposta mobile-first:**
- Filtros: no mobile abrir como _bottom sheet_ (mesma linguagem do menu "Mais"),
  com gatilho de toque claro e chips de filtro ativos ≥44px.
- Card de peça mobile: hierarquia foto → título → preço/estoque; ações num menu
  de toque (kebab) em vez de vários ícones pequenos lado a lado.
- Garantir o alvo de 44px no botão de adicionar foto e nas ações de linha.

> Observação: os bugs de foto (câmera) já foram resolvidos neste componente.

### 3.3 Vendas — **Prioridade Média · Esforço M**

**Problemas hoje:** lista renderizada como cards (bom), mas o fluxo de _nova
venda_ (seleção de item, ficha, forma de pagamento) tem muitos controles densos;
dropdowns e listas de resultados podem passar do padrão de toque.

**Proposta mobile-first:**
- Fluxo de nova venda em etapas verticais respiráveis (1 decisão por bloco),
  botões de ação de largura total ≥44px.
- Resultados de busca de item como itens de lista tocáveis grandes.
- Confirmar que só há **um** botão `accent` preenchido por etapa (concluir).

### 3.4 Caixa — **Prioridade Alta · Esforço M**

**Problemas hoje:** "Caixa detalhado" sofre o T1/T2 (valores cortados). Tem
tabela/overflow (2 ocorrências) → possível scroll horizontal no mobile. Sub-abas
(Pendências/Lembretes) podem apertar.

**Proposta mobile-first:**
- Mesmos cards de valor em 1 coluna do Dashboard (reaproveitar a solução T1/T3).
- "Para onde o dinheiro foi": lista de 2 níveis (descrição + valor), barra de
  proporção fina abaixo — já é quase isso, só ajustar escala.
- Onde houver tabela, oferecer visão em cards no mobile (como o Estoque faz) em
  vez de scroll horizontal.
- Abas roláveis horizontalmente com alvo ≥44px.

### 3.5 Clientes — **Prioridade Média · Esforço M**

**Problemas hoje:** lista em cards (bom). A **ficha** tem cartão de perfil
animado (recente). Risco: muita informação (motos, tags, documento,
aniversário) empilhada; ações pequenas.

**Proposta mobile-first:**
- Ficha em seções colapsáveis (perfil já colapsa) com respiro entre blocos.
- Documento/dados secundários atrás de "ver mais"; telefone e ações principais
  (WhatsApp, nova venda) em destaque com alvo ≥44px.

### 3.6 Fiado — **Prioridade Média · Esforço P**

**Problemas hoje:** cards de pendência com valor + cliente + ações; risco de
densidade e alvos pequenos nos botões de "receber/registrar".

**Proposta mobile-first:** card de 2 níveis (cliente + saldo devedor forte),
ação primária de largura total; histórico atrás de toque.

### 3.7 Orçamentos — **Prioridade Baixa · Esforço P**

**Problemas hoje:** lista em cards; provável reaproveitamento do padrão de
vendas. Sem tabela detectada.

**Proposta mobile-first:** alinhar ao padrão de card de 2 níveis + ação de
largura total; garantir que "converter em venda" seja o único `accent`.

### 3.8 Frete — **Prioridade Baixa · Esforço P/M**

**Problemas hoje:** formulários de dimensões/rastreio com muitos campos;
no mobile campos lado a lado apertam.

**Proposta mobile-first:** campos empilhados 1 por linha, teclado numérico onde
couber, botão de calcular/gerar de largura total.

### 3.9 Mercado Livre / Shopee — **Prioridade Baixa · Esforço M**

**Problemas hoje:** telas de publicação/sincronização são densas e nasceram
desktop-first (edição de anúncio, listas de atributos). Uso mobile é secundário.

**Proposta mobile-first:** priorizar leitura (status de anúncios em cards) e
deixar edição pesada com layout empilhado; não é foco de curto prazo.

### 3.10 Configurações — **Prioridade Baixa · Esforço M**

**Problemas hoje:** árvores (Motos/Categorias no estilo explorador) e listas de
gestão são cliques finos; no toque ficam difíceis.

**Proposta mobile-first:** linhas de árvore com altura ≥44px, expandir/recolher
por toque no rótulo inteiro (não só na setinha).

### 3.11 Tarefas — **Prioridade Média · Esforço P**

**Problemas hoje:** cards de tarefa; ações de concluir/atribuir podem ser
pequenas.

**Proposta mobile-first:** card com título forte, ação de concluir como alvo
grande; filtros por status como chips roláveis.

### 3.12 Notificações (aba de push) — **Prioridade Baixa · Esforço P**

**Problemas hoje:** tela de ativar push + lista de dispositivos; ok, mas botões
podem crescer.

**Proposta mobile-first:** botão "Ativar neste aparelho" de largura total ≥44px;
itens de dispositivo com ação de remover clara.

### 3.13 Navegação (barra inferior + menu "Mais") — **Prioridade Média · Esforço P**

**Problemas hoje:** barra inferior com 4 itens fixos + "Mais" funciona bem. O
menu "Mais" é bottom sheet (bom). Faltam: indicador de aba ativa mais visível e,
eventualmente, badge de notificação.

**Proposta mobile-first:** manter o padrão; padronizar bottom sheet como o
componente de "camada de toque" reutilizável (filtros, ações, menus todos com a
mesma linguagem); garantir `pb-safe`/`pb-nav-safe` em todas as listas pra barra
não cobrir o último item (T6).

### 3.14 Modais (detalhe, cadastro de peça, publicar) — **Prioridade Alta · Esforço M**

**Problemas hoje:** modais centrais herdados do desktop no mobile ficam
apertados nas bordas; formulário de cadastro de peça é longo.

**Proposta mobile-first:** no mobile, modais viram _full-screen sheet_ (sobem de
baixo, ocupam a tela), com cabeçalho fixo (título + fechar) e ação primária fixa
no rodapé (largura total, ≥44px). Formulário de peça em seções.

> Observação: o botão "Tirar foto" (câmera direta) e "Escolher da galeria" já
> foram adicionados ao upload de fotos.

---

## 4. Ordem de execução sugerida (fases)

**Fase 0 — Fundação transversal (destrava tudo).** _Alta._
Resolver T1–T3 numa camada compartilhada: componente/variante mobile dos cards
de métrica (1 coluna, labels curtos, número responsivo, subtítulo que quebra).
Isso conserta Dashboard e Caixa de uma vez. Padronizar o _bottom sheet_ como
camada de toque (base pra filtros/modais). Garantir padding inferior seguro
(T6).

**Fase 1 — Telas de maior uso diário.** _Alta._
Dashboard (aplicar Fase 0 + gráfico compacto + "Quem mais compra" enxuto) e
Caixa (cards + cards no lugar de tabela). Modais → sheet full-screen no mobile,
começando pelo cadastro de peça e detalhe.

**Fase 2 — Fluxos operacionais.** _Média._
Vendas (nova venda em etapas), Estoque (filtros em sheet + ações em kebab),
Clientes (ficha em seções), Tarefas, Fiado, Navegação (padronização).

**Fase 3 — Polimento e telas secundárias.** _Baixa._
Orçamentos, Frete, Configurações (árvores tocáveis), Notificações, Mercado
Livre/Shopee.

Cada fase deve ser verificada no preset **mobile** do preview (texto legível,
alvos ≥44px, sem truncamento de número, sem scroll horizontal) antes de seguir.

---

## Anexo — Bugs de mobile já corrigidos (referência)

- **Notificações (toque):** no mobile, tocar no card de notificações do painel
  agora **expande a pilha in-place** (mesmo painel do hover do desktop) em vez de
  navegar direto pra outra tela; só navega depois de aberto. Desktop intacto.
  Arquivos: `src/components/ui/NotificationList.tsx`,
  `src/components/ui/beui-tooltip.tsx` (hook `useHoverCapable` exportado).
- **Câmera (cadastro de peça):** botão "Tirar foto" abre a câmera direto
  (`accept="image/*"` + `capture="environment"`); "Escolher da galeria"
  continua como opção separada. Arquivo:
  `src/features/estoque/EstoqueUploadFotos.tsx`.
