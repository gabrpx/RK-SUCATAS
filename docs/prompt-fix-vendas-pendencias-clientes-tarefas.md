# Prompt para Claude Code — Fixes e melhorias (Vendas, Tarefas, Clientes, Pendências, Dashboard)

> Investigação feita ANTES de escrever este prompt: li o código real de cada
> área (migrations do Supabase, rotas do server, componentes do front) e
> ancorei cada fase em arquivo + linha real. Nenhum item abaixo é suposição.

```
Think carefully and step-by-step before starting. This is a multi-phase task touching database migrations, server routes, and frontend components.
```

## Objective

Corrigir o erro que impede registrar venda na aba Vendas (causa raiz confirmada: funções `registrar_venda` duplicadas/ambíguas no Postgres) e implementar 8 melhorias adicionais em Tarefas, Clientes, Pendências (Caixa) e Dashboard — todas já investigadas com arquivo+linha reais, sem necessidade de descoberta adicional.

## Context — stack e convenções

- Backend: Express + Supabase (Postgres). Migrations em `supabase/migration_XXX_*.sql`, aplicadas manualmente no editor SQL do Supabase (não há migration runner automático) — a última é `migration_050_clientes_banido.sql`, então as novas começam em `migration_051`.
- Rotas em `src/server/routes/*.ts`, montadas em `server.ts`.
- Frontend em `src/features/<area>/*.tsx`, dados globais vêm de `src/context/DataContext.tsx` (polling a cada 10s + cache em localStorage).
- Componentes animados já integrados no projeto (usar SEMPRE estes em vez de HTML cru — é pedido explícito do usuário "100% componentes prontos animados"):
  - `src/components/ui/StatusBadge.tsx` — badges de status/tom (já usado em Tarefas, Vendas, Pendências).
  - `src/components/animate-ui/components/animate/tabs.tsx` — tabs animadas (já usado em `PendenciasUnificadasTab.tsx`, `CaixaView.tsx`).
  - `src/components/ui/checkbox.tsx` (Animate UI, sobre Radix) — checkbox com animação de toggle.
  - `src/components/ui/MetricCard.tsx` / `src/components/ui/animated-number.tsx` — cards de métrica com número animado (Dashboard, Pendências).
  - `src/components/ui/Modal.tsx` / `src/components/ui/dialog.tsx` (Radix) — qualquer modal novo.
  - `src/components/ui/popover.tsx` — qualquer popover novo.
  - `src/features/clientes/SeletorCliente.tsx` — já existe, é o componente padrão pra "vincular cliente" em qualquer formulário (Vendas e Tarefas já usam) — reaproveitar em vez de criar um novo seletor.
  - `motion/react` (framer-motion) — já é dependência (ver `TarefaCards.tsx`), usar `motion.div`/`AnimatePresence` pra qualquer transição nova (ex: badge de tempo relativo aparecendo, reordenação da lista de tarefas).
- Nenhuma fase abaixo precisa de biblioteca nova — todas usam o que já está instalado.

---

## FASE 0 (CRÍTICA — bloqueia vendas) — corrigir ambiguidade em `registrar_venda`

### O que a imagem mostra

Ao confirmar uma venda na aba Vendas (modal "Nova Venda": quantidade 1, R$200, PIX, cliente Felipe Silva), o Supabase devolve:

```
Could not choose the best candidate function between:
public.registrar_venda(p_estoque_id => uuid, p_quantidade => integer, p_valor_unitario => numeric, p_forma_pagamento_id => uuid, p_modelo_moto_id => uuid, p_cliente_nome => text, p_observacoes => text, p_data => date, p_componente => text, p_cliente_id => uuid, p_unidade_id => uuid),
public.registrar_venda(p_estoque_id => uuid, p_quantidade => integer, p_valor_unitario => numeric, p_forma_pagamento_id => uuid, p_modelo_moto_id => uuid, p_cliente_nome => text, p_observacoes => text, p_data => date, p_componente => text, p_cliente_id => uuid, p_unidade_id => uuid, p_nome_item => text)
```

A venda nunca é registrada — o erro aparece pra qualquer venda pela aba Vendas, não só item avulso.

### Causa raiz confirmada (lendo as migrations)

A função `registrar_venda` foi recriada 4 vezes crescendo de assinatura, e NENHUMA migration derrubou a assinatura anterior antes de recriar:

- `migration_009_fix_registrar_venda_idx.sql`: 9 parâmetros (até `p_componente`).
- `migration_029_registrar_venda_cliente_id.sql`: 10 parâmetros (+ `p_cliente_id`).
- `migration_038_vendas_unidade.sql`: 11 parâmetros (+ `p_unidade_id`).
- `migration_048_registrar_venda_item_avulso.sql`: 12 parâmetros (+ `p_nome_item`).

Cada uma usou `create or replace function registrar_venda(...)` com uma assinatura DIFERENTE da anterior (mais um parâmetro) — no Postgres isso não substitui a função antiga, cria um **overload novo**. Hoje o banco tem 4 versões de `registrar_venda` coexistindo.

`src/server/routes/vendas.ts` (linhas 47-61) chama a RPC com 11 parâmetros nomeados, sem `p_nome_item`:

```ts
const { data: venda, error } = await supabase.rpc('registrar_venda', {
  p_estoque_id: estoque_id,
  p_quantidade: Number(quantidade),
  p_valor_unitario: Number(valor_unitario),
  p_forma_pagamento_id: forma_pagamento_id,
  p_modelo_moto_id: modelo_moto_id || null,
  p_cliente_nome: cliente_nome || null,
  p_observacoes: observacoes || null,
  p_data: data || null,
  p_componente: componente || null,
  p_cliente_id: cliente_id || null,
  p_unidade_id: unidade_id || null,
});
```

Essa chamada bate EXATAMENTE com a assinatura de 11 parâmetros (`migration_038`) e também bate com a de 12 parâmetros (`migration_048`, já que `p_nome_item` tem `default null` e pode ficar de fora) — Postgres não sabe qual das duas escolher e recusa a chamada. As versões de 9 e 10 parâmetros não entram na disputa porque não têm `p_cliente_id`/`p_unidade_id` (por isso o erro lista só 2 candidatas, não 4).

**Confirmei que existe um TERCEIRO ponto afetado pelo mesmo bug**, ainda não reportado pelo usuário mas com a mesma causa raiz: `src/services/mercadolivreSync.ts` (linhas 409-420, função `importarPedidoComoVenda`, usada ao importar um pedido do Mercado Livre como venda) chama a mesma RPC sem `p_componente` nem `p_nome_item` — também ambíguo entre as versões de 11 e 12 parâmetros. Corrigir junto, na mesma fase, evita que a importação de pedido do ML quebre com o mesmo erro assim que alguém tentar importar um pedido.

`src/server/routes/orcamentos.ts` (`montarParamsRegistrarVenda`, linhas 20-38) JÁ passa `p_nome_item` explicitamente — é por isso que vender item de orçamento ("Vender tudo") não quebra, só a aba Vendas e a importação do ML.

### O que fazer

1. **Nova migration `supabase/migration_051_fix_registrar_venda_overloads.sql`**: derrubar as 3 assinaturas antigas de `registrar_venda`, mantendo só a de 12 parâmetros (`migration_048`, que já está correta e não precisa ser recriada):
   ```sql
   drop function if exists registrar_venda(uuid, int, numeric, uuid, uuid, text, text, date, text);
   drop function if exists registrar_venda(uuid, int, numeric, uuid, uuid, text, text, date, text, uuid);
   drop function if exists registrar_venda(uuid, int, numeric, uuid, uuid, text, text, date, text, uuid, uuid);
   NOTIFY pgrst, 'reload schema';
   ```
   Confirme os tipos exatos de cada parâmetro lendo as migrations 009/029/038 antes de escrever os `drop function` (a assinatura no DROP precisa bater exatamente com a função registrada — copie os tipos, não só a contagem). Verifique também se `cancelar_venda` tem overloads duplicados pelo mesmo motivo (não deveria — sua assinatura `(p_venda_id uuid)` nunca mudou nas migrations 009/038 — mas confirme lendo as duas antes de assumir que está limpo).
2. **`src/server/routes/vendas.ts` (linhas 47-61)**: adicionar `p_nome_item: null` ao payload da RPC (a aba Vendas sempre exige `estoque_id`, então nunca precisa de nome avulso — mas passar explicitamente documenta a intenção e protege contra a mesma ambiguidade se uma 5ª versão for criada no futuro sem dropar a anterior).
3. **`src/services/mercadolivreSync.ts` (linhas 409-420)**: adicionar `p_componente: null` e `p_nome_item: null` ao payload da RPC, mesmo raciocínio.
4. Depois do fix, teste manualmente (ou peça pro usuário testar): vender um item comum pela aba Vendas com as mesmas condições da screenshot (PIX, cliente vinculado, sem componente).

**Não** mude o corpo de `registrar_venda` em si — a versão de 12 parâmetros já está correta (migration_048), o problema é só as duplicatas.

---

## FASE 1 — badge de "há quanto tempo" em cada venda

`src/features/vendas/types.ts` (linha 28) confirma que `Venda` já tem `criado_em: string` (timestamp real, diferente de `data`, que é só a data sem hora). Existe uma função pronta que já faz exatamente esse formato relativo em `src/features/tarefas/tarefaUtils.ts` (linhas 31-44), `formatarMomentoRelativo(iso, agora)`, usada hoje em `TarefaCards.tsx` linha 405 ("Designada em: {formatarMomentoRelativo(ativa.criado_em)}") — ela já devolve algo como "27/08 às 14:30 · 2h atrás".

1. Extraia `formatarMomentoRelativo` de `tarefaUtils.ts` pra um utilitário compartilhado (ex: `src/utils/tempoRelativo.ts`), já que agora serve duas features (Tarefas e Vendas) — reexporte de `tarefaUtils.ts` pra não quebrar o import existente em `TarefaCards.tsx`.
2. Em `src/features/vendas/VendasView.tsx`, dentro do `.map((venda) => ...)` da lista (linhas 169-224), adicione um `StatusBadge` (ou texto discreto, olhe o padrão visual já usado nas outras infos da linha, ex: `· {venda.cliente_nome}` na linha 203) mostrando só a parte relativa (ex: "há 2h", "há 3d") — não precisa repetir a data absoluta, que já aparece em `parseLocalDate(venda.data).toLocaleDateString('pt-BR')` (linha 188). Use `criado_em`, não `data`.
3. Anime a entrada do badge com `motion.span` (fade/slide sutil), consistente com o resto do projeto.

## FASE 2 — tarefas concluídas descem automaticamente na lista

Confirmado em `src/features/tarefas/TarefasView.tsx`: nem `VisaoCriador` (linha 180, `filtradas`) nem `VisaoResponsavel` ordenam a lista antes de passar pra `TarefaCards` — e `TarefaCards.tsx` (linha 422-423) só faz `.map()` na ordem recebida, sem sort próprio. A ordem vem crua da API.

1. Em `src/features/tarefas/tarefaUtils.ts`, adicione `ordenarTarefas(tarefas: Tarefa[]): Tarefa[]` — sort estável que põe `status === 'concluida'` sempre depois de `status !== 'concluida'`, preservando a ordem relativa dentro de cada grupo (não precisa de segundo critério de sort, só separar concluída de não-concluída).
2. Aplique em `TarefasView.tsx`: `filtradas` em `VisaoCriador` (linha 180) e `tarefas` em `VisaoResponsavel` antes de passar pra `<TarefaCards>` (linha 131 e linha 460).
3. Anime a transição de posição com `layout` do `motion.div` — `TarefaCards.tsx` já usa `motion.div` com `layoutId` nos cards (linha 427-429); adicionar `layout` (sem valor, prop booleana do framer-motion) faz o card animar suavemente pra nova posição quando o array reordena, em vez de saltar.
4. Não mude a ordenação quando `filtroStatus === 'concluida'` sozinho (não há "pendente" pra subir nesse caso) — a função deve simplesmente não ter efeito visível quando a lista é só de um status.

## FASE 3 — badge de campeão só pro cliente #1

Bug confirmado em `src/features/clientes/metricas.ts`, `calcularSegmento` (linhas 62-71): QUALQUER cliente com `quantidadeCompras >= 5` OU `totalGasto >= 500` recebe o segmento `'campeao'` — não é exclusivo de um único cliente. `ClientesView.tsx` chama `calcularSegmento` de forma independente em 3 pontos (linhas 499-500, 588-589, 950-962), sempre mostrando o `StatusBadge` de campeão pra qualquer cliente que bata o segmento.

A função `rankingTopClientes` (já existe em `metricas.ts`, linhas 131-143) já ordena por `totalGasto` desc e aceita `{ limite }` — é exatamente o que falta usar.

1. Em `ClientesView.tsx`, calcule uma vez (`useMemo`, no topo do componente que tem acesso a `clientes`/`vendas`/`orcamentos`) o id do cliente campeão real: `rankingTopClientes(clientes, vendas, orcamentos, { limite: 1 })[0]?.cliente.id ?? null`.
2. Crie um helper (em `metricas.ts` ou local ao componente) `segmentoParaExibicao(segmento: SegmentoCliente, clienteId: string, idCampeao: string | null): SegmentoCliente` que rebaixa `'campeao'` pra `'ativo'` quando `clienteId !== idCampeao` (mantém os outros segmentos intocados — sumido/em_risco/novo/sem_compras continuam valendo pra qualquer cliente que bata o critério, só "campeão" é exclusivo de um único cliente).
3. Aplique esse helper nos 3 pontos onde `calcularSegmento` é chamado (linhas 499, 588, 950) antes de usar o resultado no `StatusBadge`/`SEGMENTO_TONS`.
4. Não mude `calcularSegmento` em si (outras telas ou filtros podem depender do critério de threshold) — a restrição de exclusividade é só na exibição do badge em `ClientesView.tsx`.

## FASE 4 — remover distinção "Avulso" em Pendências, tratar tudo como "Pendência"

Confirmado em `src/features/caixa/PendenciasUnificadasTab.tsx`: a aba já unifica Fiado (vendas com forma de pagamento fiado) e pendências manuais de Caixa (tabela `caixa_pendencias`), mas ainda rotula o segundo tipo como "Avulso" em vários lugares:
- `type TipoItem = 'fiado' | 'avulso'` (linha 25) e `Filtro` (linha 26).
- 3 tabs "Todos/Fiado/Avulso" (linhas 696-701).
- `StatusBadge texto={item.tipo === 'fiado' ? 'Fiado' : 'Avulso'}` em cada card (linha 570).
- Card de métrica "Composição: X fiado · Y avulso" (linhas 685-692).
- Mensagens de EmptyState mencionando "avulsa" (linhas 713-722).

O pedido é remover a distinção Fiado/Avulso da UI — toda pendência (venha de uma venda fiado ou de um lançamento manual) deve aparecer só como "Pendência", sem badge de tipo nem filtro por tipo.

1. Remova as 3 tabs de filtro (linhas 696-701) e o `Filtro`/estado `filtro` (linha 26, 654-659) — a lista passa a mostrar sempre todos os itens (`itens`, não `filtrados`).
2. Remova o `StatusBadge` de tipo no `CardPendencia` (linha 570) — mantenha só a descrição e os outros badges (dias em aberto).
3. Troque o card "Composição" (linhas 685-692) por algo que não exponha o tipo — ex: reaproveitar esse slot pra outra métrica útil (ex: ticket médio em aberto) ou remover o card e passar o grid de métricas pra 2 colunas. Decida olhando o layout atual antes de remover — não deixe um buraco visual de 1/3 vazio.
4. Ajuste as mensagens de `EmptyState` (linhas 713-722) pra um texto único ("Nenhuma pendência em aberto."), sem menção a fiado/avulso.
5. **Mantenha** o campo interno `item.tipo` (`'fiado' | 'avulso'`) no código — ele ainda é necessário pra decidir qual API chamar ao confirmar recebimento (`fiadoApi` vs `caixaPendenciasApi`, linhas 524-529) e pra outras regras internas (ex: `podeReverterFiado` vs `podeReverterAvulso`, linhas 477-479). A remoção é só na camada visual (badges/tabs/labels), não no modelo de dados.
6. **Importante — não confundir com a Fase 6**: o texto do usuário também diz "Poder atrelar o Cliente à Pendência", que é sobre pendências manuais (`caixa_pendencias`) não terem cliente vinculado hoje — isso é a Fase 6 abaixo, tratada à parte porque envolve migration + rota, não só UI.

## FASE 5 — lembrete de pendência com notificação real + botão de WhatsApp pra qualquer pendência

Dois problemas confirmados juntos aqui:

### 5a — o "timer" de cobrança nunca dispara notificação push

`migration_049_cobrancas.sql` criou a tabela `cobrancas` com `intervalo_minutos`/`horario_fixo`/`proxima_notificacao_em`/`timer_ativo` — o MESMO modelo de `lembretes` (`migration_042_lembretes.sql`). Lembretes tem um scheduler dedicado, `src/services/lembretesScheduler.ts`, que chama a RPC `disparar_lembretes_devidos` a cada 30s e manda push via `notificarUsuario` (registrado em `server.ts` linha 46/361: `iniciarDisparoDeLembretes(supabase)`).

**Cobranças não tem nada equivalente.** Busquei em `src/services/*` e em `server.ts` — não existe `cobrancasScheduler.ts` nem qualquer chamada que leia `cobrancas.proxima_notificacao_em` e dispare notificação. O campo é gravado (`src/server/routes/cobrancas.ts`, linhas 44-51 e 105-113) mas nada nunca o consome. Ou seja: hoje, configurar um "Lembrete" numa pendência (botão em `PainelCobranca`, `PendenciasUnificadasTab.tsx` linhas 384-391) salva o timer no banco mas ele nunca notifica ninguém — é exatamente o "não funciona" que o usuário reportou.

1. Leia `migration_042_lembretes.sql` pra ver a definição exata de `disparar_lembretes_devidos` (a RPC que avança `proxima_notificacao_em` pros recorrentes e zera pros de horário fixo, devolvendo as linhas devidas).
2. Crie `supabase/migration_052_disparar_cobrancas_devidas.sql` com uma RPC análoga `disparar_cobrancas_devidas()`, adaptada ao shape de `cobrancas` (sem `atribuido_para` — cobrança não pertence a uma pessoa, é da equipe toda).
3. Crie `src/services/cobrancasScheduler.ts`, no mesmo molde de `lembretesScheduler.ts` (tick de 30s), mas notificando a EQUIPE toda (reaproveite `buscarDestinatariosEquipe` de `src/services/destinatariosNotificacao.ts`, já usado por `notificacoesScheduler.ts`) em vez de um usuário específico — o timer de cobrança é "lembrar a equipe de cobrar esse cliente", não notificar o cliente (isso é o botão de WhatsApp manual, que já existe).
4. Registre `iniciarDisparoDeCobrancas(supabase)` em `server.ts`, junto dos outros schedulers (perto da linha 361).
5. O corpo da notificação deve identificar a pendência (descrição + valor) — busque a `venda`/`pendencia` vinculada dentro da RPC ou do scheduler pra montar um texto útil (ex: "Cobrança pendente: Fulano — R$500,00"), não só "Lembrete".

### 5b — botão de WhatsApp só existe pra pendências tipo "fiado"

Em `PendenciasUnificadasTab.tsx`, `PainelCobranca` (linha 393): `{item.tipo === 'fiado' && <Button ...>WhatsApp</Button>}` — o botão só aparece pra vendas fiado, porque pendências manuais (`item.tipo === 'avulso'`) não têm `clienteTelefone` (a função `usePendenciasUnificadas`, linhas 76-88, sempre seta `clienteNome: null, clienteTelefone: null` pra esse tipo, já que `caixa_pendencias` não tem cliente vinculado hoje).

Esse problema se resolve sozinho depois da Fase 6 (vincular cliente à pendência manual) — depois que `caixa_pendencias` tiver `cliente_id`, ajuste `usePendenciasUnificadas` (linhas 76-88) pra preencher `clienteNome`/`clienteTelefone` a partir do cliente vinculado (igual já faz pra fiado, linha 59-60), e troque a condição do botão na linha 393 de `item.tipo === 'fiado'` pra simplesmente checar se existe telefone (`linkWhatsapp(item.clienteTelefone)` não for null) — assim o botão aparece pra QUALQUER pendência com cliente com telefone, fiado ou manual.

Implemente 5a e 5b nesta ordem (5a não depende de 5b; a parte de WhatsApp de 5b depende da Fase 6 estar pronta — pode implementar a Fase 6 antes de terminar a 5b, ou implementá-las na mesma leva).

## FASE 6 — vincular Cliente a uma Pendência manual

Confirmado: `caixa_pendencias` (`migration_041_caixa_pendencias.sql`) não tem coluna de cliente, e o formulário de criar pendência manual (`caixaPendenciasApi.criar`, `src/server/routes/caixaPendencias.ts` linhas 40-66) só aceita `descricao`/`valor_total`/`data`.

1. `supabase/migration_053_caixa_pendencias_cliente.sql`: `alter table caixa_pendencias add column if not exists cliente_id uuid references clientes(id) on delete set null;` (nullable — pendência sem cliente continua válida, mesmo espírito de `vendas.cliente_id`).
2. `src/features/caixa/types.ts`: adicione `cliente_id: string | null` e `cliente?: { id: string; nome: string; telefone: string | null } | null` em `CaixaPendencia`, e `cliente_id?: string | null` em `CaixaPendenciaInput`.
3. `src/server/routes/caixaPendencias.ts`: no `POST /` (linhas 40-66), aceite e grave `cliente_id: req.body?.cliente_id || null`; no `SELECT_PENDENCIA` (linha 12), adicione o join `cliente:clientes(id, nome, telefone)`.
4. No formulário de criar pendência manual (procure onde `caixaPendenciasApi.criar` é chamado no front — não está em `PendenciasUnificadasTab.tsx`, que só lê; deve estar em `CaixaView.tsx` ou outro modal de "Nova Pendência" — localize antes de editar), adicione um campo de cliente usando `SeletorCliente` (já existe, mesmo componente usado em Vendas e Tarefas).
5. Em `usePendenciasUnificadas` (`PendenciasUnificadasTab.tsx`, linhas 76-88), preencha `clienteNome`/`clienteTelefone` a partir de `p.cliente` quando existir, em vez de sempre `null` — isso é o que destrava o botão de WhatsApp da Fase 5b pra pendências manuais.

## FASE 7 — cidade do cliente

Confirmado: `Cliente`/`ClienteInput` (`src/features/clientes/types.ts`, linhas 83-128) não têm campo de cidade; `clientes` (`migration_027_clientes.sql`) também não.

1. `supabase/migration_054_clientes_cidade.sql`: `alter table clientes add column if not exists cidade text;`
2. `src/features/clientes/types.ts`: adicione `cidade: string | null` em `Cliente` e `cidade?: string | null` em `ClienteInput`.
3. `src/server/routes/clientes.ts`: adicione `'cidade'` em `CAMPOS_EDITAVEIS` (linha 16) e no payload do `POST /` (linhas 126-135, tratar como os outros campos de texto opcional — `req.body?.cidade ? String(req.body.cidade).trim() : null`).
4. `ClientesView.tsx`:
   - `EMPTY_FORM` (linhas 67-72): adicione `cidade: ''`.
   - Formulário de criar/editar (perto de "Telefone"/"Documento", linhas 760-805): adicione um input de Cidade, mesmo padrão visual dos outros campos.
   - `abrirEditar` (linha ~242, onde já preenche `telefone`/`documento`): inclua `cidade: cliente.cidade || ''`.
   - `handleSalvar`/payload de salvar (linhas 271-276): inclua `cidade: form.cidade?.trim() || null`.
   - Coluna nova na tabela (`DataTable`, ao lado da coluna `telefone`, linha 494): `{ key: 'cidade', header: 'Cidade', render: (c) => c.cidade || '—' }`.
   - Card mobile (linha ~552, onde mostra telefone) e o painel de detalhe (`ClienteProfileCard.tsx`, usado a partir da linha ~954): exiba a cidade também, mesmo padrão visual do telefone/documento.

## FASE 8 — card de fiado no Dashboard não mostra as pendências manuais

Confirmado: o card "Fiado em aberto" (`VisaoDono.tsx`, `MetricCard` linhas ~355-400, usando `desempenho.fiadoCompleto`/`fiadoTotalGeral` calculado nas linhas 186-193) e o alerta de fiado em `DashboardView.tsx` (linhas 348-359, `metrics.fiadoEmAberto`) alimentam-se de:
- `resumoFiadoPorCliente(vendas, fiadoRecebimentos)` — só vendas fiado, calculado no client; OU
- fallback `GET /api/dashboard/resumo-pendencias` (`src/server/routes/dashboard.ts`, linhas 8-79) — que TAMBÉM só consulta `orcamentos` (abertos) e `vendas` com forma de pagamento fiado. Em NENHUM dos dois pontos a tabela `caixa_pendencias` (pendências manuais, ver Fase 4/6) é consultada.

Ou seja: mesmo depois do fix de permissão já feito anteriormente (`DataContext.tsx` já busca `caixa_pendencias` quando o usuário tem `caixa.ver`, linhas 156-157), o card do Dashboard nunca soma essas pendências porque a rota/cálculo que alimenta o card não sabe que elas existem — é um problema estrutural, não de permissão.

Como a Fase 4 já unifica Fiado + Pendência manual como conceito único de "Pendência" na aba Caixa, faça o mesmo aqui: o card do Dashboard deve virar "Pendências em aberto" (não só "Fiado"), somando os dois tipos.

1. `src/server/routes/dashboard.ts`, rota `GET /resumo-pendencias` (linhas 8-79): adicione uma query a `caixa_pendencias` (status `'aberta'`) e `caixa_pendencia_recebimentos` (pra calcular saldo de cada uma, mesmo cálculo de `usePendenciasUnificadas` no front, linhas 69-75 de `PendenciasUnificadasTab.tsx`), e some ao `fiadoTotalEmAberto`/inclua na lista `fiadoResumo` (ou crie um campo separado tipo `pendenciasManuaisResumo` + `pendenciasManuaisTotalEmAberto` e some os totais na resposta final — decida pela abordagem que exigir menos mudança no formato já consumido pelo front, olhando como `fiadoResumo` é usado em `DashboardView.tsx`/`VisaoDono.tsx` antes de escolher).
2. `DashboardView.tsx` (linhas 348-359) e `VisaoDono.tsx` (linhas 186-193, 355-400): ajuste os cálculos/label do card pra refletir o total combinado, e troque o texto/label de "Fiado" pra "Pendências" (ou "Fiado + Pendências", o que couber melhor no card sem quebrar layout — veja como fica antes de decidir o texto final).
3. Não quebre o cálculo client-side de fallback (`resumoFiadoPorCliente`, usado quando `vendas`/`fiadoRecebimentos` já estão carregados) — ele hoje só cobre fiado; ao integrar pendências manuais, ambos os caminhos (client-side e vindo da API) precisam do mesmo total, ou o card pode "piscar" um valor menor no fallback e maior depois que a API responde. Se não der pra replicar o cálculo de pendências manuais no client-side com a mesma facilidade, considere sempre usar o valor da API pra pendências manuais (elas não têm o mesmo problema de streaming que motivou o fallback client-side do fiado — confirme lendo o comentário/motivo do fallback antes de decidir).

---

## Scope

- Trabalhe só em: `supabase/migration_051_*.sql` até `migration_054_*.sql` (novas), `src/server/routes/vendas.ts`, `src/server/routes/dashboard.ts`, `src/server/routes/clientes.ts`, `src/server/routes/caixaPendencias.ts`, `src/services/mercadolivreSync.ts`, `src/services/cobrancasScheduler.ts` (novo), `server.ts` (só a linha de import + registro do novo scheduler), `src/features/vendas/VendasView.tsx`, `src/features/tarefas/tarefaUtils.ts`, `src/features/tarefas/TarefasView.tsx`, `src/features/tarefas/TarefaCards.tsx`, `src/features/clientes/metricas.ts`, `src/features/clientes/types.ts`, `src/features/clientes/ClientesView.tsx`, `src/features/clientes/ClienteProfileCard.tsx`, `src/features/caixa/PendenciasUnificadasTab.tsx`, `src/features/caixa/types.ts`, `src/features/caixa/api.ts`, `src/features/dashboard/DashboardView.tsx`, `src/features/dashboard/VisaoDono.tsx`, `src/utils/tempoRelativo.ts` (novo).
- Pode precisar tocar no modal/formulário de "Nova Pendência" manual do Caixa (Fase 6, item 4) — localize o arquivo certo antes de editar (não presuma que é `CaixaView.tsx` sem confirmar).
- **Não** toque em `EstoqueView.tsx`, `OrcamentosView.tsx`, `MercadoLivreView.tsx`, `ShopeeView.tsx`, nada de publicação ML/Shopee além do trecho pontual da Fase 0, `UsuariosView.tsx`, ou qualquer migration já aplicada (002-050) — só crie migrations novas.

## Constraints

- Não recrie `registrar_venda` do zero — a versão de 12 parâmetros (`migration_048`) já está correta; a Fase 0 é só sobre derrubar as duplicatas.
- Não misture a Fase 4 (remover badge/tabs de tipo na UI) com a Fase 6 (vincular cliente) — são mudanças independentes em arquivos diferentes, implemente e teste cada uma separadamente.
- Todo componente novo de UI usa os componentes animados já listados em Context — não crie `<div>`/`<button>` cru pra badge, modal, tab ou seletor quando já existe um componente animado pronto pra isso no projeto.
- Migrations são só arquivos `.sql` novos em `supabase/` — não têm runner automático, então não tente "rodar" a migration você mesmo; só garanta que o SQL está correto pra o usuário colar no editor do Supabase.
- Só faça as mudanças pedidas nas 9 fases. Não refatore código ao redor, não corrija outros bugs que notar de passagem (liste-os no resumo final em vez de corrigir), não adicione funcionalidade não pedida.

## Acceptance Criteria

- [ ] Fase 0: venda pela aba Vendas (com cliente vinculado, sem componente) completa sem erro de "could not choose the best candidate function"; `importarPedidoComoVenda` (ML) também não quebra mais pelo mesmo motivo.
- [ ] Fase 1: cada linha da lista de Vendas mostra um badge/texto "há Xmin/Xh/Xd" baseado em `criado_em`.
- [ ] Fase 2: numa lista de tarefas com status misto, tarefas concluídas aparecem sempre depois das pendentes, e a transição anima ao marcar/desmarcar.
- [ ] Fase 3: com 2+ clientes que batem o critério de campeão, só o de maior `totalGasto` mostra o badge "Campeão" — os outros mostram o próximo segmento aplicável.
- [ ] Fase 4: aba Pendências não mostra mais "Avulso" em nenhum texto/badge/tab visível; todo item aparece uniformemente como pendência.
- [ ] Fase 5a: criar um timer de cobrança (intervalo curto, ex: 5min, pra testar) realmente dispara uma notificação push pra equipe quando o tempo passa.
- [ ] Fase 5b: uma pendência manual com cliente vinculado (telefone cadastrado) mostra o botão de WhatsApp, igual uma venda fiado.
- [ ] Fase 6: dá pra escolher um cliente cadastrado ao criar uma pendência manual, e ele aparece salvo/exibido depois.
- [ ] Fase 7: dá pra cadastrar cidade num cliente e ela aparece na tabela de clientes.
- [ ] Fase 8: uma pendência manual em aberto (sem nenhuma venda fiado) aparece refletida no card de pendências do Dashboard.

## Stop Conditions

Pare e pergunte antes de:
- Fazer qualquer `DROP FUNCTION`/`ALTER TABLE` que não seja exatamente o descrito nas Fases 0/6/7 acima.
- Adicionar qualquer dependência nova (nenhuma fase deveria precisar).
- Descobrir que o formulário de "Nova Pendência" manual (Fase 6) fica em um componente com lógica muito diferente do assumido aqui — descreva o que encontrou antes de adaptar a abordagem.
- Encontrar mais algum ponto do código chamando `registrar_venda` além dos 3 já identificados (vendas.ts, orcamentos.ts, mercadolivreSync.ts) — se aparecer um 4º, avise antes de decidir se ele também precisa do `p_nome_item`.

## Progress

Após cada fase concluída, produza: `✅ Fase N: [o que foi feito] — [arquivo(s) alterado(s)]`.
Ao final, um resumo com todas as migrations novas criadas (nomes de arquivo) e um lembrete explícito de que elas precisam ser rodadas manualmente no editor SQL do Supabase, na ordem 051 → 052 → 053 → 054.

## Session Strategy

Dado o tamanho (9 fases, 3 delas com migration nova), rode em blocos, com `/compact` entre eles:
- **Bloco 1**: Fase 0 (crítica, sozinha — é a que está bloqueando vendas agora).
- **Bloco 2**: Fases 1, 2, 3 (frontend puro, sem migration).
- **Bloco 3**: Fases 4, 5, 6, 7, 8 (Pendências/Cobranças/Clientes/Dashboard — mais interligadas entre si, fazem sentido numa leva só).
