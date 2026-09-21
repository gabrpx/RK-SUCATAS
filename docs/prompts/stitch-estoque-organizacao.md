# Prompt para Stitch — Tela de Estoque RK Sucatas

> **Como usar:** cole o BLOCO 0 (identidade) junto com cada bloco de tela, um de cada vez.
> Não cole os quatro de uma vez — o Stitch perde coerência em prompts muito longos.
> Ordem sugerida: Tela 1 → Tela 2 → Tela 3.

---

## BLOCO 0 — Identidade visual (colar sempre junto)

Você está desenhando uma tela para o **RK Sucatas — Gestão Inteligente**, sistema
de uma empresa brasileira de desmanche e venda de peças usadas de moto. As telas
devem seguir exatamente a mesma linguagem visual do "Painel de Operações do
Turno" já existente neste projeto.

**Idioma:** toda a interface em português do Brasil.

**Tema e cor**
- Tema claro. Fundo slate muito claro, cartões brancos, bordas slate discretas.
- Azul/índigo: ação principal. **Um único botão de acento preenchido por tela.**
- Verde/esmeralda: confirmação e grau A.
- Âmbar: atenção e grau B.
- Rose/vermelho: risco, atraso e grau C.
- Cor nunca é o único portador de significado. Todo chip de estado leva
  **ícone + texto**, nunca só cor.

**Tipografia**
- Geist, com Inter como fallback. **Nenhuma fonte monoespaçada em lugar nenhum.**
- Números, códigos de localização e SKU se diferenciam por peso, cor e
  espaçamento — nunca trocando de família.
- Números grandes usam `tabular-nums` para não dançar ao atualizar.

**Densidade e layout**
- Mobile-first: desenhe primeiro em 320–430 px e amplie para tablet e desktop.
- Nenhuma superfície principal exige rolagem horizontal. Só abas e chips de
  filtro rolam lateralmente, sempre com o item ativo visível.
- Alvo de toque mínimo 44 × 44 px, inclusive caixas de seleção.
- Campos de texto com no mínimo 16 px em telas estreitas.
- No mobile, o que o usuário executa vem antes do que apenas explica o estado.
  Resumos, gráficos e históricos ficam depois da fila de trabalho.

**Componentes e movimento**
- Tabs e ações primárias: padrão Animate UI.
- Gráficos: padrão Bklit UI — escolha o gráfico pela pergunta de negócio,
  nunca decorativo.
- Uma única transição de destaque por fluxo, no padrão UILora (drawer/confirmação).
- Presença, entrada, saída e mudança local de layout: Motion.
- Anime.js apenas para contadores curtos e revelações coordenadas.
- Animação usa só `opacity` e `transform`, respeita `prefers-reduced-motion` e
  nunca reanima a tela inteira nem parece recarregamento.
- Nada de `select`, `alert` ou `confirm` nativos.
- Em cards repetidos, só a ação principal fica visível. Editar e excluir vivem
  em menu de contexto.
- Detalhes e criação viram folha (sheet) de altura quase total no mobile, com
  cabeçalho fixo, rolagem interna e rodapé de ação acima da safe area. Em telas
  maiores, viram drawer lateral ou diálogo centrado.

**Vocabulário do domínio (usar exatamente estes termos)**
- **Peça** — o tipo de peça no catálogo. Ex.: "Motor de Partida". Existe uma só.
- **Unidade** — cada exemplar físico daquela peça. Tem SKU único e permanente,
  foto própria, grau, preço próprio, localização e lote de origem.
- **Lote** — a carcaça, a moto de leilão de onde a unidade foi retirada.
- **Grau** — estado de conservação da unidade:
  - **A** (verde): testada e funcionando, sem quebra, pronta pra anunciar.
  - **B** (âmbar): funciona, com marca de uso visível.
  - **C** (rose): não testada ou precisa de reparo.
- **Pendência** — o que falta numa unidade: `sem foto`, `sem preço`,
  `sem localização`, `sem compatibilidade`.

**Regra de organização — o coração desta tela**

Uma peça NÃO é batizada pela moto de onde saiu. Ela é batizada pelo que é, e
carrega a lista de modelos que atende. Um motor de partida que serve XRE 300 e
CB 300R é **uma** peça com duas compatibilidades e N unidades — nunca duas peças
separadas. Unidades da mesma peça podem ter vindo de lotes diferentes, e cada
uma mostra seu lote de origem.

---

## BLOCO 1 — Tela de Estoque (principal)

Desenhe a tela principal de Estoque, desktop e mobile.

**Cabeçalho**
- Breadcrumb em micro-caps cinza: `OPERAÇÃO DO GALPÃO › ESTOQUE E ATENDIMENTO`.
- Título grande: `Estoque`.
- Abas Animate UI à direita, com contador: `Atendimento` | `Desmonte`.
  A aba `Atendimento` é a ativa nesta tela.

**Faixa de oportunidade (logo abaixo do cabeçalho, 3 cartões)**

Não são cobranças, são oportunidades. Cada cartão tem barra de acento colorida
à esquerda, rótulo em micro-caps, número grande e uma linha de contexto.

1. `PROCURADAS E NÃO ENCONTRADAS` — âmbar — "7 buscas sem resultado esta semana",
   com a mais pedida em destaque: "4× Farol Titan 160". Ação: `Ver lista`.
2. `PRONTAS PRA ANUNCIAR` — verde — "23 unidades grau A com foto e preço,
   ainda fora do Mercado Livre". Ação: `Anunciar em lote`.
3. `DESMONTE EM ANDAMENTO` — azul — "3 carcaças abertas", com a mais avançada
   nomeada: "XRE 300 · LT-07 · 78%".

**Busca**
- Uma caixa só, larga, logo abaixo da faixa. Placeholder:
  `Buscar peça ou moto — ex: farol xre, motor de partida 300`.
- Filtra a prateleira ao vivo enquanto digita. É filtro, não navegação.
- Mostra dica discreta à direita: `⌘K para busca global`.

**Prateleira por modelo (estado inicial da tela)**

Não mostre uma lista de todas as peças. Mostre cartões de modelo de moto:

- Cartão com nome do modelo (`XRE 300`), número grande de peças (`84 peças`),
  e uma linha de distribuição de grau em barra segmentada fina
  (verde/âmbar/rose) com os números ao lado: `52 A · 24 B · 8 C`.
- Uma linha discreta de valor: `R$ 38.400 em estoque`.
- Ordenados por quantidade, 4 por linha no desktop, 1 por linha no mobile.

**Modelo aberto (mostre também este estado)**

Ao clicar em `XRE 300`, a prateleira dá lugar a grupos colapsáveis por área da
moto: `Motor`, `Elétrica`, `Chassi e Suspensão`, `Carenagem`, `Rodas e Freios`,
`Acessórios`. Cada grupo mostra sua contagem no cabeçalho e pode recolher.

Dentro do grupo, grade de cartões de **Peça** com foto:
- Foto recortada em fundo branco, grande o suficiente para reconhecer a peça.
- Nome completo da peça, com quebra de linha natural — **nunca truncar**.
- Contagem de unidades: `5 unidades`.
- Faixa de preço: `R$ 180 – 260`.
- Distribuição de grau em chips pequenos com letra + cor: `2 A` `2 B` `1 C`.
- Quando a peça serve mais de um modelo, marca discreta:
  `também serve CB 300R, CBF 300`.
- Chips de pendência quando houver, sempre com ícone + texto:
  `sem preço`, `sem localização`.
- Só uma ação visível no cartão. O resto em menu de contexto.

**Painel da direita (desktop; vira seção abaixo da fila no mobile)**

1. `PEÇAS A UNIFICAR` — a fila que mantém o catálogo limpo. Cada item mostra os
   dois candidatos com miniatura, e o motivo da suspeita:
   `Motor de Partida XRE 300 (3 un.) · Motor de Partida CB 300R (2 un.) —
   mesmo tipo, plataforma compatível`. Ações: `Unificar` e `São diferentes`.
2. Gráfico Bklit: `PROCURA VS. ESTOQUE POR MODELO` — barras comparando quanto
   foi procurado contra quanto existe, destacando onde a procura passa do estoque.
3. Gráfico Bklit: `ENTRADAS E SAÍDAS NA SEMANA` — área, duas séries.

**Estados que precisam existir**
- Vazio: nenhum modelo cadastrado ainda.
- Busca sem resultado: mostre a ação `Registrar que um cliente pediu isso`,
  porque essa busca vira dado de demanda.
- Carregando: esqueleto, não spinner.
- Erro de rede: com `Tentar novamente`.

---

## BLOCO 2 — Detalhe da Peça

Desenhe a tela de detalhe de uma Peça, desktop e mobile. Exemplo:
**Motor de Partida**, 5 unidades, serve XRE 300, CB 300R e CBF 300.

**Cabeçalho**
- Nome grande da peça.
- Linha de compatibilidade em chips: `XRE 300` `CB 300R` `CBF 300`, com um chip
  de ação `+ adicionar moto`.
- Resumo à direita: `5 unidades disponíveis`, faixa de preço, e
  `procurada 12× nos últimos 30 dias`.

**Abas Animate UI:** `Unidades` | `Histórico` | `Anúncios`.

**Aba Unidades (padrão)**

As 5 unidades lado a lado e comparáveis, em cartões ou linhas largas. Cada uma:
- Foto própria da unidade (nunca a foto de outra unidade nem uma foto genérica
  da peça — se não tiver foto própria, placeholder tracejado com
  chip `sem foto`).
- SKU em destaque de peso, sem fonte mono: `SKU 1042`.
- Chip de grau, letra + cor: `A` `B` `C`.
- Preço próprio, grande.
- Localização: `A-03`.
- Lote de origem: `LT-07 · XRE 300`.
- Estado: `Disponível`, `Reservada` (com contagem regressiva viva), `Anunciada`
  (com o canal: ML, Marketplace) ou `Vendida`.

**Edição por manipulação direta (importante)**

Preço, grau e localização se editam clicando no próprio valor na linha da
unidade — o campo vira editável ali mesmo, salva ao sair ou no Enter, com
desfazer. Não abre menu, não abre modal, não navega. Isso não é um CTA
concorrendo na linha, então a regra de "só a ação principal visível em cards
repetidos" continua valendo: editar deixa de ser uma ação e vira o próprio
dado sendo tocado. Mostre o estado de foco e o de salvando.

**A ação principal da tela** — o único botão de acento preenchido:
`Responder cliente`. Ele monta a mensagem pronta pra colar no WhatsApp (foto
recortada + grau + preço + prazo) **e** reserva aquela unidade por 24 h no mesmo
clique. Mostre o preview da mensagem antes de confirmar, e deixe o prazo da
reserva ajustável ali.

Unidades vendidas ficam em seção recolhida no fim, nunca somem.

**Aba Histórico**
- Lista das unidades já vendidas dessa peça: por quanto saiu, quando, de qual
  lote veio.
- Um gráfico Bklit pequeno de preço ao longo do tempo, para sustentar negociação.

**Aba Anúncios**
- Um anúncio por peça, com o estoque igual ao número de unidades disponíveis.
- Opção explícita de `anunciar só a unidade em melhor estado` em vez do grupo.

---

## BLOCO 3 — Cadastro em lote (mobile)

Desenhe o fluxo de cadastro em lote, **mobile em primeiro lugar**, como folha de
altura quase total: cabeçalho fixo, conteúdo rolável, rodapé de ação acima da
safe area. O operador está em pé no galpão, com uma mão só, com 20 peças na
bancada recém-tiradas de uma moto.

**Passo 1 — Lote (uma vez só para as 20 peças)**
- Escolher a carcaça de origem, com busca. Exibe `LT-07 · XRE 300 · 78% desmontada`.
- Escolher o setor de destino padrão: `A-03`.
- Isso não se repete peça por peça. É a economia central do fluxo.

**Passo 2 — Fotografar em sequência**
- Câmera em tela cheia, com contador `foto 7 de 20` e tira de miniaturas embaixo.
- Nenhuma classificação aqui. Só fotografar, rápido.

**Passo 3 — Classificar uma a uma**
- Uma peça por vez, foto grande no topo.
- **Tipo de peça:** seletor de lista fechada, com busca. O operador escolhe,
  nunca digita livre — é isso que impede duplicata na origem. Mostre o
  componente aberto, com busca e estado "nenhum resultado".
- **Grau:** três opções grandes, A / B / C, cada uma com a definição em uma linha
  abaixo do rótulo.
- **Preço:** campo com sugestão baseada no histórico —
  `unidades iguais saíram por R$ 180 – 240`.
- **Localização:** pré-preenchida com `A-03`, editável.
- Rodapé: `Salvar e próxima` como ação principal, com o contador `7 de 20`.

**Pergunta de compatibilidade (aparece uma única vez por tipo + plataforma)**

Quando o operador cadastra um tipo de peça novo para aquela plataforma, aparece
uma pergunta só, em cartão destacado, dentro do mesmo passo:

> **Motor de Partida da XRE 300 serve em outras motos?**
> Sugestões da plataforma Honda 300: `CB 300R` `CBF 300` `NX 300`
> [ Confirmar ] [ Ajustar ]

Ela nunca mais reaparece para esse tipo de peça. Deixe isso explícito na
microcópia: `Perguntamos só uma vez por tipo de peça.`

**Editor de recorte de fundo**

Tela própria, acionada pela foto. Precisa mostrar:
- Fundo removido automaticamente ao abrir, com a peça sobre xadrez de transparência.
- Ferramenta `Remover`: o operador toca no que sobrou do fundo e aquela região some.
- Ferramenta `Restaurar`: pincel que traz de volta a parte da peça que o
  automático comeu por engano. Tamanho do pincel ajustável.
- `Desfazer` e `Refazer` por etapa, sempre visíveis.
- Comparação antes/depois.
- Rodapé: escolher o fundo de saída — transparente, branco ou cor da marca.

---

## BLOCO 4 — Aba Desmonte (opcional, se sobrar fôlego)

A segunda lente do mesmo estoque. Lista das carcaças abertas. Cada carcaça:
- Modelo e código do lote: `XRE 300 · LT-07`.
- **Medidor em matriz de pontos (dot matrix):** cada ponto é uma peça que
  normalmente sai daquele modelo. Ponto aceso = já retirada e cadastrada.
  Ponto apagado = ainda na moto. Percentual ao lado.
- Lista do que ainda falta tirar daquele modelo, como checklist acionável.
- Campo de custo de compra, vazio e opcional por enquanto.

> Nota de implementação: o `DESIGN_SYSTEM.md` do projeto restringe DotMatrix a
> indicador pontual, nunca repetido em listas. O uso acima é uma **exceção
> aprovada pelo usuário em 19/09/2026**, no mesmo formato da exceção do
> `TurnMetricStrip` (17/09). Registrar na skill `ux-user-audit` antes de fechar
> a implementação, com o motivo e o limite da exceção.
