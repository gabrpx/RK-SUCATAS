# Handoff — Redesenho da tela de Estoque (RK Sucatas)

**Para:** Codex
**De:** Claude (Cowork), sessão de 19–21/09/2026
**Método:** skill `grill-me` — doze rodadas de perguntas de alto impacto antes de qualquer desenho, seguidas de duas rodadas de geração no Stitch e duas auditorias.
**Status:** especificação fechada e aprovada pelo usuário. Duas telas geradas e auditadas. **Nenhuma linha de código escrita.**

---

## 0. Como ler este documento

Este arquivo existe para que você continue sem depender da conversa. Ele traz,
na ordem: o problema real que originou o trabalho, o método de organização
novo, o modelo de dados, cada decisão tomada com sua justificativa, a
especificação das telas, o que já foi gerado e auditado, e o que ainda precisa
de decisão humana.

**O que você NÃO deve fazer sem autorização explícita do usuário:** escrever
código, criar migration, tocar em `src/App.tsx`, `server.ts`, `middleware/auth.ts`,
`src/context/DataContext.tsx`, `src/utils/api.ts`, `src/server/routes/`,
`services/supabaseClient.ts`, `supabase/`, `.env`, `package.json`, lockfiles ou
configuração de deploy. Nada aqui autoriza deploy.

**Leitura obrigatória antes de agir:** `AGENTS.md`, `docs/AI_CONTEXT.md`,
`docs/AI_WORKFLOW.md`, `docs/DESIGN_SYSTEM.md`,
`plugins/ux-user-audit/skills/ux-user-audit/SKILL.md`, e este arquivo.

**Arquivos irmãos produzidos nesta sessão:**
- `docs/prompts/stitch-estoque-organizacao.md` — o prompt do Stitch, em blocos.
- `docs/auditorias/ux-stitch-estoque-2026-09-19.md` — a primeira auditoria completa.

---

## 1. O problema real

O usuário descreveu a dor em duas frases, e elas governam tudo que vem depois:

> "Método de organização ruim, design pior ainda, fácil de se perder e gerar confusão."

> "Digamos que eu tenha uma XRE 300 e uma CB 300R. Acabo adicionando 3 motores
> de partida no item MOTOR DE PARTIDA XRE 300. Após alguns dias adiciono mais 2
> motores de partida da CB 300R (é a mesma peça para as duas motos, idêntica).
> Agora tenho a mesma peça em itens diferentes em motos diferentes, gerando
> confusão."

**Diagnóstico.** A peça está sendo batizada pela **moto de onde saiu**, não pelo
que ela é. Três coisas distintas foram amassadas num único campo de texto: o
nome da peça, o modelo de moto que ela atende, e a carcaça de onde veio. Quando
chega um motor de partida de outra moto, não existe lugar onde ele encaixe — e
nasce um segundo item que nunca mais conversa com o primeiro.

O agravante: **não há código OEM legível** na maioria das peças (confirmado pelo
usuário), então não existe chave natural para provar que duas peças são a mesma.

---

## 2. O método de organização (o coração do trabalho)

### 2.1 Três camadas, três perguntas

| Camada | Pergunta que responde | Exemplo | Cardinalidade |
| --- | --- | --- | --- |
| **Peça** | "O que é isso?" | Motor de Partida | 1 no sistema inteiro |
| **Unidade** | "Qual delas?" | SKU 1042 · grau B · R$ 190 · A-03 · veio do LT-07 | N por Peça |
| **Lote** | "De onde veio?" | LT-07 — a XRE 300 comprada no leilão de agosto | 1 por carcaça |

### 2.2 A regra que mata a duplicata

A Peça é batizada **pelo que ela é**, nunca pela moto de onde saiu.
"Motor de Partida", ponto final.

A moto se desdobra em duas informações separadas:
- **Compatibilidade** (quais motos a peça atende) → mora na **Peça**
- **Lote de origem** (de qual carcaça este exemplar veio) → mora na **Unidade**

Resultado: o motor que saiu da XRE e o que saiu da CB 300R são **a mesma Peça**,
com cinco Unidades — três do lote LT-07 e duas do LT-12 — cada uma sabendo sua
própria origem.

### 2.3 A prateleira é calculada, não arquivada

**Esta é a diferença de fundo em relação ao sistema atual.**

No modelo antigo (`gaveta → variante → unidade`), a gaveta é um agrupamento
**manual**: alguém decide onde guardar. É exatamente aí que a mesma peça acaba
em dois lugares.

No modelo novo, você **não arquiva** a peça em "XRE 300". Você declara que ela
atende XRE 300, CB 300R e CBF 300 — e ela passa a aparecer nas três prateleiras
sozinha, ao mesmo tempo, sem que nenhuma cópia exista.

**Ninguém arquiva errado porque ninguém arquiva.** A prateleira é uma
consequência do que a peça é, não um lugar onde ela foi posta.

### 2.4 Localização física é outra coisa

`A-03` é onde a peça está **no galpão**, não onde ela está **no sistema**.
Uma é endereço, a outra é significado. A gaveta do sistema atual tenta ser as
duas ao mesmo tempo — e é por isso que confunde.

Formato decidido: **setor + prateleira, dois níveis, código curto** (`A-03`).
Curto o bastante para caber num chip e para ser gritado do outro lado do galpão.

### 2.5 Como o sistema aprende compatibilidade

Marcar 679 peças à mão é inviável. Definir famílias antes de usar exige
modelagem abstrata que ninguém faz. Deixar para depois nunca acontece.

**A percepção que resolve:** compatibilidade não é propriedade da peça. É
propriedade do **tipo de peça cruzado com a plataforma**.

Um motor de partida não serve "a XRE 300" — ele serve qualquer moto que use
aquele motor. Um farol não segue o motor, segue a carenagem. Uma roda segue o
chassi. As peças se dividem em domínios:

| Domínio | Segue |
| --- | --- |
| Motor e transmissão | a família de motor |
| Chassi, suspensão, rodas | a família de chassi |
| Carenagem, farol, lanterna, painel | o modelo exato, nunca compartilha |
| Elétrica genérica | a marca/geração, escopo amplo |

Isso torna a informação aprendível **uma vez por tipo de peça**, não uma vez por
peça.

**O mecanismo:** o sistema pergunta uma única vez, no ato do cadastro.

Ao cadastrar "Motor de Partida" vindo de uma XRE 300 pela primeira vez:

> **Motor de Partida da XRE 300 serve em outras motos?**
> Sugestões da plataforma Honda 300: `CB 300R` `CBF 300` `NX 300`
> [ Confirmar ] [ Ajustar ]

A resposta vira regra permanente: **Motor de Partida + plataforma Honda 300 →
mesma Peça**. Daí em diante, todo motor de partida de qualquer moto dessa
plataforma cai no mesmo card automaticamente. Depois de ~50 tipos, o sistema
praticamente para de perguntar.

O acerto está no **momento**: pergunta quando o operador está com a peça na mão,
que é exatamente quando ele sabe a resposta. Não antes, numa tela de
configuração abstrata; não depois, numa fila de pendências que apodrece.

**Fontes da sugestão, em ordem de confiança:**
1. Histórico do próprio usuário (já declarou que esse tipo é compartilhado).
2. Tabela de plataformas de motos brasileiras pré-carregada (conhecimento
   público: quais modelos dividem motor e chassi). **Decisão do usuário:
   pré-carregar.**
3. Comparação de foto com peças já cadastradas.

### 2.6 Quando dá errado — fila de unificação

Erro vai acontecer. O painel direito mantém a fila **Peças a Unificar**, que
compara candidatos e mostra o motivo da suspeita:

> `Motor de Partida XRE 300 (3 un.)` ⟷ `Partida CB 300R (2 un.)`
> **Motivo:** mesmo tipo, plataforma compartilhada Honda 300cc.
> [ Unificar em Peça Única ] [ São diferentes ]

Ao unificar, **cada unidade mantém seu lote de origem**. Não se perde
rastreabilidade ao limpar a bagunça.

---

## 3. Modelo de dados

```
Lote (carcaça)
 └── modelo, código (LT-07), custo de compra (opcional, vazio hoje),
     progresso de desmonte

Peça (catálogo)
 └── tipo (LISTA FECHADA — nunca texto livre)
 └── compatibilidade: [modelos atendidos]   ← muitos-para-muitos
 └── área da moto (Motor, Elétrica, Chassi, Carenagem, Rodas, Acessórios)
 └── Unidades []

Unidade (ficha física)
 └── SKU — numérico, único, permanente, gerado pelo backend, imutável na UI
 └── foto própria (1 obrigatória + até 3 extras)
 └── grau: A | B | C
 └── preço próprio
 └── localização: setor-prateleira (A-03)
 └── lote de origem → Lote
 └── estado: disponível | reservada | anunciada | vendida
```

**Regras invariantes:**
- Uma Unidade nunca herda foto da Peça. Foto da peça-pai não satisfaz "tem foto".
- Unidade vendida **preserva ficha e SKU** para rastreabilidade e histórico de preço.
- O SKU pertence à **Unidade**, nunca à Peça. A Peça não tem código próprio.

### 3.1 Grau (substitui o antigo `com_avaria`)

| Grau | Cor | Definição objetiva |
| --- | --- | --- |
| **A** | verde | Testada e funcionando, sem quebra, pronta pra anunciar |
| **B** | âmbar | Funciona, com marca de uso visível |
| **C** | rose | Não testada **ou** precisa de reparo |

Critério objetivo o bastante para dois funcionários diferentes chegarem ao mesmo
grau. A avaria deixa de ser "pendência" (algo a resolver) e vira característica
descrita — que é o que ela realmente é numa peça usada.

Sempre renderizado como **letra + cor**, nunca só cor.

### 3.2 Pendências

`sem_foto` · `sem_preco` · `sem_localizacao` · `sem_compatibilidade`

`sem_localizacao` substitui o antigo `sem_gaveta`. `sem_compatibilidade` é nova
e importante: peça cadastrada sem saber quais motos atende **não aparece em
nenhuma prateleira** — está invisível para o atendimento.

Todo chip de pendência leva **ícone + texto**, nunca só cor.

---

## 4. Decisões tomadas, com justificativa

Todas confirmadas pelo usuário. A justificativa importa tanto quanto a decisão —
não reverta nenhuma sem entender o porquê.

### Produto e organização

| # | Decisão | Por quê |
| --- | --- | --- |
| 1 | Trabalho principal da tela: **responder cliente no zap/balcão** | Uso mais frequente, e o que já tem automação parcial |
| 2 | **Duas lentes, um toggle:** Atendimento (por modelo) e Desmonte (por lote) | São dois jeitos de ver o mesmo estoque, não dois assuntos |
| 3 | **A prateleira por modelo substitui a gaveta** | A gaveta manual é a causa raiz da duplicata |
| 4 | Peça serve N modelos; **conta em todas as prateleiras** com sinal de compartilhada | É a verdade do estoque. Total do galpão soma uma vez, em contador à parte |
| 5 | 1 Peça com N Unidades dentro | Acaba com a duplicação sem perder o detalhe que peça usada exige |
| 6 | Preço **por unidade** | Peça usada: cada exemplar vale diferente. Dá margem de negociação |
| 7 | Tipo de peça: **lista fechada**, nunca texto livre | Impede a duplicata de nascer. Dois funcionários não escrevem diferente porque nenhum escreve |
| 8 | 1 anúncio por Peça, estoque = nº de unidades; **com opção de anunciar só a melhor** | Ataca o "muito clique pra anunciar" sem perder a venda da peça grau A |
| 9 | Reserva de **24 h, ajustável por peça** | Cobre "pergunta hoje, paga amanhã" sem travar peça boa por semanas |
| 10 | Venda: sai do disponível, **histórico fica** | Alimenta sugestão de preço e retorno por carcaça |
| 11 | Demanda: **busca sem resultado registra automático** + botão "cliente pediu" | O dado nasce do uso real, sem trabalho extra |
| 12 | Preço definido pelo usuário, **com sugestão do histórico** | Base pra negociar no zap sem abrir outra aba |
| 13 | Permissões por perfil | **Decisão adiada pelo usuário:** "isso pode ser decidido nas configurações do sistema" |

### Interface

| # | Decisão | Por quê |
| --- | --- | --- |
| 14 | Estado inicial: **prateleira por modelo + faixa de trabalho** | Nunca começar com 679 linhas na cara |
| 15 | Faixa do topo: **Procuradas e não encontradas · Prontas pra anunciar · Desmonte em andamento** | O usuário rejeitou "reservas" (raras) e "cadastros incompletos" (soa como cobrança). Mesmo dado virado do avesso: não é o que falta, é dinheiro esperando |
| 16 | Busca: **uma caixa só**, mistura peça e modelo, filtra ao vivo | Zero decisão sobre onde digitar |
| 17 | Busca é **local**; o ⌘K global continua existindo separado | Escopos diferentes. Filtrar prateleira dentro de modal é pior que filtrar na tela |
| 18 | Dentro do modelo: **grupos colapsáveis por área da moto** | É como mecânico e cliente pensam. Nunca ver 84 de uma vez |
| 19 | **Grade de cards com foto** | Peça usada se reconhece pela foto, não pelo nome |
| 20 | Densidade **híbrida**: decisão em cima, grade densa embaixo | Cobre atendimento rápido e navegação de catálogo |
| 21 | Painel direito: **Peças a unificar** + gráficos | Foi a escolha explícita do usuário |
| 22 | Gráficos: **Procura vs. estoque** e **Entradas vs. saídas** | Os dois que viram decisão de compra |
| 23 | **Edição por manipulação direta** — clicar no preço e digitar | Resolve "muito clique" sem violar a regra de uma ação por card: editar deixa de ser ação e vira o dado sendo tocado |
| 24 | Termos na UI: **"Peça"** e **"Unidades"** | É como o usuário já fala. Nenhum conceito novo pra ensinar |
| 25 | Linha de comando: existe, **escondida atrás de atalho** | Fora do caminho do funcionário, disponível pro dono |
| 26 | Cor significa **grau**; azul fica exclusivo de ação | Cor vira informação em vez de decoração |

### Cadastro

| # | Decisão | Por quê |
| --- | --- | --- |
| 27 | **Em lote, foto primeiro** | Escolher lote e setor uma vez, não 20. Corta o tempo pela metade |
| 28 | 1 foto principal obrigatória + até 3 extras | Garante o mínimo sem travar o cadastro no galpão |
| 29 | Mínimo pra salvar: **tipo, moto de origem, grau e foto** | Entra rápido, mas já nasce encontrável. Preço e local ficam pra depois |
| 30 | Recorte de fundo: **auto + clicar no resto + pincel pra restaurar**, com desfazer por etapa | Sem o restaurar, o operador fica refém do erro do automático e refaz a foto |
| 31 | **Mobile-first**, 320–430 px primeiro | Cadastrar no galpão é metade do trabalho |

### Componentes e movimento

| # | Decisão | Por quê |
| --- | --- | --- |
| 32 | Tema **claro**, igual às Tarefas | Foto de peça usada é escura e engordurada — some no dark |
| 33 | **Animate UI** para tabs e ações primárias | Fonte obrigatória segundo `docs/ui-component-sources.md` |
| 34 | **Bklit UI** para os gráficos | Idem |
| 35 | **UILora**: uma transição de destaque por fluxo | Não há pacote instalado — copy-first do Code Explorer |
| 36 | **Motion** para presença e layout; **Anime.js** para contadores curtos | Conforme design system |
| 37 | **DotMatrix como medidor de desmonte da carcaça** | Cada ponto = uma peça. Aceso = retirada, apagado = ainda na moto. Carrega mais informação que barra de progresso |
| 38 | Animação **contida e funcional** | Roda em celular fraco, em pé no galpão |

> ⚠️ **A decisão 37 é uma exceção aprovada.** `docs/DESIGN_SYSTEM.md` restringe
> DotMatrix a "indicador pontual de sincronização ou criticidade; nunca como
> ornamento repetido em listas". O usuário aprovou a exceção em **19/09/2026**,
> no mesmo formato da exceção do `TurnMetricStrip` (17/09).
> **Pendente:** registrar na skill `ux-user-audit` com motivo e limite, antes de
> qualquer implementação. Tratar como aprovação pontual, não como precedente.

---

## 5. Especificação das telas

Quatro blocos, detalhados em `docs/prompts/stitch-estoque-organizacao.md`.

**Bloco 1 — Estoque (principal).** Faixa de três oportunidades; busca local;
prateleira por modelo com distribuição de grau; ao abrir um modelo, grupos
colapsáveis por área com grade de cards de Peça; painel direito com unificação
e os dois gráficos.

**Bloco 2 — Detalhe da Peça.** Abas Unidades / Histórico / Anúncios. As N
unidades comparáveis lado a lado (SKU, foto própria, grau, preço, localização,
lote). Compatibilidade editável ali mesmo. Histórico de preço das vendidas.
Contador de procuras. **É aqui que vive a ação `Responder cliente`.**

**Bloco 3 — Cadastro em lote (mobile).** Passo 1: lote + setor, uma vez.
Passo 2: fotografar em sequência, sem classificar. Passo 3: classificar uma a
uma. A pergunta de compatibilidade aparece uma única vez por tipo + plataforma.
Editor de recorte com remover e restaurar.

**Bloco 4 — Aba Desmonte.** Carcaças abertas com o medidor dot matrix e
checklist do que falta tirar.

### 5.1 A ação principal

`Responder cliente` — **o único botão de acento preenchido da tela.**
Monta a mensagem pronta pro WhatsApp (foto recortada + grau + preço + prazo)
**e** reserva a unidade por 24 h no mesmo clique. Preview antes de confirmar,
com o prazo ajustável ali.

---

## 6. Identidade visual

A tela é **irmã** do `Painel de Operações do Turno`. Regras genéricas não
transferem assinatura visual — elementos concretos transferem. Reproduzir:

1. Contêiner externo arredondado com borda índigo; a tela não sangra até a borda.
2. **Sem barra de navegação de produto.** Começa no breadcrumb micro-caps.
3. Faixa de KPI com barra de acento à esquerda, rótulo micro-caps e **número
   grande isolado** — nunca embutido no meio da frase.
4. Um card-herói de foco, com borda colorida no card inteiro, pills de
   classificação à esquerda e identificador à direita.
5. Faixa de metadados em 4 colunas, micro-caps sobre o valor.
6. Botão primário com atalho embutido (`⌥Space`).
7. Cards do painel direito com barra colorida à esquerda e botões inline.
8. Linha de dica da IA ao final do painel direito.
9. Barra fixa no rodapé.

**Regras herdadas do design system:** um único botão de acento preenchido por
tela; alvo de toque ≥ 44 × 44 px; campos de texto ≥ 16 px em telas estreitas;
nenhuma superfície principal com rolagem horizontal; nada de `select`, `alert`
ou `confirm` nativos; em cards repetidos só a ação principal visível; sheets no
mobile e drawer/diálogo em `sm+`; animação só com `opacity` e `transform`,
respeitando `prefers-reduced-motion`.

---

## 7. O que foi gerado e auditado

### Rodada 1 (19/09) — Bloco 1, desktop + mobile

Auditoria completa em `docs/auditorias/ux-stitch-estoque-2026-09-19.md`.
Catorze achados. O conceito de organização traduziu bem; a execução de
interface tinha cinco violações de regras já escritas no projeto.

### Rodada 2 (21/09) — Bloco 1 corrigido, desktop

**Corrigido:** contagem de botões de acento (de 7 para ~2); código removido do
nível da Peça; navegação duplicada eliminada; hierarquia de ação no card
invertida corretamente; consistência visual com o Tarefas (7 dos 9 elementos
agora presentes — contêiner arredondado, KPIs em display, card-herói, faixa de
metadados em 4 colunas, botão com `⌥Space`, painel direito com barra colorida,
linha de comando no rodapé).

**Pendente:**

| ID | Severidade | Problema |
| --- | --- | --- |
| A-01 | **P1** | `Responder cliente` ainda não existe em tela nenhuma |
| A-06 | P1 | Números divergem: card do modelo diz Titan 160 com 112 peças, o painel diz Estoque 18 un. `+140%` não deriva de 42 ÷ 18 |
| A-11 | P2 | Nenhum estado vazio, de carregamento, de erro ou de busca sem resultado foi gerado |
| — | P2 | `PO CRÍTICO` com letra O; deveria ser `P0` (P-zero) |
| — | P2 | `Compativel` sem acento; `Guia de válvula stander` provavelmente `standard` |
| — | P2 | Chips de grau perderam a palavra: viraram `2 A`, `2 B`, `1 C`. Sem legenda, funcionário novo não decifra |
| — | P2 | Aba `Fila Geral` copiada do Tarefas sem significado no contexto de estoque |

**Blocos 2, 3 e 4 não foram gerados.** O cadastro em lote é o mais importante
que falta, porque é onde a duplicata nasce ou morre.

### 7.1 Erro de especificação cometido nesta sessão

Registrado para que você não o repita: o `BLOCO 0-B` instruiu que o card-herói
fosse "a peça mais procurada e sem saldo", enquanto o `BLOCO 0` dizia que o
único botão de acento é `Responder cliente`. Instruções incompatíveis. O Stitch
resolveu pela última, e o botão principal virou `Notificar Desmonte`.

**Consequência:** o trabalho raro ganhou o foco visual; o trabalho de cada dez
minutos ficou sem caminho.

**Correção:** o herói pode continuar sendo a demanda reprimida — é informação
urgente e boa —, mas em **outline**. O botão de acento preenchido mora no card
da Peça e no Detalhe, como `Responder cliente ⌥Space`.

---

## 8. Decisões humanas pendentes

**8.1 — Monoespaçada: a regra e a referência discordam.**
`docs/DESIGN_SYSTEM.md` diz: *"Não usar tipografia monoespaçada em novas
superfícies."* Mas a tela de Tarefas, que é a referência de identidade, **usa
mono** (`ID: OP-4821-EXP`, `32m 14s`, a linha de comando). A tela de Estoque
gerada seguiu o Tarefas.

Não corrija isso sozinho em nenhuma direção. Uma das duas fontes precisa ser
atualizada pelo usuário — senão o próximo agente "conserta" de volta e o
projeto oscila.

**8.2 — Permissões por perfil.** O usuário adiou: "isso pode ser decidido nas
configurações do sistema". Não invente a regra.

**8.3 — `Terminal do Atendente` / `Carrinho de Balcão`.** Conceito que o Stitch
inventou na rodada 1, fora da especificação. Compete com o fluxo de reserva sem
substituí-lo. Precisa de decisão: manter como feature própria ou descartar.

**8.4 — Custo do lote.** O usuário não registra hoje, mas disse que "se começar
a fazer, será melhor". O campo nasce vazio e opcional. Não construa nada em cima
dele ainda.

---

## 9. Critérios novos para a skill `ux-user-audit`

Pela regra intrínseca do projeto, estes saem desta sessão e devem ser
acrescentados antes de encerrar qualquer implementação:

> **Identificador no nível correto da hierarquia.** Quando um modelo de dados
> distingue tipo e exemplar físico, o código visível precisa pertencer a um
> único nível e ter o mesmo nome em todas as superfícies. Um código exibido no
> nível do tipo quando ele identifica o exemplar — ou dois prefixos diferentes
> para a mesma coisa entre desktop e mobile — reintroduz a ambiguidade que a
> separação existe para eliminar.

> **Formato único de endereço físico.** Um código de localização precisa ter um
> formato só em todo o produto. Variações livres de nomenclatura para o mesmo
> endereço impedem ordenação, filtro e conferência, e degradam para texto livre
> na prática. Casos especiais são atributo do endereço, nunca um segundo formato.

> **Instrução de identidade visual por elemento, não por princípio.** Ao
> especificar consistência entre telas irmãs, nomear os elementos concretos a
> reproduzir. Descrever só paleta, tipografia e densidade produz telas que
> obedecem as regras e inventam a composição.

---

## 10. Próximos passos, na menor sequência segura

1. Corrigir o `BLOCO 0-B` e rodar o Bloco 1 de novo, com `Responder cliente` no
   card da Peça e o herói em outline. Refazer no Stitch é mais barato que
   corrigir depois no código.
2. Gerar o **Bloco 2 — Detalhe da Peça**, onde a ação principal e o SKU por
   unidade realmente vivem.
3. Gerar o **Bloco 3 — Cadastro em lote mobile**. É onde a duplicata nasce ou
   morre; sem ele o conceito não está validado.
4. Resolver a decisão 8.1 (mono) e registrar a exceção do DotMatrix na skill.
5. Acrescentar os três critérios da seção 9 à skill.
6. Só então discutir implementação — em pasta isolada, como protótipo, **sem
   tocar no sistema em produção**, conforme o usuário já determinou.

---

## 11. Contexto que você precisa saber

- O usuário determinou que **nada do sistema de organização antigo deve ser
  reutilizado**. A gaveta morre. As palavras *Unidade* e *SKU* foram mantidas de
  propósito, porque descrevem realidade física (cinco motores são cinco objetos),
  não método de organização.
- O conceito peça-pai → unidades com SKU já está especificado e aprovado em
  `docs/superpowers/plans/2026-09-15-fichas-unidades-lista-sku.md`. O que é novo
  aqui é trocar a gaveta manual pela prateleira derivada da compatibilidade.
- O sistema novo deve ser construído **isolado**, em pasta separada do sistema em
  produção, como protótipo. Integração manual depois, se o usuário gostar.
- O galpão tem **funcionários** além do dono, que também usam o sistema. Por isso
  o grau precisa de critério objetivo e as alterações ficam registradas com o
  nome de quem fez.
- Base atual: 679+ itens, React 19 + Vite + TypeScript + Tailwind 4 (CSS-first),
  shadcn/ui, Capacitor Android, Express + Supabase.
