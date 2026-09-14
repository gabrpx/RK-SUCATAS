# Prompt para Claude Code — Famílias de peça no Estoque (Fases 3-6)

> Cole isto inteiro numa sessão nova do Claude Code, dentro da pasta do
> projeto "SISTEMA CLAUDE". Configure o modelo como **Claude Sonnet 5**,
> esforço de raciocínio **médio**, antes de colar.

---

## Objective

Terminar a feature "famílias de peça" no Estoque: hoje cada combinação
peça+modelo de moto é uma linha solta na tabela (ex.: "Tanque de
Combustível CG 150 Carburada", "... MIX", "... Injetada" — três linhas
sem relação estrutural). O objetivo é a tabela mostrar **uma linha por
família** ("Tanque de Combustível CG 150"), que ao ser clicada abre um
modal com as unidades físicas agrupadas por modelo/ano ("CG 150
Carburada · 2004–2008", "CG 150 MIX · 2009–2010", "CG 150 Injetada ·
2013–2015"...) — um "drawer" por família, sem exigir mais que cada
unidade cadastrada preencha uma ficha própria quando a peça já tem
foto/descrição cadastradas.

## Context — o que já existe (Fases 1 e 2, feitas ontem)

Existe um design já aprovado e parcialmente implementado:
`docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md`
— **leia esse arquivo inteiro antes de tocar em qualquer código**, ele
tem todas as decisões de produto (o que está descrito abaixo é um
resumo do que falta, não substitui o spec).

Já implementado e funcionando (não recriar, só reaproveitar):

- `supabase/migration_056_estoque_familias.sql` — tabela
  `estoque_familias` (nome, categoria_id, descricao, imagem_url) +
  `estoque.familia_id` (opcional, nullable).
- `supabase/migration_057_estoque_unidades_explicitas.sql` — função
  `sincronizar_unidades_estoque(p_estoque_id, p_quantidade_alvo)`: toda
  vez que `quantidade` de uma ficha muda, garante exatamente
  `quantidade` linhas em `estoque_unidades` (cria em branco se faltar,
  apaga só as em branco mais recentes se sobrar, nunca mexe em unidade
  com dado próprio ou já vendida).
- `src/server/routes/estoque.ts` já chama `sincronizarUnidades()` nos
  três lugares que gravam `quantidade` (POST, PUT/PATCH, e
  `/bulk-update-quantidade`) e já aceita/persiste `familia_id` no
  payload (função `montarPayload`). Já tem `anexarFamilias()` que
  populate `item.familia` via join. Já existem `GET /:id/unidades`,
  `PATCH /:id/unidades/:unidadeId` (edita apelido/avaria/fotos/
  valor/condicao_nota de uma unidade existente) e
  `DELETE /:id/unidades/:unidadeId`.
- `src/server/routes/estoqueFamilias.ts` — CRUD completo de
  `estoque_familias` (GET, POST, PUT/PATCH, DELETE — o DELETE já
  bloqueia com 409 se alguma unidade das fichas-filhas tiver
  `vendida_em` preenchido, mas **não implementa ainda** a ação
  alternativa "desvincular peças" citada no spec — isso é seu, Fase 5).
- `src/features/estoque/familiaEstoque.ts` (+ `.test.ts`) — módulo
  puro de agregação já pronto: `agruparPorModelo` (ordena por ano via
  `extrairAnoOrdenavel` de `src/features/motos/motoTree.ts`),
  `contarModelosFamilia`, `faixaPrecoFamilia`, `emEstoqueFamilia`,
  `variacoesFamilia`, `comAvariaFamilia`, `valorEmEstoqueFamilia`. Use
  essas funções — não reescreva a lógica de agregação dentro de
  componente nenhum.
- `src/features/estoque/types.ts` já tem `EstoqueFamilia`,
  `EstoqueFamiliaInput`, `Estoque.familia_id`/`Estoque.familia`.
- `src/features/estoque/valorEstoque.ts` já tem `valorDaUnidade`,
  `condicaoNotaDaUnidade` (herança null → valor da peça-mãe),
  `contarFichas`, `contarAvarias`, `isEstoqueBaixo` — reaproveitar.

**O que falta é só a UI (tabela + modal) e os fluxos de ação — Fases
3 a 6 do spec.** `EstoqueView.tsx` hoje não tem nenhuma referência a
`familia` (confirmado por grep) — a tabela ainda mostra uma linha por
ficha, sem agrupar nada.

## ⚠️ Risco crítico — leia antes de começar qualquer coisa

`migration_057` roda um backfill (bloco `do $$ ... $$`) que cria
unidades em branco pra **toda** peça já cadastrada em produção assim
que o SQL é executado no editor do Supabase. Depois desse backfill
rodar, toda ficha passa a ter `count(estoque_unidades) == quantidade`
sempre — e isso ativa incondicionalmente a guarda antiga em
`POST /:id/unidades` (linha ~746 de `estoque.ts`, `count >=
item.quantidade`), quebrando o fluxo atual de "Registrar unidade"
(`UnidadesEstoque.tsx`) com erro 400 pra sempre, até você entregar o
novo fluxo (Fase 5, que usa `PATCH /:id/unidades/:unidadeId` em vez de
criar linha nova).

**Antes de escrever qualquer código**: pergunte ao usuário (RK) se
`migration_056` e `migration_057` já foram rodadas no SQL editor do
Supabase de produção. Se a resposta for "não" ou "não sei":

1. Implemente Fases 3, 4 e 5 primeiro (a UI funciona com `familia_id`
   sempre null enquanto a migração não roda — comportamento idêntico
   ao atual, é o próprio design que garante isso).
2. Só depois de Fase 5 estar pronta e testada, oriente o usuário a
   rodar as duas migrations no Supabase (nessa ordem: 056, depois
   057) — nunca antes.
3. Não rode nada no banco de produção você mesmo; isso é sempre ação
   manual do usuário no editor SQL do Supabase.

Se a resposta for "sim, já rodei": confirme rodando uma query de
sanidade (`select count(*) from estoque_unidades` comparado com `select
sum(quantidade) from estoque where quantidade > 0`, devem bater) antes
de prosseguir, e priorize Fase 5 antes de qualquer outra coisa, porque
"Registrar unidade" já pode estar quebrado em produção agora.

## Scope

Trabalhar só em:

- `src/components/animate-ui/primitives/radix/{dialog,accordion,dropdown-menu,popover}.tsx`
  (novos) + `src/components/animate-ui/components/radix/{mesmos nomes}.tsx`
  (novos) — cópias dedicadas do catálogo animate-ui.com (variante
  Radix), seguindo a convenção primitive/component já usada em
  `src/components/animate-ui/{primitives,components}/animate/tabs.tsx`.
  Decisão já tomada no spec: **não** reaproveitar
  `src/components/ui/Modal.tsx`, `dropdown-menu.tsx` ou `popover.tsx`
  existentes nesta entrega, mesmo duplicando funcionalidade — não
  toque nesses três arquivos.
- `src/features/estoque/EstoqueFamiliaModal.tsx` (novo, + teste) — modal
  de família.
- `src/features/estoque/RegistrarUnidadeDialog.tsx` (novo, + teste) —
  dialog empilhado da Fase 5.
- `src/features/estoque/EstoqueFundirFamiliasModal.tsx` (novo, + teste)
  — tela de sugestão de fusão da Fase 6, reaproveitando
  `detectarDuplicatas`/`similaridade`/`CORTE_POSSIVEL` de
  `src/features/estoque/detectarDuplicata.ts` (rodar a heurística
  sobre todo o estoque atual, não só contra o nome sendo digitado).
- `src/features/estoque/EstoqueView.tsx` — linha de família na tabela,
  busca/filtro estendidos, abrir `EstoqueFamiliaModal` no clique.
- `src/features/estoque/EstoqueItemExpandido.tsx` e
  `UnidadesEstoque.tsx` — **investigue primeiro** como são usados hoje
  (parecem ser o mecanismo atual de expandir uma linha e mostrar
  unidades) e decida com base no spec: o modal de família substitui
  esse comportamento tanto pra família quanto pra ficha avulsa (spec,
  seção "Tabela de Estoque", último bullet). Se `EstoqueItemExpandido`
  ficar órfão depois da migração, pare e pergunte antes de excluir —
  não é uma peça explicitamente listada no escopo desta entrega.
- `src/features/estoque/familiaEstoque.ts` — só se precisar de mais
  alguma agregação pura; funções já existentes cobrem o essencial.
- `src/server/routes/estoque.ts` — nenhuma rota nova deveria ser
  necessária pra "Registrar unidade" (reaproveita
  `PATCH /:id/unidades/:unidadeId` já existente), **exceto** a ação
  "mover unidade pra outro modelo/ano" (ver Fase 5 abaixo), que precisa
  de lógica transacional nova.
- `src/server/routes/estoqueFamilias.ts` — endpoint/ação de
  "desvincular peças" (zera `familia_id` de cada ficha-filha) pro
  fluxo de exclusão bloqueada.
- Nova migration (confirme o número mais alto em `supabase/` antes de
  criar — no momento desta pesquisa a última é `migration_059`, pode
  ter mudado): função `mover_unidade_estoque(p_unidade_id uuid,
  p_ficha_destino_id uuid)` — ver detalhe técnico na Fase 5.
- `src/features/vendas/VendasView.tsx` — **só** o ponto de entrada do
  atalho "Venda rápida" (pré-filtro de busca pelas fichas da família),
  nada além disso.

**NÃO tocar** (fora de escopo, quebra o não-objetivo do spec ou mexe em
feature publicada/testada por outra entrega):

- Tudo em `src/features/mercadolivre/`, `src/features/shopee/`,
  `mercadolivrePublicacao.ts`, `shopeePublicacao.ts`,
  `EstoquePublicarMlModal.tsx`, `EstoquePublicarShopeeModal.tsx`,
  `EstoqueAnunciosMlEditor.tsx`, `EstoqueAnunciosShopeeLista.tsx`.
- `src/features/estoque/EstoqueByMoto.tsx` (visão "Por moto" — spec diz
  explicitamente que não ganha noção de família nesta entrega).
- `src/features/orcamentos/**`, `src/server/routes/orcamentos.ts`,
  Dashboard, Caixa, Clientes, Tarefas, Usuários.
- `src/components/ui/Modal.tsx`, `dropdown-menu.tsx`, `popover.tsx`
  (ver acima).
- `.env`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`,
  `capacitor.config.ts`.

## Constraints

- Design tokens: **nunca** hex direto — sempre as classes Tailwind
  geradas a partir de `src/styles/theme.css` (`bg-surface-card`,
  `text-text-primary`, `rounded-card`, `text-positive` etc.).
- Cor sempre com significado — não usar `positive`/`negative`/etc por
  "ficar bonito". Máximo UM botão de acento preenchido (`accent`) por
  tela — no modal de família isso provavelmente é "Registrar unidade"
  ou "Venda rápida", escolha um e faça os outros outline/ghost/texto.
  Todo alerta tem que ter ação associada. No header de métricas do
  modal (6 números), o valor numérico é sempre mais forte visualmente
  que o label — número > label.
- Vitest + Testing Library, arquivo `*.test.ts(x)` ao lado do
  código-fonte — mesmo padrão já usado em todo o projeto
  (`familiaEstoque.test.ts`, `EstoqueFiltrosPopover.test.tsx` etc.).
- Migração de banco nova (se precisar, ver "mover unidade" na Fase 5):
  siga o padrão de `registrar_venda`/`cancelar_venda` em `schema.sql`
  — `for update` pra travar as linhas, tudo numa transação, mensagem
  de erro clara em `raise exception`. Confirme o número da migração
  mais alto em `supabase/` antes de nomear o arquivo — pode ter
  avançado desde esta pesquisa.
- Reaproveite sempre o padrão de degradação graciosa já usado no
  projeto pra tabela/coluna/função ausente (checar `error.code` em
  `42P01`/`PGRST205`/`42703`/`PGRST204`) em qualquer chamada nova a
  `estoque_familias`/`sincronizar_unidades_estoque`/à nova função de
  mover unidade — ambiente sem a migração rodada não pode quebrar a
  tela inteira.
- Só faça as mudanças pedidas aqui. Não refatore
  `EstoquePublicarMlModal.tsx`/`EstoquePublicarShopeeModal.tsx` mesmo
  que veja código parecido por perto, e não adicione abstrações além
  do pedido.

## Fase 3 — Tabela de Estoque agrupada por família

- Uma linha da tabela = 1 família (quando `familia_id` existe em
  qualquer ficha do grupo) ou 1 ficha avulsa (comportamento atual,
  preservado). Badge de contagem de fichas-filhas ao lado do nome
  quando é família.
- Colunas agregadas usando os helpers de `familiaEstoque.ts`: Moto
  (nome único ou "N modelos"), Valor (preço único ou faixa "R$ 380 –
  480"), Quantidade (soma, cor do indicador pela mesma regra
  `isEstoqueBaixo` aplicada ao total).
- Busca/filtro (nome/código/categoria/modelo) passam a também
  considerar os campos das fichas-filhas — buscar "Titan 99" acha a
  família mesmo que o texto só apareça numa ficha-filha.
- Clique na linha abre `EstoqueFamiliaModal`, pra família e pra ficha
  avulsa (avulsa mostra um grupo só).

## Fase 4 — Componentes animate-ui + modal de família

- Construa os 4 componentes Radix novos (Dialog, Accordion, Dropdown
  Menu, Popover) — ver caminhos em Scope.
- `EstoqueFamiliaModal.tsx`: header com as 6 métricas do spec
  (Modelos, Variações, Em estoque, Valor em estoque, Faixa de preço,
  Com avaria — fórmulas exatas em `familiaEstoque.ts`), busca +
  popovers de filtro (Modelo/status/avaria), abas Tabs (Unidades
  funcional; Histórico e Relacionadas desabilitadas, "em breve").
- Aba Unidades: grupos (`Accordion.Item`) ordenados do modelo mais
  antigo pro mais novo via `agruparPorModelo`. Cabeçalho do grupo:
  nome do modelo + ano, badge de contagem, resumo ("4 em estoque · R$
  380–480"). Dentro: card por unidade física — **toda** unidade vira
  card, mesmo sem diferença nenhuma das outras (sem resumo agregado de
  unidades idênticas). Badges "Melhor estado"/"Melhor preço"
  calculados automaticamente por grupo (maior `condicao_nota`/menor
  preço entre as disponíveis), nunca campo manual.
- Card de unidade: foto, nota de condição, apelido ("Padrão" quando
  null), badges de estado, código RK da ficha-mãe, "cadastrada há X",
  preço (via `valorDaUnidade`), status Disponível/Vendida, menu kebab
  (Dropdown Menu: editar/excluir/marcar vendida).
- Rodapé: Editar peça (edita `estoque_familias` via PUT/PATCH já
  existente), Excluir (ver Fase 5), WhatsApp (mantém comportamento
  atual, não mexer).

## Fase 5 — Fluxos de ação

**Registrar unidade** (`RegistrarUnidadeDialog.tsx`, empilhado sobre o
modal): passo 1, escolher grupo modelo/ano existente na família ou
"Novo modelo/ano" (reaproveitar `MotoCascadeSelect` já usado no
cadastro hoje). Passo 2, foto e preço **obrigatórios** (diferente da
sincronização automática), condição, apelido opcional, avaria
opcional. Ao salvar: se o grupo é novo, cria a ficha (`estoque`) com
`familia_id` da família atual; busca uma unidade em branco existente
via `GET /:id/unidades` (filtrando client-side: `apelido null, avaria
false, avaria_descricao null, valor null, condicao_nota null, fotos
[]`) e diferencia ela via `PATCH /:id/unidades/:unidadeId` — **não**
usa mais `POST /:id/unidades`. Se não sobrar unidade em branco (ficha
já com todas diferenciadas), oriente o usuário a aumentar a
`quantidade` da ficha primeiro (isso já dispara
`sincronizar_unidades_estoque` e cria uma nova em branco pra
diferenciar em seguida) — trate isso como parte do fluxo, não como
erro sem saída.

**Venda rápida**: abre `VendasView.tsx` com busca pré-preenchida pelas
fichas-filhas da família (query param ou estado compartilhado — o
mínimo pra pré-filtrar). `VendasView` continua operando sobre fichas
individuais, sem ganhar noção de família — não implemente integração
mais profunda que isso.

**Selecionar (multi-seleção)**: checkboxes nos cards. Barra de ação
com "Excluir selecionadas" (mesma regra de bloqueio de unidade vendida
— reaproveitar `DELETE /:id/unidades/:unidadeId` em loop, ou avaliar
se compensa um endpoint de delete em lote se o loop ficar lento/
frágil) e "Mover para outro modelo/ano".

**Mover para outro modelo/ano** — atenção, é a única ação desta
entrega que precisa de lógica transacional nova no banco: mover uma
unidade de ficha muda o `estoque_id` dela E precisa manter
`quantidade` de AMBAS as fichas (origem e destino) sincronizada com
`count(estoque_unidades)`, senão quebra exatamente o invariante que a
`migration_057` existe pra garantir. Implemente uma função SQL nova
(`mover_unidade_estoque`, mesmo padrão transacional de
`registrar_venda`: `for update` nas duas fichas, decrementa
`quantidade` da origem, incrementa a do destino — criando a ficha
destino primeiro, com `familia_id` da família, se o grupo escolhido
for "novo modelo/ano" — atualiza `estoque_id` da unidade, tudo dentro
da mesma transação). Popover com a lista de grupos da família + opção
"novo grupo".

**Excluir família**: reaproveita o DELETE já existente em
`estoqueFamilias.ts` (já bloqueia com 409 se tem unidade vendida). Pra
esse caso, implemente a ação alternativa que falta: "desvincular
peças" — zera `familia_id` de cada ficha-filha (loop de PATCH
`/api/estoque/:id` já aceita `familia_id: null`), preserva tudo o
resto.

## Fase 6 — Fundir famílias (migração assistida das duplicatas)

`EstoqueFundirFamiliasModal.tsx`, acessível a partir de Estoque: roda
`detectarDuplicatas` de `detectarDuplicata.ts` sobre **todo** o
estoque ativo atual (hoje a função só compara contra o nome sendo
digitado num formulário — aqui rode a comparação par-a-par entre todas
as peças sem família pra sugerir grupos, reaproveitando `tokenizar`/
`similaridade`/`CORTE_POSSIVEL` exportados, sem duplicar a lógica de
similaridade). Lista os grupos sugeridos lado a lado (nome, modelo,
foto de cada ficha) com checkbox por peça — usuário confirma/desmarca
antes de qualquer `familia_id` ser gravado (cria a `estoque_familia` e
faz PATCH `familia_id` nas fichas marcadas). **Nenhuma fusão
automática** — mesmo peça com nome idêntico exige clique explícito.

Esta fase é o que de fato aplica a reorganização aos dados reais de
hoje (ex.: um "TBI CG 150" cadastrado avulso continua avulso até
alguém confirmar a fusão aqui) — não deixe pra depois das outras só
por estar numerada por último no spec; se o tempo de sessão apertar,
priorize entregar isto funcional ainda que mais simples (lista +
checkbox, sem acabamento visual extra) em vez de deixar de fora.

## Acceptance Criteria

- [ ] Cadastrando uma família "Tanque de Combustível CG 150" com 3
      fichas-filhas (CG 150 Carburada 2004–2008, 2 unidades; CG 150
      MIX 2009–2010, 3 unidades; CG 150 Injetada 2013–2015, 1
      unidade), a tabela de Estoque mostra **1 linha só**, quantidade
      total 6, e o modal mostra os 3 grupos nessa ordem (mais antigo
      primeiro).
- [ ] Nenhuma unidade em branco (sincronização automática) exige
      preencher foto/preço — herda da ficha-mãe.
- [ ] "Registrar unidade" continua funcionando depois que
      `migration_057` rodar em produção (usa PATCH numa unidade em
      branco existente, nunca POST).
- [ ] Peça sem família continua se comportando exatamente como hoje —
      linha própria, modal abre com 1 grupo só.
- [ ] Excluir família com unidade já vendida é bloqueado e oferece
      "desvincular peças" em vez de apagar.
- [ ] Mover uma unidade entre grupos nunca deixa `quantidade` de
      nenhuma ficha diferente de `count(estoque_unidades)` dela.
- [ ] Tela de fusão sugere grupos pro estoque real hoje cadastrado
      (teste com nomes parecidos tipo "Tanque CG 150 Fan"/"Tanque CG
      150 Titan") e não funde nada sem clique explícito.
- [ ] `npm test` (ou o comando de teste do projeto) passa, incluindo
      os testes novos dos helpers e do render do modal.
- [ ] Nenhum arquivo listado em "NÃO tocar" foi alterado.

## Stop Conditions

Pare e pergunte antes de:

- Rodar qualquer migration/backfill em produção — isso é sempre
  manual, do usuário, no editor SQL do Supabase (ver seção de risco
  acima).
- Excluir `EstoqueItemExpandido.tsx`/`UnidadesEstoque.tsx` ou qualquer
  arquivo não listado explicitamente em Scope.
- Adicionar qualquer dependência nova no `package.json` (o spec já
  confirmou que `radix-ui` já é dependência — não deveria precisar de
  nada novo, mas confirme antes de instalar algo).
- Descobrir que a árvore `modelos_moto` não tem nós separados pra
  Carburada/Injetada/MIX com faixa de ano pro modelo que você estiver
  testando — isso é lacuna de dado/taxonomia do usuário, não algo pra
  inventar/preencher sozinho; reporte e pergunte como o usuário quer
  cadastrar isso.
- Qualquer mudança que afete `registrar_venda`, `cancelar_venda`, ou
  os fluxos de Vendas/Orçamentos além do pré-filtro da "Venda rápida".

## Progress

Depois de cada fase completa, output: ✅ Fase N — [o que foi feito] —
[arquivos afetados]. No fim, resumo completo de todo arquivo criado ou
alterado.

## Session Strategy

- Sessão nova, dedicada a esta feature.
- Use um subagente pra ler `EstoqueView.tsx` (92KB) e mapear a
  estrutura atual da tabela/render antes de editar — mantém a
  investigação fora do contexto principal.
- `/compact` depois de cada fase concluída (3, 4, 5, 6), focando no
  que falta da fase seguinte.
- Pense com calma antes de começar — isso mexe perto de risco de
  schema (timing do backfill da migration_057) e tem 4 fases
  dependentes entre si; não tem pressa de terminar rápido, tem
  prioridade em não corromper dado de produção.

---

Este prompt é para uma ferramenta agêntica com acesso real ao sistema.
Revise os limites de escopo, ações proibidas e stop conditions antes
de colar. Confirme que os caminhos de arquivo e a permissão de banco
batem com o projeto real antes de rodar.
