# Auditoria UX — Telas de Estoque geradas pelo Stitch

**Data:** 19/09/2026
**Escopo:** duas telas estáticas geradas pelo Stitch — `Estoque e Atendimento (Desktop)` e `Estoque & Balcão (Mobile)`.
**Método:** auditoria estática por inspeção visual, contra `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md`, `docs/DESIGN_SYSTEM.md` e a especificação em `docs/prompts/stitch-estoque-organizacao.md`.

---

## 1. Resumo executivo

**Fluxo auditado:** entrada na tela de Estoque, leitura da prateleira por modelo, abertura de um modelo (XRE 300), leitura dos cards de Peça e do painel de apoio.

**Objetivo do fluxo:** encontrar uma peça rápido para responder um cliente, e manter o catálogo livre de duplicatas.

**Resultado geral:** o **conceito de organização foi traduzido com sucesso** — a prateleira por modelo, o agrupamento por área da moto, o sinal de peça compartilhada e o painel de unificação estão todos presentes e legíveis. A execução de interface, porém, tem cinco problemas que já eram regra escrita no projeto, e **a ação principal da tela não existe**.

**Principais bloqueios:**
1. A ação `Responder cliente` — o motivo de a tela existir — não foi desenhada.
2. Seis a sete botões de acento preenchidos por tela, contra a regra de um.
3. Nome de peça truncado no mobile, exatamente a regressão que a Tarefa 10 da skill existe para impedir.
4. Navegação superior e abas usam os mesmos rótulos para contextos diferentes.
5. Números divergem entre desktop e mobile para o mesmo dado.

**Nível de confiança:** alto para composição, hierarquia, copy e conformidade com regras escritas. Baixo para contraste medido, foco de teclado, comportamento de rolagem e semântica acessível — nada disso é verificável em imagem estática. Nenhuma tela foi executada.

---

## 2. Fluxo percorrido

Percorri as duas telas como leitura estática, do cabeçalho ao rodapé, comparando desktop e mobile lado a lado para o mesmo dado. Não houve ambiente executável: não testei foco, teclado, rolagem em overlay, `prefers-reduced-motion`, estados de carregamento, vazio ou erro, nem responsividade real entre breakpoints. As telas geradas cobrem apenas o caminho feliz.

Cobertura do escopo pedido: **Bloco 1 gerado** (desktop e mobile). **Blocos 2, 3 e 4 não foram gerados** — não existem Detalhe da Peça, Cadastro em lote mobile nem aba Desmonte.

---

## 3. Achados

### A-01 · UX · P1 · A ação principal da tela não existe
**Evidência:** confirmado. Nenhuma das duas telas tem `Responder cliente`.
**Observado:** o caminho mais próximo é `Terminal do Atendente` → `Finalizar & Enviar Laudo`, um conceito de carrinho de balcão que o Stitch inventou e que não estava na especificação.
**Esperado:** botão único de acento que monta a mensagem de WhatsApp (foto recortada + grau + preço + prazo) e reserva a unidade por 24 h no mesmo clique.
**Impacto:** o uso mais frequente da tela — responder cliente no zap — não tem caminho. A tela vira consulta, não atendimento.
**Recomendação:** desenhar a ação no card da Peça e no detalhe da unidade. O `Terminal do Atendente` deve ser removido ou promovido a decisão consciente de produto; hoje ele compete com a reserva sem substituí-la.
**Decisão humana:** sim — manter ou descartar o carrinho de balcão.

### A-02 · UX · P1 · Sete botões de acento preenchidos por tela
**Evidência:** confirmado. Desktop: `+ Nova Peça/Lote`, `Anunciar em lote`, `+ Adicionar Peça`, `Unificar em Peça Única` (×2), `Finalizar & Enviar Laudo`, `Resolver Pendências`. Mobile tem contagem equivalente.
**Esperado:** `DESIGN_SYSTEM.md` — "Um único botão de acento preenchido por tela."
**Impacto:** nenhuma ação lê como *a* ação. O olho não tem âncora, e a ação rara (`Unificar`) tem o mesmo peso visual da ação frequente.
**Recomendação:** manter preenchido apenas o `Responder cliente` de A-01. Todo o resto vira outline ou texto.
**Seguro implementar:** sim.

### A-03 · BUG · P1 · Nome da peça truncado no mobile
**Evidência:** confirmado. `Corpo Injeção Eletrô...` e `Farol Principal Care...`.
**Esperado:** Tarefa 10 da skill — "Não usar `truncate` no nome principal da peça... permitir quebra de linha natural, inclusive em nomes muito longos sem espaços."
**Impacto:** é a regressão exata que esse critério foi escrito para impedir, com o caso real já documentado (`TAMPA DO CUBO TRASEIRO YES 125 ESPELHO DE FREIO`). O operador não consegue distinguir duas peças de nome parecido.
**Recomendação:** remover `truncate`, usar grade responsiva com coluna própria para o nome.
**Seguro implementar:** sim.

### A-04 · UX · P1 · Identificador no nível errado do modelo
**Evidência:** confirmado. Desktop mostra `Ref.MP-300` no card da **Peça**; mobile mostra `SKU-4402` no card da **Peça**.
**Esperado:** o SKU é da **Unidade**, não da Peça — é o que distingue uma das cinco unidades das outras quatro. A Peça não tem código próprio na especificação.
**Impacto:** grave conceitualmente. Um código no nível da Peça reintroduz exatamente a confusão entre "o que é isso" e "qual delas" que o redesenho existe para eliminar. Além disso, as duas telas usam sistemas diferentes (`Ref.` vs `SKU-`) para a mesma coisa.
**Recomendação:** remover o código do card da Peça. O SKU aparece só na linha da unidade, no Detalhe.
**Decisão humana:** sim, se você quiser de fato um código de catálogo por Peça — aí ele precisa de nome e regra próprios.

### A-05 · UX · P1 · Navegação e abas com rótulos duplicados
**Evidência:** confirmado. Navegação superior tem `Desmonte e Lotes`; as abas logo abaixo têm `Desmonte Ativo`. Desktop tem 2 abas, mobile tem 3 (`Lotes Abertos` extra).
**Esperado:** critério da skill — "Navegação e filtros com semântica única: não reutilize o mesmo conjunto de rótulos para controles que governam contextos diferentes."
**Impacto:** o usuário não sabe qual "Desmonte" leva aonde. Dois controles governando o mesmo contexto é defeito, não redundância.
**Recomendação:** o Desmonte é **lente** da tela de Estoque, conforme decidido. Remover da navegação superior, ou remover da aba — não os dois.
**Seguro implementar:** sim.

### A-06 · SEGURANÇA/DADOS · P1 · Números divergem entre desktop e mobile
**Evidência:** confirmado, quatro casos.
- Compatibilidade do motor de partida: desktop diz `CB 300R, CBF 300`; mobile diz só `Honda CB 300R`.
- XRE 300: desktop mostra Procura 94 / Estoque 84 (déficit de 10, ou −10,6%); mobile diz `−14% vs procura`.
- Biz 125: desktop mostra Procura 78 / Estoque 32 (−59%); mobile diz `−42% (Crítico)`.
- Desktop: `128 unidades físicas` para XRE 300; mobile não traz o total.
**Esperado:** critério da skill — "Fonte única para estado derivado... Um número que pode divergir da lista que ele resume é defeito de dados."
**Impacto:** em dados de demonstração isso é só inconsistência de mock, mas ele vira contrato visual na implementação. O percentual precisa ser derivado dos mesmos dois números exibidos.
**Recomendação:** calcular todo percentual a partir de procura e estoque renderizados; nunca escrever o percentual à mão.

### A-07 · UX · P2 · Hierarquia de ação invertida no card
**Evidência:** confirmado. `Ver unidades (5)` — a ação frequente — está em outline suave. `Resolver Pendências` — a ação rara — está preenchida em âmbar e domina o card.
**Impacto:** o olho é puxado para a exceção em vez do fluxo normal, em toda varredura da grade.
**Recomendação:** inverter. Pendência vira chip informativo clicável, não botão preenchido.
**Seguro implementar:** sim.

### A-08 · UX · P2 · Cinco formatos de localização coexistindo
**Evidência:** confirmado. `Prateleira E-04 · Gaveteiro 2`, `Prateleira E-02 · Caixa 11`, `Cofre / Armário Trancado C-01`, `Gaiola B-04`, `Prateleira A-12 / G-04`.
**Esperado:** formato decidido — setor + prateleira, dois níveis, código curto, ex. `A-03`.
**Impacto:** endereço que não tem formato único não dá para ordenar, filtrar, conferir nem gritar do outro lado do galpão. É o problema de organização voltando pela porta dos fundos.
**Recomendação:** um formato só, `A-03`. Casos especiais (cofre) viram atributo da prateleira, não outro formato de código.

### A-09 · QUALIDADE · P2 · Busca do mobile não filtra a lista
**Evidência:** confirmado. Campo mostra `Farol` preenchido com botão de limpar, mas abaixo aparecem os 4 modelos completos e o grupo `Motor & Propulsão` com Motor de Partida — nenhum farol.
**Impacto:** a tela documenta um comportamento errado. Quem implementar a partir dela reproduz o erro.
**Recomendação:** gerar o estado de busca ativa com a lista realmente filtrada e o contador `X resultados`.

### A-10 · QUALIDADE · P2 · Erro de copy
**Evidência:** confirmado. Mobile: `2 unidades · Lote 07 (Recém desgurnhado)`. Palavra inexistente.
**Recomendação:** provavelmente `Recém-desmontado`. Revisar toda a microcópia gerada.

### A-11 · ESTADO · P2 · Nenhum estado alternativo foi gerado
**Evidência:** confirmado. Só o caminho feliz existe.
**Esperado:** o prompt pedia vazio, busca sem resultado (com a ação `Registrar que um cliente pediu isso`), carregando com esqueleto, e erro com `Tentar novamente`.
**Impacto:** a busca sem resultado é especialmente importante, porque é ela que alimenta o dado de demanda reprimida — é feature, não estado de erro.
**Recomendação:** gerar os quatro estados numa segunda rodada.

### A-12 · A11Y · P2 · Risco de contraste e semântica não verificáveis
**Evidência:** risco provável, não confirmado. Rótulos micro-caps cinza, `Atualizado há 14m` e a legenda dos gráficos aparentam contraste baixo. Barras segmentadas de grau carregam significado por cor e posição.
**Impacto:** possível reprovação em WCAG AA e perda de informação para daltonismo.
**Recomendação:** medir na implementação. As barras segmentadas precisam de rótulo acessível; os números ao lado ajudam mas não substituem.

### A-14 · UX · P1 · Divergência visual com a tela de Tarefas
**Evidência:** confirmado, por comparação elemento a elemento com `Painel de Operações do Turno` e `Tela 2 — Tarefas abertas`.

A paleta e a tipografia batem, mas **oito elementos da assinatura visual do Tarefas não foram reproduzidos**:

| Elemento no Tarefas | No Estoque |
| --- | --- |
| Página inteira dentro de um contêiner arredondado com borda índigo visível | Ausente — a tela sangra até a borda |
| Nenhuma barra de navegação de produto; a tela começa no breadcrumb | Introduziu header completo com logo, nav de 4 itens, busca e botão |
| Card-herói da ação recomendada, com borda colorida inteira e pills `P0 CRÍTICO` | Ausente — não há foco visual único |
| Faixa de metadados em 4 colunas, micro-caps sobre o valor (`IMPACTO` / `SLA RESTANTE`) | Ausente em qualquer superfície |
| Números de KPI em display grande (`18`, `78 %`) com rótulo micro-caps acima | Os 3 cards de oportunidade põem o número inline na frase |
| Cards do painel direito com barra colorida à esquerda e botões inline (`Delegar`, `Desbloquear`) | Cards do rail são caixas brancas planas |
| Linha de comando fixa no rodapé | Ausente — foi para o ⌘K, conforme decidido, mas nada ocupou o lugar visual |
| Atalho de teclado dentro do botão primário (`⌥Space`) | Ausente |

**Impacto:** as duas telas parecem de produtos diferentes da mesma família, não do mesmo produto. O usuário identificou isso imediatamente, sem análise — que é o teste que importa.

**Causa provável:** o Bloco 0 do prompt descreveu a identidade por **regras** (paleta, tipografia, densidade) e não por **elementos concretos**. O Stitch obedeceu as regras e inventou a composição.

**Recomendação:** acrescentar ao prompt um bloco de consistência que nomeia os elementos reproduzíveis, não só os princípios. Está escrito em `docs/prompts/stitch-estoque-organizacao.md`, no `BLOCO 0-B`.

**Seguro implementar:** sim — é correção de prompt, não de código.

### A-13 · FEATURE · P3 · Invenções do Stitch que valem manter
**Evidência:** confirmado, fora de escopo mas positivo.
- `Imprimir Etiquetas` no cabeçalho do modelo — faz sentido operacional para o endereçamento físico e não estava na especificação.
- `Motivo:` explicando cada suspeita de duplicata ("mesmo código de fábrica Keihin e pinagem elétrica idêntica") — melhora muito a confiança na unificação.
**Recomendação:** incorporar os dois à especificação.

---

## 4. Backlog priorizado

**1. Correções imediatas**
- A-01 desenhar `Responder cliente` (impacto máximo, é a razão da tela)
- A-02 reduzir para um botão de acento preenchido
- A-03 remover truncamento do nome da peça
- A-05 resolver rótulos duplicados de navegação

**2. Melhorias importantes**
- A-04 tirar o código do nível da Peça
- A-06 derivar percentuais dos números exibidos
- A-07 inverter hierarquia de ação no card
- A-08 padronizar o formato de localização em `A-03`

**3. Funcionalidades recomendadas**
- A-11 gerar os quatro estados alternativos
- Gerar os Blocos 2, 3 e 4 (Detalhe da Peça, Cadastro em lote, aba Desmonte)
- A-13 incorporar `Imprimir Etiquetas` e o campo `Motivo` à especificação

**4. Refinamentos futuros**
- A-09 estado de busca coerente
- A-10 revisão de microcópia
- A-12 medição de contraste na implementação

---

## 5. Alterações realizadas

Nenhuma. Esta auditoria é somente de leitura, sobre telas estáticas fora do repositório. Nenhum arquivo de código foi tocado.

**Critérios novos a acrescentar à skill** a partir desta auditoria:

> **Identificador no nível correto da hierarquia:** quando um modelo de dados distingue tipo e exemplar físico, o código visível precisa pertencer a um único nível e ter o mesmo nome em todas as superfícies. Um código exibido no nível do tipo quando ele identifica o exemplar — ou dois prefixos diferentes para a mesma coisa entre desktop e mobile — reintroduz a ambiguidade que a separação existe para eliminar. Verificar em cada superfície qual entidade o código identifica antes de exibi-lo.

> **Formato único de endereço físico:** um código de localização precisa ter um formato só em todo o produto. Variações livres de nomenclatura para o mesmo endereço impedem ordenação, filtro e conferência, e degradam para texto livre na prática. Casos especiais são atributo do endereço, nunca um segundo formato.

---

## 6. Pendências e riscos

- Auditoria **estática**. Não foram testados foco, teclado, rolagem em overlay, bloqueio de scroll de fundo, `prefers-reduced-motion`, alvos de toque medidos, responsividade real entre breakpoints, nem leitor de tela.
- Contraste é estimativa visual, não medição.
- Blocos 2, 3 e 4 não existem — metade do fluxo (detalhe e cadastro) continua sem avaliação. O cadastro em lote é onde a duplicata nasce ou morre, então ele é o mais importante que falta.
- A exceção aprovada do DotMatrix ainda não foi exercida, porque a aba Desmonte não foi gerada. O registro na skill continua pendente.
- `Terminal do Atendente` / `Carrinho de Balcão` é conceito novo não decidido. Precisa de decisão sua antes de virar requisito.

---

## 7. Próximos passos

A menor sequência segura:

1. Rodar o Bloco 1 de novo no Stitch com as correções A-01 a A-05 explicitadas — são as quatro que mudam a tela estruturalmente, e refazer é mais barato que corrigir depois no código.
2. Só então gerar o Bloco 2 (Detalhe da Peça), que é onde `Responder cliente` e o SKU por unidade realmente vivem.
3. Depois o Bloco 3 (Cadastro em lote mobile).
4. Acrescentar os dois critérios novos à skill antes de qualquer implementação.
