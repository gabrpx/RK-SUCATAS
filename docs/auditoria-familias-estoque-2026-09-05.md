# Auditoria profunda — Famílias de peça (Estoque)

Data: 2026-09-05
Escopo: `docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md` e toda a superfície de código listada no pedido de auditoria.
Método: leitura completa de banco/rotas/domínio/UI/consumidores (7 subagentes dedicados, cada um com citação `arquivo:linha`) + exploração ao vivo somente-leitura da aplicação real (produção) + suíte de testes existente.
Nenhum arquivo de `src/`, `supabase/` ou config foi alterado nesta sessão. Nenhuma migration foi rodada. Nenhuma ação de escrita foi executada no banco de produção.

---

## 1. Resumo executivo

A fundação de dados (`estoque_familias`, `familia_id`, sincronização de `estoque_unidades`) e a tabela/modal principais **já estão em produção e funcionando** — confirmei ao vivo (214 itens reais, famílias agrupando corretamente, badge de contagem, faixa de preço, soma de quantidade todos corretos). O problema não é "a feature não funciona"; é que **o invariante que ela promete (`quantidade == unidades físicas`) já quebra hoje nos dois caminhos mais comuns do sistema** — editar a quantidade de uma peça e vender sem escolher uma unidade específica — e ninguém é avisado quando isso acontece. Encontrei, ao vivo, uma duplicata 100% idêntica de nome não fundida (prova de que a organização que a feature promete ainda não se sustenta sozinha) e um botão de exclusão de família sem nenhuma confirmação.

**Os 3 riscos mais graves** (detalhe nos achados P0, seção 3):
1. Editar a quantidade de uma peça com alguma unidade diferenciada (avaria/apelido/preço/nota própria) pode gravar a nova quantidade e falhar ao sincronizar as unidades — o erro aparece, mas a corrupção já aconteceu e fica (`estoque.ts:582-588`).
2. Vender mais de 1 unidade sem escolher uma ficha específica — o caminho **padrão e incentivado** da tela de Vendas — nunca toca `estoque_unidades`, então toda venda múltipla genérica desalinha o estoque físico do número mostrado.
3. "Excluir família" apaga o registro (nome, categoria, descrição, foto, todo o trabalho de organização) **sem pedir confirmação nenhuma** no caminho feliz.

**As 3 maiores oportunidades** (detalhe na seção 6):
1. Mover a sincronização de unidades pra dentro da mesma transação/RPC que grava `quantidade`, e fazer a venda genérica também decrementar unidades — fecha o buraco de integridade na origem.
2. Expor a edição de família (a API já existe e funciona, só falta o botão) e alertar sobre duplicata na criação/importação — ataca a causa-raiz da fragmentação que a feature existe pra resolver.
3. Aposentar o caminho antigo de "adicionar unidade" (`UnidadesEstoque.tsx`, hoje morto — sempre retorna 400 — mas ainda alcançável pela busca) e levar um mínimo de consciência de família pra Vendas e Mercado Livre/Shopee.

A feature está pronta pra uso do dia a dia com essas ressalvas, mas **não deveria ser apresentada como "o estoque bate certo agora"** até o achado P0-1/P0-2 (integridade) ser corrigido — hoje o board de "quantidade" pode mentir silenciosamente.

---

## 2. Veredito por eixo

| Eixo | Nota | Justificativa |
|---|---|---|
| **Função** | 5/10 | Os fluxos-âncora (ver família, registrar unidade pelo modal novo, sugerir fusão) funcionam de verdade, confirmado ao vivo — mas editar família não existe, excluir não confirma, busca sem resultado fica em branco, e existem duas UIs divergentes de unidade dependendo de como o usuário chega na peça. |
| **Integridade** | 3/10 | O mecanismo de proteção (função SQL de sincronização) é bem escrito isoladamente, mas o jeito como o backend Node o chama quebra o invariante nos 2 caminhos de escrita mais frequentes do sistema (editar quantidade, vender), de forma silenciosa e sem rollback. |
| **Organização** | 4/10 | Prova ao vivo de que agrupar por família funciona e ajuda — mas zero prevenção de duplicata na criação/importação (achei uma duplicata 100% idêntica não fundida em produção), sem fusão entre famílias já existentes, sem edição de nome. |
| **Legibilidade** | 6/10 | Hierarquia número/label correta, zero cor hardcoded em 10 arquivos auditados — mas 2 botões `accent` podem coexistir na mesma tela, alvo de toque abaixo do padrão do projeto nos 3 componentes novos, e o card de família no mobile não mostra valor. |
| **Sistema** | 4/10 | O isolamento de Vendas/ML/Shopee/Orçamentos/Dashboard é deliberado e "funciona" por definição (código não tocado) — mas cria fricção real em cada fronteira (venda sem saber que é a mesma peça-mãe, anúncio "pendurado" após mover unidade, zero reserva de orçamento). Cobertura de teste de integração é próxima de zero. |

---

## 3. Achados

Numerados por severidade. **P0** = quebra/corrompe dado · **P1** = atrapalha o uso diário · **P2** = incomoda · **P3** = polimento.

### P0 — quebra ou corrompe dado

---

#### F01 — Editar quantidade pode corromper o invariante sem reverter nada

**O que acontece / o que deveria acontecer:** `PUT/PATCH /api/estoque/:id` grava `quantidade` na tabela `estoque` e só DEPOIS chama a função de sincronização de `estoque_unidades`, em duas chamadas HTTP/PostgREST separadas, sem transação compartilhada. Se a sincronização falhar (não sobra unidade "em branco" suficiente pra apagar), a API responde 400 dizendo que a operação foi recusada — mas a `quantidade` **já foi gravada e commitada** no passo anterior e não é revertida. O usuário lê "operação recusada" e acredita que nada mudou; na realidade, `estoque.quantidade` já está errado.

**Reprodução (verificado por leitura de código, com números concretos):** ficha com `quantidade=4` e 4 unidades não vendidas (U1, U2, U4 em branco; U3 com `apelido='Motor riscado'`). Usuário edita a peça e digita `quantidade=0` (erro de digitação, por exemplo). Sequência real:
1. `UPDATE estoque SET quantidade=0` — commita na hora.
2. `sincronizar_unidades_estoque(id, 0)`: precisa apagar 4 unidades, só 3 são "em branco" (U3 tem dado próprio) → `RAISE EXCEPTION`.
3. Rota responde `400` com a mensagem de erro da função.
4. Estado real no banco: `quantidade=0`, mas ainda existem as 4 linhas em `estoque_unidades` (nenhuma foi apagada, a exceção disparou antes do `DELETE`).

**Causa-raiz:** [`src/server/routes/estoque.ts:582-588`](../src/server/routes/estoque.ts) — `update(payload)` na linha 582 confirma antes do `if (payload.quantidade !== undefined) { sincronizarUnidades(...) }` das linhas 585-588. Mesmo padrão, em loop, em `bulk-update-quantidade` (`estoque.ts:1127-1152`, cada item do lote commita `quantidade` antes de sincronizar — um erro no item N não desfaz o item N nem impede que os itens já processados fiquem inconsistentes). A própria função SQL (`sincronizar_unidades_estoque`, `supabase/migration_057_estoque_unidades_explicitas.sql:79-81`) está correta isoladamente — o bug é na orquestração Node, não no SQL.

**Impacto no dia a dia:** qualquer correção de quantidade numa peça que tenha ficha diferenciada (a MAIS comum de errar, porque é exatamente a peça que teve avaria/apelido/preço próprio anotado) pode deixar o número da tela desalinhado da realidade física, sem nenhum aviso visível — a próxima pessoa que confiar em "quantidade" (vendedor, auditor de fim de mês) trabalha com dado errado.

**Correção proposta:** mover a atualização de `quantidade` pra dentro da própria função SQL `sincronizar_unidades_estoque` (ela já roda no banco; que ela também faça o `UPDATE estoque SET quantidade = ...` como primeiro passo, tudo na mesma transação plpgsql) e o backend chamar só essa RPC única. Se a sincronização falhar, o `ROLLBACK` automático da função desfaz a mudança de quantidade junto.

---

#### F02 — Venda sem escolher unidade específica nunca sincroniza `estoque_unidades`

**O que acontece / o que deveria acontecer:** a função `registrar_venda` (versão vigente em `supabase/migration_059_registrar_venda_valor_liquido.sql:29`) só marca uma linha de `estoque_unidades` como vendida quando `p_unidade_id` é informado. Esse parâmetro é **opcional** — a tela de Vendas trata "ficha específica" como algo a mais, não obrigatório, e é o caminho normal para vender mais de 1 unidade de uma vez.

**Reprodução (verificado por leitura de código):** ficha com `quantidade=3`, 3 unidades em branco (`vendida_em is null`). Vendedor vende 2 unidades pela tela normal, sem clicar em "ficha específica" (campo opcional). `registrar_venda(p_quantidade=2, p_unidade_id=null)`: só roda `UPDATE estoque SET quantidade = quantidade - 2` (`migration_059:118`). Nenhuma linha de `estoque_unidades` é tocada. Resultado: `quantidade=1`, mas as 3 linhas de unidade continuam lá, nenhuma marcada como vendida — sem erro, sem aviso.

**Causa-raiz:** [`supabase/migration_059_registrar_venda_valor_liquido.sql:109-123`](../supabase/migration_059_registrar_venda_valor_liquido.sql) (branch `p_unidade_id is null`); confirmado como caminho incentivado pela UI em [`src/features/vendas/VendasView.tsx:379`](../src/features/vendas/VendasView.tsx) (comentário no próprio código: "ficha específica: sempre opcional") e `src/server/routes/vendas.ts:33,60` (nada exige `unidade_id` quando `quantidade > 1`).

**Impacto no dia a dia:** é o cenário mais comum de venda no balcão (vender "2 escapamentos" sem escolher qual fisicamente) — toda vez que isso acontece numa peça com unidades diferenciadas por baixo, o card de unidade no modal de família continua mostrando "Disponível" pra uma peça que já foi entregue ao cliente.

**Correção proposta:** dentro de `registrar_venda`, quando `p_unidade_id` é nulo e `p_quantidade > 1`, marcar automaticamente as N unidades "em branco" mais antigas como vendidas (mesmo critério de prioridade que a sincronização já usa) em vez de só decrementar o contador — ou tornar a escolha de unidade obrigatória na UI sempre que a ficha tiver `estoque_unidades` (o que hoje é sempre, pós-backfill).

---

#### F03 — Excluir unidade (ou a ficha inteira) não protege histórico de venda

**O que acontece / o que deveria acontecer:** duas rotas apagam fisicamente linhas relacionadas a `estoque_unidades` sem checar se alguma já foi vendida:
- `DELETE /api/estoque/:id/unidades/:unidadeId` (unidade avulsa) apaga a linha direto, sem checar `vendida_em` nem dado próprio, e **não ajusta `estoque.quantidade`**.
- `DELETE /api/estoque/:id` (a ficha inteira) apaga a `estoque` e, por `estoque_unidades.estoque_id ... on delete cascade` (`supabase/migration_014_unidades_avaria.sql:39`), leva junto TODAS as unidades da ficha — vendidas ou não, sem checar nada antes.

Em ambos os casos, `vendas.unidade_id` tem `on delete set null` (`supabase/migration_038_vendas_unidade.sql:29`) — a venda histórica perde silenciosamente o vínculo com a unidade física que a originou, contradizendo o propósito documentado do "soft marker" (o próprio comentário da migration_038 diz que o objetivo é "preservar o histórico... mesmo depois de vendida").

**Reprodução (verificado por leitura de código):** ficha com `quantidade=3`, 3 unidades, 1 já vendida (`vendida_em` preenchido). Usuário exclui exatamente essa unidade pelo kebab do modal de família (só pede `confirm()` nativo, sem checar `vendida_em`). `count(estoque_unidades)` cai pra 2, `quantidade` continua 3 — quebra até a definição mais literal do invariante. A venda histórica associada perde a referência à unidade.

**Causa-raiz:** [`src/server/routes/estoque.ts:803-819`](../src/server/routes/estoque.ts) (delete de unidade avulsa, sem filtro `vendida_em`); [`src/server/routes/estoque.ts:617-632`](../src/server/routes/estoque.ts) (delete da ficha inteira, mesma ausência de checagem); chamado de [`src/features/estoque/EstoqueFamiliaModal.tsx:380-389`](../src/features/estoque/EstoqueFamiliaModal.tsx) (unidade única) e `:395-413` (lote).

**Impacto no dia a dia:** organizador limpando fichas antigas ("essa unidade já vendeu, não preciso mais dela na lista") apaga sem querer o rastro da venda — se o cliente reclamar depois, não dá mais pra achar qual unidade física ele recebeu.

**Correção proposta:** replicar em `DELETE .../unidades/:unidadeId` e em `DELETE /:id` a mesma regra que `estoqueFamilias.ts` já usa pra excluir família — bloquear (ou pedir confirmação extra explícita) quando existe `vendida_em` preenchido, e no caso de unidade avulsa, decrementar `quantidade` junto quando a exclusão é permitida.

---

#### F04 — "Registrar unidade" pela tela antiga está permanentemente quebrado, e ainda é alcançável

**O que acontece / o que deveria acontecer:** `POST /api/estoque/:id/unidades` (usado pelo componente antigo `UnidadesEstoque.tsx`) tem uma guarda que rejeita criar unidade nova sempre que `count(estoque_unidades) >= item.quantidade`. Essa premissa valia **antes** da migration_057 (só existiam fichas pra unidade "diferente"); depois do backfill, toda peça passa a ter exatamente `quantidade` linhas — a guarda fica **permanentemente verdadeira**, pra sempre, pra qualquer peça. **Confirmei ao vivo que o backfill já rodou em produção** (toda ficha que inspecionei já tem exatamente `quantidade` unidades cadastradas) — então esse caminho está morto agora, não é um risco futuro.

O próprio cabeçalho da migration já documentava essa consequência como aceita, mas condicionada a um redesenho ("Plano C") que não chegou a acontecer no `UnidadesEstoque.tsx` antigo — só no componente novo:

> "essa rota vai devolver 400 incondicionalmente, pra sempre, até um plano futuro ('Plano C') redesenhar 'Registrar unidade' pra diferenciar uma linha em branco já existente via PATCH em vez de inserir linha nova."
> — `supabase/migration_057_estoque_unidades_explicitas.sql:42-45`

O componente **novo**, `RegistrarUnidadeDialog.tsx`, já faz exatamente esse redesenho corretamente (usa `PATCH` numa unidade em branco existente). Mas o componente **antigo**, `UnidadesEstoque.tsx`, continua chamando o `POST` quebrado — e continua alcançável: clicar numa sugestão da busca dentro do Estoque, ou usar a busca global do app, abre o `DetailModal` com `UnidadesEstoque.tsx`, não o `EstoqueFamiliaModal` novo.

**Reprodução (verificado por leitura de código, mecanismo confirmado ao vivo):**
1. Balcão busca "escapamento cg titan" na busca global ou nas sugestões do Estoque.
2. Clica no resultado → abre `DetailModal` → `UnidadesEstoque.tsx`.
3. Clica "adicionar unidade", preenche o formulário, salva.
4. `estoqueApi.criarUnidade` → `POST /api/estoque/:id/unidades` → sempre `400`: *"Esta peça tem N unidade(s) em estoque e já N ficha(s) cadastrada(s). Aumente a quantidade ou revise as fichas existentes."* (mensagem exata, `estoque.ts:746-750`).

**Causa-raiz:** [`src/features/estoque/UnidadesEstoque.tsx:104`](../src/features/estoque/UnidadesEstoque.tsx) → [`src/features/estoque/api.ts:46-47`](../src/features/estoque/api.ts) (`criarUnidade`) → [`src/server/routes/estoque.ts:740-751`](../src/server/routes/estoque.ts) (guarda sem filtro `vendida_em`, sempre verdadeira pós-backfill). Caminho de entrada: `EstoqueBuscaSugestoes.tsx` → `onSelectItem` → `EstoqueView.tsx:1094` → `App.tsx` `DetailModal` (`App.tsx:58,468`) → `UnidadesEstoque.tsx`.

**Impacto no dia a dia:** qualquer pessoa que chegue numa peça pela busca (o caminho MAIS natural pro funcionário de balcão, persona 2 do enunciado) e tente adicionar uma unidade vai bater numa mensagem de erro confusa, sempre, sem entender por quê — a solução (usar o modal de família) não é óbvia a partir dali.

**Correção proposta:** aposentar o botão "adicionar unidade" de `UnidadesEstoque.tsx` (ou redirecionar pro fluxo do `EstoqueFamiliaModal`/`RegistrarUnidadeDialog`), já que o caminho correto já existe em outro componente.

---

#### F05 — Excluir família não pede nenhuma confirmação no caminho feliz

**O que acontece / o que deveria acontecer:** o botão "Excluir" no rodapé do modal de família, quando nenhuma unidade da família foi vendida, chama a API de exclusão **direto**, sem nenhum diálogo de confirmação. Só existe `confirm()` nativo no caminho de EXCEÇÃO (quando a API recusa por causa de unidade vendida). A ação de maior escopo do modal — apagar nome, categoria, descrição e foto da família, desfazendo todo o agrupamento (possivelmente construído a mão via "Fundir") — é a única das ações destrutivas do modal sem confirmação alguma.

**Reprodução:** verificado por leitura de código — deliberadamente **não testei clicando de verdade**, porque a ação excluiria um registro real de produção sem chance de desfazer.

**Causa-raiz:** [`src/features/estoque/EstoqueFamiliaModal.tsx:415-432`](../src/features/estoque/EstoqueFamiliaModal.tsx) (`handleExcluirFamilia`) — chama `estoqueFamiliasApi.excluir(...)` sem nenhum `confirmar()`/`window.confirm()` antes; compare com `handleExcluirUnidade` (`:380-389`, tem `confirm()`) e com o Fundir (`EstoqueFundirFamiliasModal.tsx:233-238`, usa o `useConfirm()` estilizado do design system).

**Impacto no dia a dia:** um clique errado no botão "Excluir" (que fica na mesma fileira de "Registrar unidade", separado só por um espaçador flex) apaga o trabalho de organização da família sem chance de desfazer — o estoque físico sobrevive (`familia_id` volta a `null` via `on delete set null`), mas o nome/categoria/foto/agrupamento somem.

**Correção proposta:** usar o mesmo `useConfirm()` estilizado que o Fundir já usa, com resumo do que será perdido ("apagar 'Tanque CG 150' — N fichas voltam a ficar avulsas").

---

### P1 — atrapalha o uso diário

---

#### F06 — Mover unidade entre grupos: corrida de dados sem lock na leitura inicial

**O que acontece:** `mover_unidade_estoque` lê a ficha de origem da unidade (`select estoque_id ... from estoque_unidades where id = p_unidade_id`) **sem lock**, e só trava (`for update`) as duas linhas de `estoque` envolvidas depois — tarde demais pra proteger a decisão já tomada sobre qual é a "origem".

**Reprodução (verificado por leitura de código, números concretos):** unidade U pertence à ficha X. `X.quantidade=5`, destino D1 `quantidade=2`, destino D2 `quantidade=0`. Duas chamadas quase simultâneas: A move U→D1, B move U→D2. Ambas leem `estoque_id=X` antes de qualquer lock. A trava X primeiro e conclui certo (X:4, D1:3, ambos batendo com a contagem real). B, que esperava a trava de X, prossegue com o `v_ficha_origem_id=X` que capturou **antes** — desatualizado, já que U está em D1 agora. B: `estoque_unidades.estoque_id=D2` (rouba U de D1 sem D1 saber), `X.quantidade = 4-1 = 3` (decrementada de novo, agora fantasma-negativa: 3 no banco, 4 linhas reais), `D2.quantidade=1` (bate). D1 fica com `quantidade=3` mas só 2 linhas reais (fantasma-positiva). Nenhuma das duas chamadas retorna erro.

**Causa-raiz:** [`supabase/migration_060_mover_unidade_estoque.sql:18-21`](../supabase/migration_060_mover_unidade_estoque.sql) (leitura sem lock) vs `:36-43` (lock só nas fichas, tarde). Compare com `registrar_venda`, que trava a unidade **antes** de decidir (`migration_059:94-96`) — o padrão certo já existe no mesmo código-base, só não foi replicado aqui.

**Impacto no dia a dia:** baixa probabilidade (exige dois cliques quase simultâneos na mesma unidade, dois dispositivos ou duas abas), mas quando acontece o erro é silencioso e cumulativo — quantidade errada que só um auditor atento notaria.

**Correção proposta:** `select ... for update` na linha de `estoque_unidades` antes de ler `estoque_id`, mesmo padrão de `registrar_venda`.

---

#### F07 — Cancelar venda: corrida de dados por falta de lock

**O que acontece:** `cancelar_venda` lê a venda (`select * into v_venda from vendas where id = p_venda_id`) sem `for update`. Dois cancelamentos concorrentes da mesma venda (duplo clique antes do botão desabilitar, duas abas, um retry de rede) ambos leem o mesmo estado e ambos incrementam `estoque.quantidade` — os `UPDATE`s se compõem (não se perdem), enquanto os `DELETE` de `vendas`/`caixa` são idempotentes (sem efeito na segunda chamada). Resultado: quantidade incrementada 2x, unidade restaurada só uma vez (efeito idempotente do `update ... set vendida_em = null`) — 1 unidade fantasma, sem erro em nenhuma das duas chamadas.

**Causa-raiz:** [`supabase/migration_038_vendas_unidade.sql:185,194`](../supabase/migration_038_vendas_unidade.sql). Mitigação parcial existente: `disabled={cancelando}` em `src/features/vendas/VendasView.tsx:255` evita duplo-clique na MESMA aba, mas não entre abas/dispositivos.

**Impacto no dia a dia:** baixa probabilidade, mas gera exatamente o tipo de "sobra fantasma" que um auditor de fim de mês não consegue explicar.

**Correção proposta:** `select ... for update` na leitura de `v_venda`.

---

#### F08 — Badges "Melhor estado" e "Melhor preço" calculados com valor errado

**O que acontece / o que deveria acontecer:** dentro de cada grupo modelo/ano, os badges deveriam refletir a condição/preço real (herdado ou próprio) de cada unidade. Só que:
- `melhorEstadoId` chama `condicaoNotaDaUnidade(u, null)` com **`null` fixo** no lugar da nota herdada real da ficha-mãe daquela unidade — em vez de `condicaoNotaDaUnidade(u, ficha_da_unidade.condicao_nota)`.
- `melhorPrecoId` usa um único `valorPadrao = grupo.itens[0]?.valor` fixo pra TODAS as unidades do grupo, mesmo quando as unidades vêm de fichas-filhas diferentes com preços próprios diferentes.

**Reprodução (achado por leitura de código, CONFIRMADO ao vivo com dado real em produção):** ao vivo, abri a família "MÓDULO DE INJEÇÃO CG TITAN 150 KVS-F02" (2 unidades, RK-0229 e RK-0228, ambas condição 10/10, ambas `valor: 0`). O card RK-0229 ganhou os dois badges "Melhor estado" e "Melhor preço"; RK-0228 nenhum — um desempate arbitrário de ordem de iteração (não de dado real), exatamente o comportamento previsto pela leitura de código para um empate exato. Cenário de erro real (não apenas empate) construído por leitura de código: grupo com ficha A (`itens[0]`, `valor=100`, `condicao_nota=8`) e ficha B (`valor=50`, `condicao_nota=3`), cada uma com 1 unidade em branco. Preço herdado real: A=R$100, B=R$50 (B deveria ganhar "Melhor preço"). Mas como `valorPadrao` vem fixo de `itens[0]` (A, R$100), a comparação usa R$100 pras DUAS unidades — empate artificial, badge fica em A (errado). A faixa de preço mostrada ao lado do mesmo grupo (calculada corretamente, por unidade) mostraria R$50–100 — uma contradição visível na mesma tela entre o badge e a faixa.

**Causa-raiz:** [`src/features/estoque/EstoqueFamiliaModal.tsx:56-63`](../src/features/estoque/EstoqueFamiliaModal.tsx) (`melhorEstadoId`, `null` fixo) e `:65-71` (`melhorPrecoId`, `valorPadrao` fixo de `itens[0]`), chamadas em `:253-257` com `valorPadrao = grupo.itens[0]?.valor ?? 0`. Zero cobertura de teste (`EstoqueFamiliaModal.test.tsx` não menciona "melhor estado"/"melhor preço" nenhuma vez).

**Impacto no dia a dia:** funcionário de balcão confia no badge pra recomendar a unidade mais barata/melhor pro cliente sem checar os números um a um — o badge pode estar apontando pra unidade errada.

**Correção proposta:** passar a ficha-mãe correta de cada unidade (não um valor fixo do grupo) pras duas funções — `condicaoNotaDaUnidade(u, fichaDaUnidade(u).condicao_nota)` e o mesmo padrão pro preço.

---

#### F09 — Duplicata 100% idêntica não fundida, vivendo em produção agora

**O que acontece:** confirmei via chamada direta à API real (`fetch('/api/estoque')`, somente leitura) duas fichas com nome **caractere-por-caractere idêntico** — `"MÓDULO DE INJEÇÃO CG TITAN 150 KVS-F02"` — uma dentro de uma família (`familia_id: "bf2706de-8ba4-4c9b-a827-c188b6238bc1"`), outra órfã (`familia_id: null`). Jaccard entre os nomes = 1,0 (idêntico) — o caso **mais fácil possível** de detectar por `detectarDuplicata.ts`, e mesmo assim não foi fundido.

**Reprodução (verificado em execução, dado real):**
```
GET /api/estoque → dois registros com nome "MÓDULO DE INJEÇÃO CG TITAN 150 KVS-F02":
  { id: "8e3c6d71-...", familia_id: "bf2706de-...", valor: 0, quantidade: 1 }
  { id: "70437b0e-...", familia_id: null,            valor: 0, quantidade: 1 }
```

**Causa-raiz:** não há checagem de duplicata na criação (`POST /api/estoque`) nem na edição — `detectarDuplicata.ts` só roda dentro da tela "Fundir famílias" (`EstoqueFundirFamiliasModal.tsx`), quando o usuário abre essa tela manualmente. Não há gatilho automático nem periódico.

**Impacto no dia a dia:** prova que a organização não se sustenta sozinha — a cada peça nova cadastrada (manual ou por planilha, ver F18), o catálogo pode voltar a fragmentar, e o único jeito de perceber é o dono abrir "Fundir" de novo e escanear tudo de novo.

**Correção proposta:** rodar `detectarDuplicata` contra peças/famílias já existentes ANTES de salvar uma peça nova (criação manual e importação), com aviso "já existe algo parecido — vincular à família X?" em vez de deixar criar direto.

---

#### F10 — "R$ 0,00" indistinguível de "preço nunca definido" na família

**O que acontece:** as duas fichas do achado F09 têm `valor: 0` (um zero de verdade gravado no banco, não `null`) — então a família mostra "Valor total R$ 0,00" e "Faixa 0" como se fosse um preço deliberado. Peças avulsas sem preço, na mesma tabela, mostram um link "Definir" em vez de "R$ 0,00" — ou seja, o sistema já sabe distinguir os dois estados em outro lugar, só não nesta agregação.

**Reprodução:** verificado em execução — ver captura de dado real no achado F09 (`valor: 0` explícito, não `null`).

**Causa-raiz:** não há validação de preço obrigatório na criação manual de peça nem na importação de planilha — `valor` aceita `0` sem alerta. A agregação de família (`valorEmEstoqueFamilia`, `familiaEstoque.ts:89-91`) soma o que está gravado, corretamente, mas não distingue "0 deliberado" de "0 porque ninguém preencheu".

**Impacto no dia a dia:** um balconista olhando a família pode achar que a peça literalmente não vale nada, em vez de perceber que falta precificar — no caso real observado, isso está acontecendo com uma peça em estoque agora.

**Correção proposta:** tratar `valor === 0` igual a "sem preço" (mostrar "Definir" também na agregação de família), ou distinguir os dois estados no schema (`valor_definido boolean`).

---

#### F11 — Duas UIs divergentes de "unidade" dependendo de como o usuário chega na peça

**O que acontece:** a mesma ficha abre um componente de detalhe diferente dependendo do caminho de entrada. Clicar na linha da tabela/no card de família abre `EstoqueFamiliaModal.tsx`, com seu próprio `UnidadeCard` (badges "melhor estado"/"melhor preço", menu com editar/excluir/marcar vendida, seleção múltipla). Clicar numa sugestão de busca (`EstoqueBuscaSugestoes`) ou usar a busca global abre `App.tsx`'s `DetailModal`, que usa `UnidadesEstoque.tsx` — uma implementação de card de unidade **completamente separada e mais antiga** (lista `<li>`, formulário próprio), sem noção nenhuma de família e com o botão "adicionar unidade" permanentemente quebrado (F04).

**Reprodução:** verificado por leitura de código — `EstoqueFamiliaModal.tsx` não importa `UnidadesEstoque.tsx`; `UnidadesEstoque.tsx` só é usado dentro de `App.tsx:58,468` (`DetailModal`), aberto por `EstoqueBuscaSugestoes` (`EstoqueView.tsx:1094→:173`) e pela busca global do app.

**Causa-raiz:** `src/features/estoque/UnidadesEstoque.tsx` (implementação paralela) vs `src/features/estoque/EstoqueFamiliaModal.tsx:99-215` (`UnidadeCard` novo).

**Impacto no dia a dia:** a mesma peça mostra informação e ações diferentes dependendo de como o funcionário chegou nela — quem aprendeu o fluxo novo (pelo modal de família) fica confuso quando cai no antigo (pela busca), e vice-versa.

**Correção proposta:** fazer a busca/`DetailModal` abrirem sempre `EstoqueFamiliaModal` (tratando ficha avulsa como família de 1, que já é o comportamento padrão hoje na tabela), aposentando `UnidadesEstoque.tsx`.

---

#### F12 — Chevron (detalhe antigo) e clique-na-linha (modal novo) competem na mesma linha avulsa

**O que acontece:** numa linha avulsa (sem família), o chevron de expandir (`stopPropagation`) abre `EstoqueItemExpandido.tsx` inline (categoria completa, avaria com descrição textual, anúncios, grade de fotos); clicar em qualquer outro ponto da mesma linha abre `EstoqueFamiliaModal.tsx` tratando a ficha como "família de 1" (accordion, cards de unidade com ações). As duas mostram fotos (parcialmente redundante) e cada uma tem informação que a outra não tem (descrição de avaria só no Expandido; ações de unidade só no Modal).

**Reprodução:** verificado por leitura de código — `EstoqueView.tsx:585-593` (chevron com `stopPropagation`) vs `:1177`/`:1231` (`onClick` incondicional do resto da linha).

**Causa-raiz:** dois sistemas de detalhe coexistindo na mesma linha sem um substituir o outro.

**Impacto no dia a dia:** usuário não sabe qual clicar pra ver o que precisa, e pode não descobrir a descrição da avaria (só existe no caminho do chevron) enquanto está no modal de família.

**Correção proposta:** unificar — levar a descrição de avaria pro `UnidadeCard` do modal novo e aposentar `EstoqueItemExpandido` como ponto de entrada por clique (pode continuar existindo como seção dentro do modal novo).

---

#### F13 — Fundir/Desvincular não-atômicos, e família esvaziada nunca é removida

**O que acontece:** tanto "Fundir famílias" quanto "Desvincular peças" (oferecido quando a exclusão de família é bloqueada por unidade vendida) fazem 1 `POST`/checagem seguido de um **loop sequencial de `PATCH`** por ficha, sem transação — um erro no meio do loop deixa algumas fichas vinculadas e outras não, sem indicar quais falharam pra tentar de novo. Mais grave: "Desvincular peças" zera `familia_id` de cada ficha mas **nunca chama a exclusão da família depois** — o registro (agora com 0 fichas) fica órfão em `estoque_familias` pra sempre.

**Reprodução:** verificado por leitura de código.

**Causa-raiz:** [`src/features/estoque/EstoqueFundirFamiliasModal.tsx:253-268`](../src/features/estoque/EstoqueFundirFamiliasModal.tsx) (fundir, loop de `PATCH`); [`src/features/estoque/EstoqueFamiliaModal.tsx:434-445`](../src/features/estoque/EstoqueFamiliaModal.tsx) (`desvinuclarFamilia`, mesmo padrão, e sem excluir a família ao final).

**Impacto no dia a dia:** famílias-fantasma vazias se acumulam silenciosamente no banco a cada vez que alguém usa "excluir com unidade vendida → desvincular" — poluição de dados que só aparece se alguém consultar a tabela direto.

**Correção proposta:** endpoint de fusão/desvínculo atômico no backend (uma RPC ou uma transação Node real); em "desvincular", chamar `excluir` da família logo depois de zerar todos os vínculos.

---

#### F14 — Sem permissão dedicada pra ações de família

**O que acontece:** `estoqueFamilias.ts` e a rota de mover unidade reusam as mesmas 4 chaves genéricas de estoque (`estoque.ver/criar/editar/deletar`) — não existe `familia.*` no catálogo de permissões. Quem tem `estoque.editar` (editar peças) automaticamente pode renomear/fundir famílias e mover unidades; quem tem `estoque.deletar` pode excluir famílias inteiras.

**Reprodução:** verificado por leitura de código — `src/constants/permissoes.ts:66-78` só define as 4 chaves genéricas; `estoqueFamilias.ts:9-12` e `estoque.ts:821` (rota mover) reusam as mesmas.

**Causa-raiz:** ausência de granularidade nova pra uma feature nova — a permissão granular (`migration_047`) foi desenhada antes da feature de família existir e não foi estendida.

**Impacto no dia a dia:** um dono que queira dar acesso de "editar peças no dia a dia" pra um funcionário sem deixá-lo reorganizar/apagar famílias inteiras não consegue — é tudo ou nada.

**Correção proposta:** novas chaves (`estoque.familia_editar`, `estoque.familia_excluir`, `estoque.unidade_mover`) checadas nas rotas correspondentes, com fallback pras chaves genéricas por compatibilidade.

---

#### F15 — Handlers destrutivos sem tratamento de erro — botão trava pra sempre numa rede ruim

**O que acontece:** nenhum dos 5 handlers assíncronos do `EstoqueFamiliaModal` (excluir unidade, excluir em lote, excluir família, desvincular, mover em lote) nem o `handleAplicar` do Fundir tem `try/catch`. A camada HTTP (`src/utils/api.ts`, `fetchWithRetry`) **lança exceção de verdade** em timeout (15s), erro 5xx após 3 tentativas, sessão expirada ou JSON inválido — não é só `{success:false}`. Sem `catch`, a exceção vira uma promise rejeitada sem handler: nenhum toast aparece, e como não há `finally`, `salvando`/`aplicando` nunca volta a `false` — o botão fica desabilitado, preso, até fechar o modal.

**Reprodução:** verificado por leitura de código — `EstoqueFamiliaModal.tsx:380-476` (5 handlers, nenhum `try/catch`); `EstoqueFundirFamiliasModal.tsx:222-280` (mesma ausência, `setAplicando(false)` na linha 274 nunca roda se algo lançar antes). Contraste correto: `RegistrarUnidadeDialog.tsx` tem `try/catch/finally` completo (`:155-270`).

**Causa-raiz:** ausência de `try/catch/finally` nos handlers listados.

**Impacto no dia a dia:** é exatamente o cenário da persona "dono desmontando moto no galpão com celular" — conexão instável é a norma, não a exceção, ali. Uma chamada que falha nessas condições trava a tela sem explicação.

**Correção proposta:** replicar o padrão `try/catch/finally` que `RegistrarUnidadeDialog.tsx` já usa corretamente.

---

#### F16 — "Venda rápida" é mais frágil do que parece

**O que acontece:** o atalho "Venda rápida" não guarda um `familia_id` nem uma lista de `estoque_id`s — guarda o **nome** da família/peça como string em `sessionStorage`, e a tela de Vendas casa por substring no nome das fichas-filhas. Se a família for renomeada de um jeito que não seja mais prefixo dos nomes das fichas-filhas, a busca pré-preenchida não encontra nada, silenciosamente. Além disso, o atalho só preenche a busca — não abre a venda; o usuário ainda precisa clicar "Nova Venda" de novo.

**Reprodução:** verificado por leitura de código — `EstoqueFamiliaModal.tsx:447-454` (`sessionStorage.setItem('rk:venda-rapida-busca', termoBusca)`, `termoBusca` = nome), `App.tsx:567-572` (só troca de aba), `VendasView.tsx:310-315` (filtro por `.nome.includes(termo)`).

**Causa-raiz:** o atalho nunca foi conectado a `familia_id`/`estoque_id`, só a texto.

**Impacto no dia a dia:** funciona no caso feliz (nome da família = prefixo dos nomes das fichas), mas quebra silenciosamente assim que alguém corrige o nome da família (justamente a ação de organização que a feature deveria incentivar).

**Correção proposta:** guardar `familia_id` (ou lista de `estoque_id`s) em vez de string, e abrir a venda direto (não só navegar).

---

#### F17 — Orçamentos não reservam nada — o que foi cotado pode não ser o que é entregue

**O que acontece:** adicionar item a um orçamento só faz `insert` em `orcamento_itens` — não toca `estoque.quantidade` nem `estoque_unidades`. A mesma unidade pode estar cotada em N orçamentos abertos simultaneamente, sem aviso de conflito. E pior: vender a partir de um orçamento nunca informa `p_unidade_id` (só `POST /:id/itens/:itemId/vender` com `{forma_pagamento_id, componente, data}`) — então mesmo que o vendedor tenha mostrado ao cliente a ficha com nota 9/10, a venda pode consumir genericamente qualquer unidade disponível (inclusive uma pior).

**Reprodução (cenário concreto, por leitura de código):** cliente pede orçamento de um "Motor CG 150 Fan completo" — o vendedor mostra a unidade nota 9/10, a melhor disponível. Ela continua "Disponível" no modal de família (nada a reserva). Um segundo vendedor vende essa mesma unidade pra outro cliente via Vendas normal. Quando o primeiro orçamento é convertido em venda, `registrar_venda` decrementa genericamente e pode "vender" a unidade nota 5/10 que o primeiro cliente nunca viu — sem log de nada errado.

**Causa-raiz:** `src/server/routes/orcamentos.ts` inteiro — zero menção a `familia`/`estoque_unidades`/`reserva`; `montarParamsRegistrarVenda` (`:20-38`) nunca monta `p_unidade_id`.

**Impacto no dia a dia:** risco direto de vender ao cliente errado a unidade que ele não escolheu, sem nenhum sinal de alerta no sistema.

**Correção proposta:** ao adicionar item a um orçamento, permitir (não obrigar) escolher uma unidade específica e marcá-la como "reservada" (novo estado, distinto de vendida) até o orçamento expirar ou converter; mostrar esse estado no card de unidade do modal de família (a jornada do organizador já espera ver isso).

---

#### F18 — Importação de planilha sempre cria ficha órfã

**O que acontece:** `linhaParaEstoqueInput` nunca seta `familia_id`, e nenhuma das 3 etapas do importador (escolher arquivo → conferir prévia → importar) roda `detectarDuplicata` contra peças/famílias já existentes. Toda linha importada vira ficha avulsa, mesmo quando o nome bate ≥0,6 de Jaccard com uma família já existente.

**Reprodução (cenário concreto, por leitura de código):** família "Tanque de Combustível CG 125" já existe (fundida manualmente a partir de 3 fichas: Titan 99, Today, Fan). Uma planilha de 40 linhas de catalogação inclui "Tanque de Combustível CG 125 Bros 2005" — Jaccard contra as fichas-irmãs certamente ≥0,6 (mesmo prefixo de 4-5 tokens). Mesmo assim entra como ficha avulsa, `familia_id=null`, sempre.

**Causa-raiz:** `src/features/estoque/planilha.ts:213-233` (`linhaParaEstoqueInput`) e `ImportarPlanilhaModal.tsx:116` — zero chamada a `detectarDuplicata`.

**Impacto no dia a dia:** todo lote de catalogação em massa recria o mesmo problema de fragmentação que a fusão assistida resolve uma vez — trabalho de organização que se desfaz sozinho a cada importação.

**Correção proposta:** rodar `detectarDuplicata` na prévia da importação e marcar linhas suspeitas com sugestão de vínculo antes de confirmar.

---

#### F19 — Publicação ML/Shopee cega a família, mesmo com o dado já carregado

**O que acontece:** `item.familia`/`familia_id` já chegam populados no client (a GET usada pela tabela roda `anexarFamilias`), mas nenhum dos 3 componentes de publicação (`EstoquePublicarMlModal.tsx`, `EstoquePublicarShopeeModal.tsx`, `EstoqueAnunciosShopeeLista.tsx`) lê esses campos. Duas consequências concretas:
- **Mover unidade entre grupos não atualiza o vínculo do anúncio.** `mover_unidade_estoque` só ajusta `estoque_unidades`/`quantidade`; `estoque_anuncios_ml`/variações continuam apontando pra ficha de origem. A ficha destino não mostra que a unidade movida já tem anúncio ativo em outro grupo — risco de publicar um segundo anúncio quase-duplicado.
- **Renomear a família nunca atualiza o título do anúncio** (que nasce do nome da FICHA, não da família, e a sincronização periódica só toca `price`/`available_quantity`/`status`, nunca `title`) — o anúncio fica desatualizado até alguém editar manualmente no site do Mercado Livre.

**Reprodução:** verificado por leitura de código — `types.ts:277-283` (campo carregado), zero leitura em `EstoquePublicarMlModal.tsx`/`EstoquePublicarShopeeModal.tsx`; `mercadolivrePublicacao.ts:414` (`estoque_id` fixo no anúncio); `mercadolivreSync.ts:243-245` (sincronização não toca `title`); `migration_060_mover_unidade_estoque.sql:58-60` (não toca `estoque_anuncios_ml`).

**Causa-raiz:** não-objetivo explícito da spec original ("não propagar família pra ML/Shopee nesta entrega") — decisão consciente, mas sem nenhuma rede de segurança pros efeitos colaterais quando o usuário move/renomeia depois de já ter publicado.

**Impacto no dia a dia:** anúncio "pendurado" numa ficha errada depois de mover uma unidade; nome de anúncio desatualizado depois de organizar o catálogo — trabalho de organização (o objetivo da feature) tem efeito colateral silencioso em canais de venda externos.

**Correção proposta:** ao mover unidade, também repontar `estoque_anuncios_ml_variacoes.unidade_id`/ficha associada; ao renomear família, oferecer (não forçar) atualizar o título de anúncios das fichas-filhas.

---

#### F20 — Card de família no mobile não mostra Moto nem Valor

**O que acontece:** o card mobile específico pra linha de família (`EstoqueView.tsx:1235-1254`) só renderiza foto, nome, badge "N peças", categoria e "N em estoque" — sem Moto e sem Valor/faixa de preço. O card mobile genérico usado pra fichas avulsas (`renderMobileCard`, `:856-940`) mostra os dois. Contraria tanto a convenção já estabelecida no projeto (mobile e desktop pensados igualmente, sem "adaptar" depois) quanto a regra do `CLAUDE.md` ("valor numérico é o elemento mais forte do card") — no card de família mobile esse valor simplesmente não existe.

**Reprodução:** verificado por leitura de código (não cheguei a tirar o screenshot mobile comparativo ao vivo — ver seção 9).

**Causa-raiz:** [`src/features/estoque/EstoqueView.tsx:1235-1254`](../src/features/estoque/EstoqueView.tsx) (card mobile de família, sem Moto/Valor) vs `:856-940` (card mobile avulso, com os dois).

**Impacto no dia a dia:** dono olhando o catálogo pelo celular no galpão não vê o preço da peça mais nova (a família) sem abrir o modal — informação que ele precisa na hora de decidir/responder um cliente, e que ele já tem pra qualquer peça avulsa ao lado.

**Correção proposta:** levar Moto ("N modelos" ou nome único) e faixa de Valor pro card mobile de família, mesmo layout do card avulso.

---

#### F21 — Dois botões `accent` preenchidos podem coexistir na mesma tela

**O que acontece:** `<Button>` sem `variant` explícito já é `accent` preenchido por padrão (`variant: 'default'` = `bg-primary text-white`, e `--primary: var(--accent)`). No `EstoqueFamiliaModal`, o botão "Confirmar" do popover "Mover para a ficha" (modo seleção múltipla) e o botão "Registrar unidade" do rodapé (sempre visível, independente do modo) são os dois sem `variant` — ao entrar em modo seleção, marcar unidades e abrir "Mover", os dois ficam visíveis ao mesmo tempo. Ironicamente, o próprio código comenta `{/* Único botão accent */}` ao lado do botão do rodapé — o desenvolvedor não previu essa combinação quando escreveu o comentário.

**Reprodução:** verificado por leitura de código — [`src/features/estoque/EstoqueFamiliaModal.tsx:587`](../src/features/estoque/EstoqueFamiliaModal.tsx) (popover "Confirmar", sem `variant`) e `:673-674` (comentário + botão "Registrar unidade", sem `variant`), rodapé sempre montado.

**Causa-raiz:** regra do `CLAUDE.md` ("no máximo UM botão de acento preenchido por tela") não foi revalidada quando o modo de seleção múltipla foi adicionado por cima do rodapé fixo.

**Impacto no dia a dia:** puramente de hierarquia visual — em modo seleção, a tela perde o sinal de "qual é a ação principal aqui" que a regra existe pra garantir.

**Correção proposta:** dar `variant="outline"` (ou similar) ao "Confirmar" do popover de mover, já que nesse contexto ele não é a ação primária da tela.

---

#### F22 — Busca sem resultado, dentro do modal de família, fica em branco

**O que acontece:** a lista de grupos (`grupos`) não depende de `busca`/filtros — cada `GrupoModelo` filtra internamente e retorna `null` quando zera. Se a busca/filtro não bate com nada, `grupos.length` continua > 0, o `<Accordion>` é renderizado, e **todo grupo retorna `null`** — a área de conteúdo fica vazia, sem nenhuma mensagem "nenhum resultado encontrado".

**Reprodução:** verificado por leitura de código — [`src/features/estoque/EstoqueFamiliaModal.tsx:250`](../src/features/estoque/EstoqueFamiliaModal.tsx) (`return null` por grupo) vs `:356` (`grupos` não recalcula por busca) vs `:617` (`<Accordion>` sempre renderizado).

**Causa-raiz:** ausência de um estado "nenhum resultado" no nível do modal, só no nível de cada grupo individual.

**Impacto no dia a dia:** dono digita errado na busca ou filtra "vendida" sem ter nenhuma — vê um espaço vazio embaixo das abas e pode achar que o app travou (medo de "quebrar algo" mexendo mais).

**Correção proposta:** checar se todos os grupos renderizariam `null` e, nesse caso, mostrar um `EmptyState` com "nenhuma unidade encontrada com esse filtro" + botão "limpar filtros".

---

### P2 — incomoda

**F23 — Sem fusão entre duas famílias já existentes.** `EstoqueFundirFamiliasModal` só agrupa peças **avulsas** em famílias **novas** (`itensAvulsos={items.filter(i => !i.familia_id && i.ativo)}`, `EstoqueView.tsx:1874`); não existe fluxo pra escolher família A + família B e uni-las. Verificado por leitura de código. Impacto: se o organizador criar duas famílias parecidas por engano (ou uma migração assistida rodar duas vezes em momentos diferentes), não tem como consolidar depois sem desvincular manualmente e refundir do zero.

**F24 — Sem validação de nome duplicado ou nome gigante na família.** `estoque_familias.nome` é `text not null` sem `unique` (`migration_056_estoque_familias.sql:25`); nem a rota `POST`/`PATCH` (`estoqueFamilias.ts:41-53,55-69`) valida duplicidade ou tamanho — um nome de 5000 caracteres passa. Verificado por leitura de código. Impacto: nada impede duas famílias "Tanque CG 150" coexistindo, recriando a confusão que a feature existe pra resolver.

**F25 — "Marcar como vendida" no kebab é uma ação fantasma.** O item de menu com ícone de carrinho não faz nada além de mostrar um toast "Use o fluxo de Vendas..." (`EstoqueFamiliaModal.tsx:391-393`). Verificado por leitura de código. Viola a própria regra do `CLAUDE.md` ("todo alerta precisa ter ação associada, nunca só informar") em espírito — é um item de menu que parece acionável e não é.

**F26 — `EstoqueByMoto` fragmenta famílias multi-modelo sem indicar relação, e a contagem cai ao filtrar por moto.** Uma família cujas fichas-filhas cobrem N modelos aparece espalhada em N cards de moto distintos, sem rótulo de família (`EstoqueByMoto.tsx`, zero menção a `familia`). Pior: clicar num desses cards filtra a Lista por `modelo_moto_id` **antes** de agrupar por família (`EstoqueView.tsx:507-510` roda antes de `agruparLinhasTabela`), então a linha-família aparece ali com contagem menor que o total real. Verificado por leitura de código.

**F27 — Dashboard "Valor em estoque" diverge do somatório dos modais de família.** `DashboardView.tsx:299` calcula `item.valor * item.quantidade` direto, sem usar o helper compartilhado `valorTotalEstoque`/`valorEmEstoqueFamilia` que já resolve preço por unidade. Pré-existente à feature de família, mas agora mais visível: o header do modal de família mostra um "Valor total" correto por unidade; somar manualmente os totais de todas as famílias pode bater um número diferente do KPI do Dashboard. Verificado por leitura de código.

**F28 — Confirmação de exclusão em lote mais fraca que a de unidade única.** Excluir 1 unidade avisa "Esta ação não pode ser desfeita"; excluir N unidades selecionadas não tem esse aviso, apesar de ser potencialmente mais destrutivo (`EstoqueFamiliaModal.tsx:381` vs `:397`). Verificado por leitura de código.

**F29 — Alvo de toque abaixo do padrão do projeto nos 3 componentes novos.** Zero ocorrência de `h-11` (o tamanho "mobile" que `button.tsx:40` já define) em `EstoqueFamiliaModal.tsx`, `EstoqueFundirFamiliasModal.tsx`, `RegistrarUnidadeDialog.tsx` — tudo em `h-8` ou menor, incluindo a exclusão em lote (`h-7`, ao lado de "Mover"/"Cancelar" num `flex-wrap`, risco de toque acidental numa ação destrutiva). Verificado por leitura de código. Contraria a passada de alvos de toque já aplicada no resto do projeto (Tarefas/Frete/Estoque/Vendas/Orçamentos/Configurações).

**F30 — Erros de storage sempre engolidos.** Limpeza de imagem órfã é sempre fire-and-forget (`.catch(e => console.error(...))`) em vários pontos de `estoque.ts` (linhas 594, 624, 646, 793, 811) — resposta HTTP já foi enviada como sucesso independente do resultado da limpeza. Verificado por leitura de código. Risco baixo (só deixa imagem órfã no storage), citado por completude.

**F31 — `PATCH`/`DELETE` de família em id inexistente respondem errado.** `PATCH`/`PUT` `.single()` sem checar existência prévia cai no catch genérico e vira `500` em vez de `404`; `DELETE` de id inexistente responde `{success:true}` mesmo sem apagar nada (nenhum `SELECT` de existência antes do delete final). Verificado por leitura de código (`estoqueFamilias.ts:55-69,74-107`). Mascara bugs de integração (um `familia_id` errado no client passa despercebido).

### P3 — polimento

**F32 — Contadores animados (`RollingText`) duplicam texto no DOM.** Observado ao vivo em vários badges ("1 ficha", "N compra(s)") — o texto real aparece 2x concatenado na árvore de acessibilidade (uma vez animado caractere-a-caractere, outra vez limpo). Não é específico da feature de família (mesmo padrão no Dashboard) — citado porque afeta a leitura por tecnologia assistiva nos novos badges também. Baixa prioridade, padrão pré-existente do app.

**F33 — `PUT` e `PATCH` de família são literalmente o mesmo handler**, sem diferença semântica entre "substituir tudo" e "atualizar parcialmente" (`estoqueFamilias.ts:71-72`). Sem efeito prático hoje (o payload já só inclui campos presentes), citado por completude de API design.

**F34 — Parser de ano quebra silenciosamente com formato de 2 dígitos.** `extrairAnoOrdenavel` (`src/features/motos/motoTree.ts:41-44`) usa `ano?.match(/\d+/)` — pra um modelo cadastrado como `"99"` (em vez de `"1999"`), o grupo ordena como se fosse o ano 99, ficando antes de qualquer grupo de 4 dígitos, invertendo a cronologia real. Verificado por leitura de código, sem teste dedicado (`motoTree.test.ts` não existe). Baixa probabilidade (depende de alguém cadastrar ano com 2 dígitos), mas sem nenhuma validação que impeça.

---

## 4. Matriz de exploração (ação × estado)

Cruzamento de cada ação da feature contra os estados pedidos no escopo da auditoria. `código` = verificado por leitura de código · `ao vivo` = verificado em execução contra produção real · `n/a` = estado não se aplica a essa ação · `—` = não testado nesta sessão (motivo, quando relevante, na seção 9).

| Ação | 0 unid. | 1 unid. | 50+ unid. | Unidade vendida | Avariada | Reservada orçamento | Anunciada ML/Shopee | Nome dup./variante grafia | Nome vazio/gigante | Concorrência | Falha de rede no meio | Cancelar (ESC/fora) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Criar família (Fundir, a partir de avulsas) | n/a | OK ao vivo (fluxo aberto e inspecionado) | — | n/a nesta etapa | n/a | n/a | n/a | Jaccard confirmado código (F09) | não validado, código (F24) | não testado | sem try/catch, código (F15) | fecha sem side-effect, código |
| Vincular ficha à família (Fundir) | n/a | OK ao vivo | — | quebra bloqueio de exclusão depois, código | n/a | n/a | não propaga ML/Shopee, código (F19) | n/a | n/a | não-atômico, código (F13) | sem try/catch, código (F15) | código, sem side-effect |
| Desvincular (dentro de Excluir bloqueado) | n/a | n/a | — | é o gatilho da ação, código | n/a | n/a | n/a | n/a | n/a | não-atômico, código (F13) | sem try/catch, código (F15) | n/a |
| Editar família (nome/categoria/foto) | — | — | — | — | n/a | n/a | não sincroniza título ML, código (F19) | sem validação, código (F24) | sem limite, código (F24) | — | — | **não existe UI**, código (L1) |
| Excluir família | OK ao vivo (bloco vazio existe) | **sem confirmação**, código (F05) | — | bloqueia certo, código+ao vivo (mensagem 409 lida) | n/a | n/a | anúncio órfão, código (F19) | n/a | n/a | — | sem try/catch, código (F15) | **zero confirmação pra cancelar** (F05) |
| Criar/registrar unidade (dialog novo) | n/a | OK ao vivo (2 unidades reais inspecionadas) | — | n/a (sempre cria disponível) | OK, campo existe, código | n/a | n/a | n/a | n/a | não testado | try/catch OK, código | fecha limpo, código |
| Registrar unidade (tela antiga, `UnidadesEstoque`) | n/a | **sempre 400**, código+evidência ao vivo (F04) | — | n/a | n/a | n/a | n/a | n/a | n/a | n/a | sem catch de erro no upload, código | código |
| Editar unidade | OK (herda da mãe), código | OK ao vivo | — | não testado (destrutivo) | OK, código | n/a | n/a | n/a | n/a | — | preço opcional em edição, código | código |
| Excluir unidade (única) | n/a | **não checa vendida_em**, código (F03) | — | **quebra invariante**, código (F03) | n/a | n/a | n/a | n/a | n/a | — | sem try/catch, código (F15) | confirm() nativo, código |
| Excluir unidades (lote) | n/a | mesmo bug de F03, código | — | mesmo bug de F03 | n/a | n/a | n/a | n/a | n/a | — | sem try/catch, código (F15) | confirmação mais fraca, código (F28) |
| Mover unidade entre modelo/ano | n/a | RPC correta em série, código | — | bloqueado certo na RPC, código | n/a | n/a | **não repontua anúncio**, código (F19) | n/a | n/a | **corrida de dados**, código (F06) | rota 503 se migration não rodou, código `[incerto]` | não testado (destrutivo) |
| Fundir famílias (grupo sugerido) | botão desabilita por `aplicando`, não por seleção, código | n/a (mín. 2 exigido) | — | não testado (destrutivo) | n/a | n/a | n/a | é o objetivo da ação, código+ao vivo | n/a | não-atômico, código (F13) | trava spinner pra sempre, código (F15) | `useConfirm` real, código (correto) |
| Filtrar (modelo/status/avaria) | resultado vazio some sem aviso, código (F22) | OK ao vivo | — | filtro "vendida" existe, código | filtro "avaria" existe, código | n/a (não existe o estado) | n/a | n/a | n/a | n/a | n/a | n/a |
| Buscar (texto) | tela em branco sem aviso, código (F22) | OK ao vivo | — | n/a | n/a | n/a | n/a | casa por substring, código (F16/F17: mesmo bug em Vendas) | n/a | n/a | n/a | limpa ao fechar, código |
| Expandir drawer/grupo (Accordion) | OK, código | OK ao vivo | não testado (sem família com 50+ pra checar) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | fecha sem side-effect, código |
| Publicar no Mercado Livre | n/a | OK (fora do escopo desta feature) | — | n/a | n/a | n/a | **não sabe que é família**, código (F19) | n/a | n/a | não testado | tratamento de erro pré-existente, não específico da feature | não testado |
| Publicar no Shopee | n/a | idem ML | — | n/a | n/a | n/a | idem ML (F19) | n/a | n/a | não testado | idem | não testado |
| Vender (Venda rápida a partir da família) | n/a | quantidade decrementa, unidade não marca (F02) | — | **é o próprio F02** | n/a | **nunca reserva antes**, código (F17) | n/a | quebra se família renomeada, código (F16) | n/a | não testado | não testado | 2 cliques em vez de 1, código (F16) |
| Cancelar venda | n/a | restaura certo em série, código | — | é o objetivo da ação, código | n/a | n/a | n/a | n/a | n/a | **corrida de dados**, código (F07) | não testado | `disabled` evita duplo-clique na mesma aba, código |

**Sobre mobile 375px vs desktop 1440px:** testado ao vivo até a troca de viewport; a comparação lado a lado família-modal vs tabela não foi concluída ao vivo (pane do navegador ficou oculta no meio da sessão — ver seção 9). O achado de paridade quebrada (F20, card de família sem Moto/Valor no mobile) vem de leitura de código, não da captura visual planejada.

---

## 5. Lacunas de feature

| # | Lacuna | Evidência | Por que importa |
|---|---|---|---|
| L1 | Editar nome/categoria/descrição/foto da família | API pronta e funcional (`estoqueFamiliasApi.atualizar`, `PATCH /api/estoque-familias/:id`), **zero botão em qualquer um dos 3 componentes novos** que a chame | É o piso citado no próprio pedido desta auditoria — confirmado real, não hipotético |
| L2 | Fundir duas famílias já existentes entre si | Ver F23 | Sem isso, um erro de organização anterior não se corrige, só se reconstrói do zero |
| L3 | Reserva de estoque por orçamento | Ver F17 | Risco direto de vender ao cliente errado a unidade que ele escolheu |
| L4 | Estado "reservado em orçamento" no card de unidade | Não existe coluna/flag que uma linha de orçamento aberta escreva — a jornada do organizador (enunciado desta auditoria) espera ver esse estado e ele não tem onde nascer | Consequência direta de L3 |
| L5 | Vínculo família ↔ anúncio (nome, contagem cross-ficha) | Ver F19 | Organização interna com efeito colateral silencioso em canais de venda externos |
| L6 | Matching de família na importação de planilha | Ver F18 | Todo lote de catalogação recria a fragmentação que a feature resolve |
| L7 | Permissão dedicada pra ações de família | Ver F14 | Hoje é tudo-ou-nada entre "editar peça" e "reorganizar/apagar famílias" |
| L8 | Confirmação estilizada (`useConfirm`) em vez de `confirm()` nativo nos handlers do `EstoqueFamiliaModal` | Fundir já usa o padrão certo; os outros 2 arquivos usam `confirm()` do browser, fora do design system | Consistência visual e de tom de voz — `confirm()` nativo quebra a experiência cuidada do resto do app |
| L9 | "Venda rápida" que realmente abre a venda com 1 clique, por `familia_id` | Ver F16 | O atalho promete 1 clique e entrega 2, e quebra silenciosamente ao renomear |
| L10 | Aba "Relacionadas" do modal — placeholder "em breve" sem escopo definido | `EstoqueFamiliaModal.tsx:546,640-642`, `disabled` | Não é um bug, mas é uma promessa visível na UI sem prazo nem escopo — vale decidir "vai ou não vai existir" |

---

## 6. Top melhorias de alto valor

Cada uma resolve uma dor concreta já documentada nos achados acima.

1. **Sincronização atômica de quantidade.** Dor: F01 (edição de quantidade pode corromper sem reverter). Solução: mover o `UPDATE estoque SET quantidade` pra dentro da própria função `sincronizar_unidades_estoque`, chamada como RPC única. Arquivos: `supabase/migration_0XX_*.sql` (nova), `src/server/routes/estoque.ts:582-588,1127-1152`. Esforço: **M**. Impacto: **Alto**.
2. **Venda genérica sincroniza unidades.** Dor: F02 (venda sem escolher unidade nunca marca `vendida_em`). Solução: dentro de `registrar_venda`, quando `p_unidade_id` é nulo, marcar automaticamente as N unidades em branco mais antigas como vendidas. Arquivos: `supabase/migration_0XX_*.sql`. Esforço: **M**. Impacto: **Alto**.
3. **Aposentar `UnidadesEstoque.tsx` como ponto de entrada.** Dor: F04, F11 (tela antiga permanentemente quebrada e ainda alcançável). Solução: busca/`DetailModal` abrem sempre `EstoqueFamiliaModal`. Arquivos: `App.tsx`, `EstoqueBuscaSugestoes.tsx`, `EstoqueView.tsx:1094`. Esforço: **P-M**. Impacto: **Alto**.
4. **Confirmação estilizada antes de excluir família.** Dor: F05. Solução: `useConfirm()` com resumo do que será perdido, replicando o padrão já usado no Fundir. Arquivos: `EstoqueFamiliaModal.tsx:415-432`. Esforço: **P**. Impacto: **Alto**.
5. **Corrigir badges "Melhor estado"/"Melhor preço".** Dor: F08 (confirmado ao vivo com dado real). Solução: usar a ficha-mãe real de cada unidade em vez de um valor fixo do grupo. Arquivos: `EstoqueFamiliaModal.tsx:56-71,253-257`. Esforço: **P**. Impacto: **Médio-alto** (confiança na informação exibida ao cliente).
6. **Editar família.** Dor: L1 — a lacuna mais óbvia, API já pronta. Solução: botão "Editar peça" no rodapé abrindo um form de nome/categoria/descrição/foto, reaproveitando `estoqueFamiliasApi.atualizar`. Arquivos: `EstoqueFamiliaModal.tsx`. Esforço: **P**. Impacto: **Alto**.
7. **Alerta de duplicata na criação/importação.** Dor: F09, F18 (duplicata 100% idêntica encontrada ao vivo; toda importação recria fragmentação). Solução: rodar `detectarDuplicata` contra peças/famílias existentes antes de salvar peça nova (manual e planilha), sugerindo vínculo em vez de criar órfã. Arquivos: `src/server/routes/estoque.ts` (POST), `ImportarPlanilhaModal.tsx`, `planilha.ts`. Esforço: **M**. Impacto: **Alto**.
8. **Distinguir "R$ 0 deliberado" de "nunca precificado".** Dor: F10 (confirmado ao vivo). Solução: tratar `valor === 0` como "sem preço" na agregação de família (mesmo tratamento que fichas avulsas já têm), ou campo `valor_definido`. Arquivos: `familiaEstoque.ts`, `EstoqueView.tsx`. Esforço: **P**. Impacto: **Médio**.
9. **`try/catch/finally` nos handlers destrutivos.** Dor: F15 (botão trava pra sempre com rede ruim — cenário real da persona do galpão). Solução: replicar o padrão já correto de `RegistrarUnidadeDialog.tsx`. Arquivos: `EstoqueFamiliaModal.tsx` (5 handlers), `EstoqueFundirFamiliasModal.tsx` (`handleAplicar`). Esforço: **P**. Impacto: **Alto**.
10. **Reserva de estoque por orçamento.** Dor: F17 (risco de vender ao cliente errado a unidade). Solução: estado "reservado" opcional por unidade ao adicionar item a um orçamento, expirando com o orçamento. Arquivos: `src/server/routes/orcamentos.ts`, schema novo, `EstoqueFamiliaModal.tsx` (exibir estado). Esforço: **G**. Impacto: **Alto**.
11. **Levar família pro mínimo necessário em Vendas e ML/Shopee.** Dor: F16, F19 (venda rápida frágil; anúncio "pendurado" após mover/renomear). Solução: badge "faz parte de X" na busca de Vendas; repontar `estoque_anuncios_ml_variacoes` ao mover unidade; oferecer atualizar título do anúncio ao renomear família. Arquivos: `VendasView.tsx`, `mover_unidade_estoque` (SQL), `mercadolivrePublicacao.ts`. Esforço: **G**. Impacto: **Alto**.
12. **Lock explícito nas duas funções com corrida de dados.** Dor: F06, F07. Solução: `for update` na leitura inicial de `mover_unidade_estoque` e `cancelar_venda`. Arquivos: `supabase/migration_0XX_*.sql`. Esforço: **P**. Impacto: **Médio** (baixa probabilidade, alta severidade quando ocorre).

---

## 7. Backlog priorizado

| ID | Severidade | Título | Esforço | Impacto | Arquivos principais | Fase |
|---|---|---|---|---|---|---|
| F01 | P0 | Sincronização de quantidade não-atômica | M | Alto | `estoque.ts:582-588,1127-1152`, `migration_057` | 1 |
| F02 | P0 | Venda genérica não sincroniza unidades | M | Alto | `migration_059:109-123`, `VendasView.tsx:379` | 1 |
| F03 | P0 | Delete de unidade/ficha não protege venda histórica | P-M | Alto | `estoque.ts:617-632,803-819` | 1 |
| F04 | P0 | "Registrar unidade" antigo permanentemente quebrado | P-M | Alto | `UnidadesEstoque.tsx:104`, `estoque.ts:732-764` | 1 |
| F05 | P0 | Excluir família sem confirmação | P | Alto | `EstoqueFamiliaModal.tsx:415-432` | 1 |
| F08 | P1 | Badges "melhor estado/preço" errados | P | Médio-alto | `EstoqueFamiliaModal.tsx:56-71` | 2 |
| F09 | P1 | Sem alerta de duplicata na criação | M | Alto | `estoque.ts` (POST), `detectarDuplicata.ts` | 2 |
| F10 | P1 | R$0 indistinguível de "sem preço" | P | Médio | `familiaEstoque.ts`, `EstoqueView.tsx` | 2 |
| F15 | P1 | Handlers sem try/catch/finally | P | Alto | `EstoqueFamiliaModal.tsx`, `EstoqueFundirFamiliasModal.tsx` | 2 |
| F22 | P1 | Busca sem resultado fica em branco | P | Médio | `EstoqueFamiliaModal.tsx:250,356,617` | 2 |
| F06 | P1 | Corrida de dados em mover unidade | P | Médio | `migration_060` | 3 |
| F07 | P1 | Corrida de dados em cancelar venda | P | Médio | `migration_038:185` | 3 |
| F11 | P1 | Duas UIs divergentes de unidade | P-M | Alto | `UnidadesEstoque.tsx`, `App.tsx`, `EstoqueBuscaSugestoes.tsx` | 3 |
| F12 | P1 | Chevron vs clique-na-linha confusos | P-M | Médio | `EstoqueView.tsx:585-593,1177` | 3 |
| F13 | P1 | Fundir/desvincular não-atômicos, família órfã | M | Médio | `EstoqueFundirFamiliasModal.tsx`, `EstoqueFamiliaModal.tsx:434-445` | 3 |
| L1 | P1 (lacuna) | Editar nome/categoria/foto da família | P | Alto | `EstoqueFamiliaModal.tsx` | 2 |
| F14 | P1 | Sem permissão dedicada de família | M | Médio | `permissoes.ts`, `estoqueFamilias.ts` | 4 |
| F16 | P1 | Venda rápida frágil | P-M | Médio | `EstoqueFamiliaModal.tsx:447-454`, `VendasView.tsx` | 4 |
| F17 | P1 | Orçamentos sem reserva | G | Alto | `orcamentos.ts`, schema novo | 4 |
| F18 | P1 | Planilha sempre cria órfã | M | Alto | `planilha.ts`, `ImportarPlanilhaModal.tsx` | 4 |
| F19 | P1 | ML/Shopee cegos a família | G | Alto | `mover_unidade_estoque`, `mercadolivrePublicacao.ts` | 4 |
| F20 | P1 | Mobile: card de família sem Moto/Valor | P | Médio | `EstoqueView.tsx:1235-1254` | 3 |
| F21 | P1 | 2 botões accent coexistindo | P | Baixo-médio | `EstoqueFamiliaModal.tsx:587,673` | 3 |
| F23–F31 | P2 | (ver seção 3) | P-M cada | Baixo-médio | vários | 5 |
| F32–F34 | P3 | (ver seção 3) | P cada | Baixo | vários | 5 |

**Fases sugeridas:** Fase 1 = parar o sangramento de integridade e a exclusão sem confirmação (todos P0). Fase 2 = confiança no dado exibido + lacuna mais óbvia (editar família) + robustez de erro. Fase 3 = concorrência e duplicação de UI. Fase 4 = organização e alcance pra Vendas/ML/Orçamentos/Planilha (mudanças maiores). Fase 5 = polimento.

---

## 8. Mapa da feature

```
BANCO (supabase/migration_*.sql)
├─ estoque_familias (migration_056)         nome, categoria_id, descricao, imagem_url
├─ estoque.familia_id → estoque_familias    FK opcional, on delete SET NULL (migration_056:41)
├─ estoque_unidades.estoque_id → estoque    FK obrigatória, on delete CASCADE (migration_014:39)
├─ sincronizar_unidades_estoque()           migration_057:51 — única definição
├─ mover_unidade_estoque()                  migration_060:5 — única definição
├─ registrar_venda()                        vigente: migration_059:29 (12 params, overloads antigos dropados em 051)
├─ cancelar_venda()                         vigente: migration_038:185 (nunca redefinida depois)
└─ migration_047_permissoes_granulares.sql  chaves: estoque.ver/criar/editar/deletar/anunciar_ml/anunciar_shopee
                                              (sem chave dedicada a família — ver F14)

ROTAS (src/server/routes/)
├─ estoqueFamilias.ts     CRUD de família (GET/POST/PUT/PATCH/DELETE /api/estoque-familias)
│                         bloqueio de exclusão por unidade vendida: linhas 78-97 (correto)
│                         SEM endpoint de fusão real (não existe "merge")
└─ estoque.ts (1155 linhas) — pontos que tocam família/unidades:
    ├─ POST /                       cria peça, chama sincronizarUnidades (:540) — seguro (v_atual sempre 0)
    ├─ PUT|PATCH /:id                atualizarItem — INSEGURO, ver F01 (:582-588)
    ├─ DELETE /:id                   delete ficha inteira — sem checar vendida_em, ver F03 (:617-632)
    ├─ POST /bulk-update-quantidade  mesmo padrão inseguro de F01, em loop (:1127-1152)
    ├─ POST /:id/unidades            "registrar unidade" ANTIGO — permanentemente 400, ver F04 (:732-764)
    ├─ PATCH /:id/unidades/:uid      usado pelo RegistrarUnidadeDialog NOVO (caminho correto)
    ├─ DELETE /:id/unidades/:uid     sem checar vendida_em, não ajusta quantidade, ver F03 (:803-819)
    └─ POST /:id/unidades/:uid/mover chama RPC mover_unidade_estoque (:821-845) — atômico, mas ver F06

DOMÍNIO (src/features/estoque/)
├─ familiaEstoque.ts       módulo puro de agregação: agruparPorModelo, faixaPrecoFamilia,
│                          emEstoqueFamilia, variacoesFamilia, comAvariaFamilia, agruparLinhasTabela,
│                          filtrarLinhaTexto — bem testado a nível de função pura
├─ valorEstoque.ts         herança de valor/condição unidade↔ficha-mãe (valorDaUnidade, condicaoNotaDaUnidade)
├─ detectarDuplicata.ts    Jaccard sobre tokens do nome, corte 0.6 — só usado dentro do Fundir (ver F09/F18)
├─ api.ts                  fino, sem validação de shape em runtime
└─ types.ts                Estoque, EstoqueUnidade, EstoqueFamilia

UI (src/features/estoque/)
├─ EstoqueView.tsx (1882L)         tabela — agrupamento por família CONFIRMADO correto (:542-547,1168-1275)
├─ EstoqueFamiliaModal.tsx (702L)  modal principal — melhor estado/preço ERRADO (F08), sem editar família (L1),
│                                  excluir sem confirmar (F05), busca vazia em branco (F22), handlers sem
│                                  try/catch (F15), 2 accent possíveis (F21)
├─ EstoqueFundirFamiliasModal.tsx  sugestão via detectarDuplicata + confirmação real (useConfirm) — só cria
│                                  família NOVA a partir de avulsas (F23), loop não-atômico (F13)
├─ RegistrarUnidadeDialog.tsx      NOVO, correto — try/catch/finally completo, valida foto+preço obrigatórios,
│                                  usa PATCH (contorna F04 corretamente)
├─ UnidadesEstoque.tsx             ANTIGO, paralelo — ainda alcançável via busca (F11), "adicionar" quebrado (F04)
├─ EstoqueItemExpandido.tsx        detalhe antigo por chevron, sobreposto ao modal novo (F12)
├─ EstoqueByMoto.tsx               sem noção de família, fragmenta em N cards (F26)
├─ EstoqueFiltrosPopover.tsx / EstoqueBuscaSugestoes.tsx  sem lógica de família própria (correto, fora de escopo)

CONSUMIDORES A JUSANTE (não tocados por esta feature — ver F16-F19, F27)
├─ VendasView.tsx              zero noção de família na busca; venda rápida frágil (F16)
├─ orcamentos.ts                zero reserva (F17)
├─ planilha.ts / ImportarPlanilhaModal.tsx   zero matching de família (F18)
├─ EstoquePublicarMlModal.tsx / EstoquePublicarShopeeModal.tsx / EstoqueAnunciosShopeeLista.tsx
│                               zero leitura de familia_id apesar do dado já vir carregado (F19)
├─ DashboardView.tsx            valor total por cálculo próprio, diverge do helper compartilhado (F27)
└─ VisaoDono.tsx                agrupamento por categoria (grosso), imune à fragmentação por família
```

---

## 9. O que não consegui verificar

- **Qualquer ação destrutiva/mutante ao vivo** (excluir unidade, excluir família, vender, cancelar venda, fundir, mover, registrar unidade) — deliberadamente não executei nenhuma, porque o ambiente de desenvolvimento aponta pro Supabase de **produção** (confirmei isso antes de começar: não há banco local nem `docker-compose`). Toda validação dessas rotas é por leitura de código, com números concretos construídos à mão a partir da lógica real.
- **Concorrência real** (duas abas, dois dispositivos) nos achados F06/F07 — não testável sem duas sessões paralelas de verdade; avaliado só por leitura de código.
- **Falha de rede no meio de uma ação** (achado F15) — não simulei interceptação de rede ao vivo; avaliado por leitura de código (ausência confirmada de `try/catch`) e pela documentação do próprio `src/utils/api.ts` sobre o que `fetchWithRetry` lança.
- **Persona "usuário com permissão restrita"** — não testei ao vivo (exigiria logar como outro usuário/role); avaliado só pela leitura de `migration_047_permissoes_granulares.sql` e das checagens de permissão nas rotas.
- **Telas "Por moto" e "Fundir famílias" ao vivo** — cheguei a confirmar que o botão "Fundir" existe e abre (visto na primeira exploração), mas não cheguei a abrir o conteúdo da tela nem testar "Por moto" clique a clique — o Browser pane ficou oculto/minimizado no meio da sessão (o app do usuário perdeu foco) e as tentativas seguintes de screenshot/clique expiraram. Achados relacionados (F23, F26) vêm de leitura de código pelos subagentes.
- **Comparação visual mobile 375px vs desktop lado a lado** — comecei (troquei o viewport, tentei renavegar), mas esbarrei no mesmo problema de pane oculto antes de capturar a comparação. O achado F20 (card de família sem Moto/Valor no mobile) vem de leitura de código, não de screenshot.
- **Se a migration_060 (`mover_unidade_estoque`) já foi de fato rodada em produção** — o arquivo aparece como não versionado (`??`) no `git status`, o que não prova nem desmente execução manual no Supabase. `[incerto]`. Diferente de migrations 056/057, que **confirmei ao vivo estarem aplicadas** (família e unidades funcionando com dado real em produção).
- **Teste do backfill da migration_057 sobre dump/staging** — fora do escopo autorizado desta auditoria (não rodo migrations). Tenho evidência indireta forte de que o backfill **já rodou** em produção: toda ficha inspecionada ao vivo já tinha exatamente `quantidade` unidades cadastradas.
- **Impacto real do achado F04 em uso** — confirmei que o caminho está quebrado por leitura de código e pela evidência do backfill já aplicado, mas não cliquei "adicionar unidade" de verdade em `UnidadesEstoque.tsx` (seria uma tentativa de escrita, ainda que fadada a falhar com 400 — evitei mesmo assim por prudência).
- **Comportamento exato da animação `RollingText` sob leitor de tela real** (achado F32) — observei a duplicação de texto na árvore de acessibilidade via DOM, não testei com um leitor de tela de verdade.

---

## Nota lateral (memória do projeto)

A memória registrada em `rk-sucatas-estoque-familias-fundacao-migrations-pending.md` dizia, em 03/09, que as migrations 056/057 estavam pendentes em produção. **Isso está desatualizado** — confirmei ao vivo, em 05/09, que ambas já estão aplicadas e a feature já processa dado real (214 itens, famílias agrupando corretamente). Atualizei a memória correspondente ao final desta sessão.
