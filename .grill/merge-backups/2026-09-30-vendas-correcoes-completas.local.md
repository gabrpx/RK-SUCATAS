# Vendas — Correções Completas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir confiabilidade financeira, completar os fluxos da nova rota `/vendas`, alinhar toda a interface a Estoque/Tarefas e atingir WCAG 2.1 AA sem enfraquecer a atomicidade de vendas, estoque e caixa.

**Architecture:** Extrair cálculos e adapters hoje concentrados em `VendasPreview.tsx` para view-models puros e testáveis; manter o frontend consumindo somente a API Express; reutilizar os componentes compartilhados de tabs, drawer, combobox, moeda e status. Alterações transacionais continuam nas RPCs `registrar_venda`/`cancelar_venda`; pagamentos múltiplos e contas a pagar entram somente após os gates de produto, contrato e banco abaixo.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Radix UI, AnimeJS, Recharts, Express, Supabase RPC, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-28-vendas-financeiro-unificado-design.md`

## Global Constraints

- Trabalhar somente em `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE` e confirmar branch/dirty tree antes de cada fase.
- Preservar dados e contratos existentes até que um task declare explicitamente sua migração.
- Frontend acessa somente a API Express; service role permanece no backend.
- `registrar_venda` e `cancelar_venda` continuam sendo a fronteira atômica para venda, baixa de estoque e caixa.
- Não alterar migration já aplicada. Toda evolução de schema/RPC usa migration nova e só é executada após aprovação explícita do usuário.
- Unidade física é obrigatória e quantidade é `1`, conforme `CLAUDE.md:37`, depois da decisão D1.
- Moeda em toda a experiência usa `CurrencyInput`/`Intl.NumberFormat('pt-BR', { currency: 'BRL' })`.
- Não usar `<select>` nativo, hex direto em componentes ou controles interativos menores que 44 px.
- Cards usam `rounded-card`; controles usam `rounded-control`; hover informativo altera borda/sombra sem deslocamento.
- Detalhes e formulários abrem em drawer lateral compartilhado.
- Todos os movimentos respeitam `prefers-reduced-motion`.
- Cada fase termina com revisão do diff, testes focados, `npm run lint` e `npm run build`.
- Mudanças em `src/server/routes/`, Supabase, RPCs, vendas e dados financeiros exigem revisão Codex antes de conclusão.
- A entrega final adiciona patchnote real em `src/features/patchnotes/data.ts`.

## Gates obrigatórios antes da fase transacional

### D1 — Venda de componentes e unidade obrigatória

Recomendação: toda venda deve registrar `unidade_id`, `quantidade = 1`; quando houver `componente`, ele pertence à unidade selecionada e não é mutuamente exclusivo com ela. Isso exige confirmar que o produto aceita vincular a venda parcial à ficha física. Sem essa decisão, Tasks 10 e 11 ficam limitadas à reorganização visual e não devem alterar a RPC.

### D2 — Pagamentos múltiplos

Recomendação: criar registros normalizados de pagamentos por venda e fazer a RPC gravar venda, baixa, pagamentos e entradas de caixa numa única transação. Não simular múltiplos pagamentos com múltiplos POSTs do frontend.

### D3 — Contas a pagar

Recomendação: criar domínio próprio de contas/ocorrências/pagamentos; não reutilizar `caixa_pendencias`, que hoje representa somente valores a receber. Recorrência gera ocorrências independentes.

### D4 — Saldo de caixa

Confirmar se o produto quer mostrar (a) resultado líquido do período ou (b) saldo acumulado real. Até a decisão, usar o nome matematicamente correto `Resultado líquido do período` e `Resultado diário` nos gráficos.

## Review Focus

- Venda sem entrada de caixa vinculada deve aparecer como `Conciliação necessária`, sem afirmar que está paga ou em dívida.
- Usuário com `vendas.ver` e sem `caixa.ver` deve ver a venda sem inferência ou vazamento de situação financeira.
- Valores grandes em reais devem continuar legíveis em 375 px sem corte, sobreposição ou quebra dígito a dígito.
- Uma das quatro fontes financeiras falhar não deve derrubar as outras três áreas já carregadas.
- Teclado e leitor de tela devem operar tabs, filtros, lista, gráficos e drawers sem depender de hover ou tooltip.

---

## Mapa de arquivos proposto

### Criar

- `src/features/vendas-preview/salesViewModel.ts` — adapter único de venda, pagamento, conciliação, unidade e canal.
- `src/features/vendas-preview/salesViewModel.test.ts` — matriz de permissão e conciliação.
- `src/features/vendas-preview/overviewModel.ts` — métricas por período versus posição atual.
- `src/features/vendas-preview/overviewModel.test.ts` — escopo temporal e totais.
- `src/features/vendas-preview/useSalesWorkspaceData.ts` — carregamento parcial, retry por recurso e estados independentes.
- `src/features/vendas-preview/useSalesWorkspaceData.test.tsx` — falhas parciais e reload.
- `src/features/vendas-preview/VendasPreview.test.tsx` — integração das quatro tabs.
- `src/features/vendas-preview/components/SalesFilters.tsx` — busca e filtros reutilizáveis.
- `src/features/vendas-preview/components/SalesList.tsx` — tabela desktop e cards mobile.
- `src/features/vendas-preview/components/MovementList.tsx` — movimentações e total coerente.
- `src/features/vendas-preview/components/PendingReceivableDrawer.tsx` — recebimento e cobrança real.
- `src/features/vendas-preview/components/NewSaleDrawer.tsx` — fluxo novo baseado em unidade.
- `src/features/vendas-preview/components/NewSaleDrawer.test.tsx` — seleção, moeda, validação e submissão.
- `src/features/vendas-preview/components/AccessibleChartSummary.tsx` — resumo/tabela de gráficos.
- `supabase/migration_071_vendas_pagamentos_contas_pagar.sql` — somente após D1–D3 e confirmação da sequência aplicada no ambiente alvo.

### Modificar

- `src/features/vendas-preview/VendasPreview.tsx` — composição e navegação, sem regras financeiras inline.
- `src/features/vendas-preview/liveData.ts` — delegar ao novo view-model e remover inferências conflitantes.
- `src/features/vendas-preview/data.ts` — tipos reais de origem, conciliação, unidade e comprovantes.
- `src/features/vendas-preview/components/OverviewMetrics.tsx` — grupos `No período` e `Posição atual`.
- `src/features/vendas-preview/components/SalesCharts.tsx` — nomenclatura, tokens, resumo acessível e reduced motion.
- `src/features/vendas-preview/components/SaleDetailDrawer.tsx` — foto, moto, unidade, observações, ML e comprovantes.
- `src/features/vendas-preview/components/PaymentMarks.tsx` — mapeamento seguro e fallback neutro.
- `src/features/estoque-preview/InventoryDrawer.tsx` — descrição contextual opcional.
- `src/features/vendas/VendasView.tsx` — retirar `NovaVendaDrawer` herdado após migração.
- `src/features/vendas/types.ts`, `src/features/vendas/api.ts` — contratos aprovados.
- `src/server/routes/vendas.ts` — joins completos e contrato transacional aprovado.
- `src/features/patchnotes/data.ts` — registro final da mudança.

### Remover ao final

- `src/features/vendas-preview/components/ActionDrawer.tsx` se continuar sem consumidor após os drawers reais.
- Ponte `vendas-antigo` e CTA “Gerenciar na tela anterior” somente quando paridade funcional estiver comprovada.

---

### Task 1: Fixar o comportamento atual em testes de integração

**Files:**
- Create: `src/features/vendas-preview/VendasPreview.test.tsx`
- Modify: `src/features/vendas-preview/movementFilters.test.ts`

**Interfaces:**
- Consumes: APIs existentes de Vendas, Caixa, Fiado e permissões.
- Produces: harness `renderVendasPreview(overrides)` reutilizado nas tasks seguintes.

- [ ] Criar factories mínimas para venda imediata, fiado, entrada, saída, pendência manual e recebimento.
- [ ] Mockar `podeAtual`, `vendasApi`, `caixaApi`, `caixaPendenciasApi` e `fiadoApi` com respostas independentes.
- [ ] Escrever testes que provem: rota abre em Visão geral; tabs trocam por click e setas; período inicia em 30 dias; filtros combinam busca/situação/canal/pagamento; drawer abre por uma venda; estados restrito/erro/vazio aparecem.
- [ ] Escrever teste de regressão que exponha o saldo de Movimentações calculado antes do filtro de período.
- [ ] Escrever teste de regressão que exponha a venda com pagamento informado e nenhuma entrada de caixa sendo rotulada como saldo em aberto.
- [ ] Run: `npx vitest run src/features/vendas-preview/VendasPreview.test.tsx src/features/vendas-preview/movementFilters.test.ts`
- [ ] Expected: testes novos de regressão falham; testes que documentam comportamento válido passam.
- [ ] Commit: `test(vendas): fixar comportamento da nova tela`

### Task 2: Criar um view-model financeiro sem inferências conflitantes

**Files:**
- Create: `src/features/vendas-preview/salesViewModel.ts`
- Create: `src/features/vendas-preview/salesViewModel.test.ts`
- Modify: `src/features/vendas-preview/data.ts`
- Modify: `src/features/vendas-preview/liveData.ts`

**Interfaces:**
- Produces:

```ts
export type SaleReconciliation =
  | { kind: 'unavailable' }
  | { kind: 'settled'; received: number }
  | { kind: 'open'; received: number; outstanding: number }
  | { kind: 'needs-review'; recordedMethod: string | null };

export interface SaleViewModel extends VendaDemo {
  reconciliation: SaleReconciliation;
  unidadeDetalhes: Venda['unidade'];
  moto: Venda['modelo_moto'];
  observacoes: string | null;
  mlOrderId: string | null;
}
```

- [ ] Testar venda imediata com entrada equivalente como `settled`.
- [ ] Testar venda imediata sem entrada vinculada como `needs-review`.
- [ ] Testar fiado parcial como `open` e fiado quitado como `settled`.
- [ ] Testar ausência de `caixa.ver` como `unavailable`, inclusive para venda não fiado.
- [ ] Implementar `buildSaleViewModels(vendas, caixa, fiado, { canViewCash })` sem fallback que trate forma informada como dinheiro efetivamente recebido.
- [ ] Preservar fotos, condição, avaria, moto, observações e IDs do Mercado Livre no view-model.
- [ ] Trocar `mapearVendas` pelo novo builder e manter wrappers temporários apenas onde evitarem um diff transversal.
- [ ] Run: `npx vitest run src/features/vendas-preview/salesViewModel.test.ts src/features/vendas-preview/VendasPreview.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `fix(vendas): tornar conciliacao financeira explicita`

### Task 3: Tornar o carregamento resiliente por recurso

**Files:**
- Create: `src/features/vendas-preview/useSalesWorkspaceData.ts`
- Create: `src/features/vendas-preview/useSalesWorkspaceData.test.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`

**Interfaces:**
- Produces:

```ts
type ResourceState<T> = {
  status: 'loading' | 'ready' | 'restricted' | 'error';
  data: T;
  error: string | null;
  retry: () => void;
};
```

- [ ] Testar vendas prontas com Caixa em erro.
- [ ] Testar Caixa pronto com recebimentos fiado em erro, preservando Movimentações e marcando somente recebíveis incompletos.
- [ ] Testar retry de um recurso sem recarregar a página ou apagar tab/filtros.
- [ ] Implementar requisições independentes; não usar um `Promise.all` que converta qualquer falha em indisponibilidade total.
- [ ] Substituir `window.location.reload()` por `resource.retry()`.
- [ ] Exibir aviso local e não bloqueante quando uma fonte complementar estiver indisponível.
- [ ] Run: `npx vitest run src/features/vendas-preview/useSalesWorkspaceData.test.tsx src/features/vendas-preview/VendasPreview.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `fix(vendas): preservar dados em falhas parciais`

### Task 4: Separar métricas do período e posição atual

**Files:**
- Create: `src/features/vendas-preview/overviewModel.ts`
- Create: `src/features/vendas-preview/overviewModel.test.ts`
- Modify: `src/features/vendas-preview/components/OverviewMetrics.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`

**Interfaces:**
- Produces:

```ts
export interface SalesOverview {
  period: { grossSales: number; salesCount: number; cashIn: number; cashOut: number; netResult: number };
  current: { receivable: number; overdue: number };
}
```

- [ ] Testar Hoje, últimos 30 dias e Este mês nos limites de data locais.
- [ ] Testar que recebíveis/atrasados não mudam com o seletor de período.
- [ ] Implementar cálculo puro e remover reducers financeiros inline de `VendasPreview.tsx`.
- [ ] Renderizar dois grupos com títulos visíveis: `No período` e `Posição atual`.
- [ ] Renomear “Saldo após saídas” para “Resultado líquido”.
- [ ] Em 375 px usar uma coluna para cards monetários; em `sm` usar duas e em `xl` quatro.
- [ ] Run: `npx vitest run src/features/vendas-preview/overviewModel.test.ts src/features/vendas-preview/VendasPreview.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `fix(vendas): esclarecer escopo das metricas`

### Task 5: Simplificar a Visão geral e tornar seus atalhos acionáveis

**Files:**
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Modify: `src/features/vendas-preview/components/OverviewMetrics.tsx`
- Test: `src/features/vendas-preview/VendasPreview.test.tsx`

**Interfaces:**
- Consumes: `SalesOverview` da Task 4.
- Produces: overview com um resumo agregado e uma fila curta de pendências.

- [ ] Testar que uma linha de “Últimas vendas” abre `SaleDetailDrawer`.
- [ ] Testar que o alerta mostra `N vencidas de M pendências` e abre a pendência mais urgente.
- [ ] Remover a repetição simultânea de alerta, gráfico de idade e lista de antigos; mover análise completa de idade para Pendências.
- [ ] Manter na Visão geral: métricas, últimas vendas acionáveis, alerta urgente e dois gráficos.
- [ ] Remover o segundo indicador textual de “dados reais/atuais”; manter somente um estado discreto de sincronização.
- [ ] Run: `npx vitest run src/features/vendas-preview/VendasPreview.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `refactor(vendas): reduzir repeticao na visao geral`

### Task 6: Corrigir gráficos, semântica e alternativa acessível

**Files:**
- Create: `src/features/vendas-preview/components/AccessibleChartSummary.tsx`
- Modify: `src/features/vendas-preview/components/SalesCharts.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Test: `src/features/vendas-preview/components/SalesCharts.test.tsx`

**Interfaces:**
- Produces: `AccessibleChartSummary({ title, rows })` com resumo visível e tabela `sr-only` expansível por botão.

- [ ] Testar que tendência informa total atual, anterior e variação sem depender do SVG.
- [ ] Testar que caixa chama a linha de `Resultado diário`, conforme D4 provisório.
- [ ] Testar que `prefers-reduced-motion` zera duração de animação.
- [ ] Substituir hexadecimais diretos por tokens CSS de gráfico/semânticos.
- [ ] Usar `negative` para saídas em legenda e série, mantendo texto e sinal como redundância.
- [ ] Adicionar título, descrição e tabela textual aos dois gráficos.
- [ ] Run: `npx vitest run src/features/vendas-preview/components/SalesCharts.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `fix(vendas): tornar graficos claros e acessiveis`

### Task 7: Refazer filtros e lista responsiva de vendas

**Files:**
- Create: `src/features/vendas-preview/components/SalesFilters.tsx`
- Create: `src/features/vendas-preview/components/SalesList.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Modify: `src/features/vendas-preview/components/PaymentMarks.tsx`
- Test: `src/features/vendas-preview/components/SalesFilters.test.tsx`
- Test: `src/features/vendas-preview/components/SalesList.test.tsx`

**Interfaces:**
- Produces: `SalesFilterState`, `filterSales(sales, state)` e `SalesList` com variante desktop/mobile por CSS.

- [ ] Testar busca por cliente, peça, ID e SKU com normalização de acentos.
- [ ] Testar filtros combinados e chips removíveis de 44 px.
- [ ] Trocar Cliente e Peça em “Mais filtros” por `Combobox` pesquisável alimentado pelas opções reais da lista.
- [ ] Adicionar `aria-label` visível ou programático a todas as buscas.
- [ ] Renderizar tabela desktop com colunas alinhadas e cards mobile com rótulos `Cliente`, `Peça`, `Pagamento`, `Valor` e `Estado`.
- [ ] Aplicar a borda Mercado Livre dentro da geometria da linha, sem `mx`, `my` ou alteração de largura.
- [ ] Mapear Pix, dinheiro, débito e crédito; usar ícone neutro `CircleHelp` para métodos desconhecidos.
- [ ] Manter a proposta de tooltip do cliente documentada, sem ação falsa, até a tela Clientes fornecer drawer público.
- [ ] Run: `npx vitest run src/features/vendas-preview/components/SalesFilters.test.tsx src/features/vendas-preview/components/SalesList.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `feat(vendas): melhorar filtros e lista responsiva`

### Task 8: Enriquecer o detalhe com os dados reais disponíveis

**Files:**
- Modify: `src/server/routes/vendas.ts:12-24`
- Modify: `src/features/vendas/types.ts`
- Modify: `src/features/vendas-preview/components/SaleDetailDrawer.tsx`
- Modify: `src/features/estoque-preview/InventoryDrawer.tsx`
- Test: `src/features/vendas-preview/components/SaleDetailDrawer.test.tsx`
- Test: `src/server/routes/vendas.test.ts`

**Interfaces:**
- `InventoryDrawer` recebe `description?: string` e usa descrição contextual no Radix.
- A resposta de venda inclui `unidade.sku`, `descricao`, `condicao_nota` e fotos já existentes no schema.

- [ ] Antes de editar a rota crítica, identificar alterações locais, consumidores e confirmar que nenhum agente trabalha no arquivo.
- [ ] Testar o SELECT esperado sem expor campos sensíveis.
- [ ] Testar drawer com foto própria, fallback “Sem foto”, condição, avaria, moto, quantidade, observações e IDs ML.
- [ ] Expandir `SELECT_COM_JOIN` somente com colunas existentes e necessárias.
- [ ] Reutilizar `InventoryPhotoGallery`/helper de URL em vez de criar zoom novo.
- [ ] Reutilizar `ComprovantesPixVenda` em modo leitura e respeitar `vendas.excluir_comprovante` para exclusão.
- [ ] Corrigir a descrição do Radix para “Detalhes da venda {id}”.
- [ ] Run: `npx vitest run src/features/vendas-preview/components/SaleDetailDrawer.test.tsx src/server/routes/vendas.test.ts`
- [ ] Expected: PASS.
- [ ] Solicitar revisão Codex do contrato e da rota.
- [ ] Commit: `feat(vendas): completar detalhe com dados reais`

### Task 9: Corrigir Movimentações e o total filtrado

**Files:**
- Create: `src/features/vendas-preview/components/MovementList.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Modify: `src/features/vendas-preview/movementFilters.ts`
- Test: `src/features/vendas-preview/movementFilters.test.ts`

**Interfaces:**
- Produces: `filterMovements(items, { query, type, period, now })` e `netMovementTotal(filtered)`.

- [ ] Testar que total usa exatamente a lista após busca, tipo e período.
- [ ] Testar data limite de 30 dias e futuro fora do período.
- [ ] Trocar Todos/Entradas/Saídas por tabs segmentadas, pois são três opções estáveis.
- [ ] Usar a mesma semântica visual de saídas no gráfico e na lista.
- [ ] Tornar linhas acionáveis apenas quando houver destino real; caso contrário, mantê-las como conteúdo estático.
- [ ] Run: `npx vitest run src/features/vendas-preview/movementFilters.test.ts src/features/vendas-preview/VendasPreview.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `fix(vendas): alinhar movimentacoes e saldo filtrado`

### Task 10: Tornar Pendências verdadeira e acionável com APIs existentes

**Files:**
- Create: `src/features/vendas-preview/components/PendingReceivableDrawer.tsx`
- Modify: `src/features/vendas-preview/data.ts`
- Modify: `src/features/vendas-preview/liveData.ts`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Test: `src/features/vendas-preview/components/PendingReceivableDrawer.test.tsx`

**Interfaces:**
- `PendenciaDemo` ganha `source: { kind: 'fiado'; vendaId: string } | { kind: 'caixa'; pendenciaId: string }`.
- Drawer usa `fiadoApi.registrarRecebimento` ou `caixaPendenciasApi.registrarRecebimento` de acordo com `source.kind`.

- [ ] Testar recebimento parcial de fiado e pendência manual com a API correta.
- [ ] Testar limite máximo pelo saldo e erro inline de valor zero.
- [ ] Testar permissão: sem permissão de receber, drawer vira consulta.
- [ ] Remover card “A pagar — Não disponível” e filtro Todas/A receber enquanto D3 não estiver entregue.
- [ ] Adicionar ações `Registrar recebimento` e `Revisar cobrança` no item, ambas em drawer.
- [ ] Após sucesso, recarregar somente recebimentos/pendências e manter tab/scroll.
- [ ] Manter cobrança como revisão manual; nenhum envio automático.
- [ ] Remover “Consulta somente leitura” repetido de cada linha e mostrar uma nota única da seção quando necessário.
- [ ] Run: `npx vitest run src/features/vendas-preview/components/PendingReceivableDrawer.test.tsx src/features/vendas-preview/VendasPreview.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `feat(vendas): permitir tratar recebiveis na nova tela`

### Task 11: Substituir o formulário herdado de Nova venda

**Files:**
- Create: `src/features/vendas-preview/components/NewSaleDrawer.tsx`
- Create: `src/features/vendas-preview/components/NewSaleDrawer.test.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Modify: `src/features/vendas/VendasView.tsx`
- Modify: `src/features/vendas/types.ts`

**Interfaces:**
- Consome o contrato atual de `vendasApi.registrar` até D1/D2 serem aprovados.
- Estado monetário usa centavos inteiros no frontend.

- [ ] Testar abertura, foco inicial, Escape e retorno de foco ao CTA.
- [ ] Testar busca de unidade por peça, código, SKU, moto e endereço reutilizando o modelo de busca do novo Estoque.
- [ ] Testar que unidade vendida/arquivada/reservada não pode ser selecionada.
- [ ] Testar cliente pesquisável com badges de todas as motos e opção Balcão.
- [ ] Testar `CurrencyInput` com `R$ 1.234,56`, data e observações.
- [ ] Após D1, testar e exigir `unidade_id`, fixar quantidade `1` e remover “Unidade genérica”.
- [ ] Substituir `CustomDropdown` por `Select` com ícones de pagamento.
- [ ] Trocar grids fixas por `grid-cols-1 sm:grid-cols-2`.
- [ ] Usar `rounded-card`, `rounded-control`, labels do design system e alvos de 44 px.
- [ ] Exibir erros junto ao campo e resumo de erro com `role="alert"`; botão desabilitado inclui texto auxiliar sobre o requisito ausente.
- [ ] Remover a exportação antiga de `NovaVendaDrawer` quando nenhum consumidor restar.
- [ ] Run: `npx vitest run src/features/vendas-preview/components/NewSaleDrawer.test.tsx src/features/vendas/VendasView.nomeQuebra.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `feat(vendas): reconstruir drawer de nova venda`

### Task 12: Implementar pagamentos múltiplos e contas a pagar de forma atômica

**Files:**
- Create after D1–D3 approval: `supabase/migration_071_vendas_pagamentos_contas_pagar.sql`
- Modify: `src/server/routes/vendas.ts`
- Create: `src/server/routes/contasPagar.ts`
- Modify: `src/features/vendas/types.ts`
- Modify: `src/features/vendas/api.ts`
- Modify: `src/features/vendas-preview/components/NewSaleDrawer.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Test: route/RPC contract tests and frontend drawer tests.

**Interfaces:**
- Payload proposto após aprovação:

```ts
interface VendaPagamentoInput { forma_pagamento_id: string; valor: number }
interface VendaInputV2 extends Omit<VendaInput, 'quantidade' | 'forma_pagamento_id'> {
  unidade_id: string;
  quantidade: 1;
  pagamentos: VendaPagamentoInput[];
}
```

- [ ] Confirmar sequência aplicada no Supabase alvo e aprovação explícita antes de criar/executar SQL.
- [ ] Escrever testes de contrato: soma menor que total cria recebível; soma igual quita; soma maior rejeita; falha em qualquer etapa reverte venda, unidade, pagamentos e caixa.
- [ ] Criar migration nova com tabelas/índices/RLS/RPC aprovados; não editar migrations anteriores.
- [ ] Atualizar Express para validar centavos, duplicidade de método permitida/proibida conforme decisão e unidade obrigatória.
- [ ] Atualizar drawer para adicionar/remover métodos, mostrar total, recebido e saldo em tempo real.
- [ ] Implementar contas a pagar, ocorrências recorrentes e pagamentos parciais somente pelo contrato D3 aprovado.
- [ ] Executar testes de contrato local; não executar migration em produção sem autorização separada.
- [ ] Solicitar revisão Codex obrigatória de SQL, RLS, RPC e efeitos financeiros.
- [ ] Commit: `feat(vendas): registrar pagamentos e contas atomicamente`

### Task 13: Corrigir contraste, foco, movimento e tokens

**Files:**
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Modify: `src/features/vendas-preview/components/*.tsx`
- Modify: `src/features/estoque-preview/InventoryDrawer.tsx`
- Modify: `src/styles/theme.css` somente se não existir token apropriado.
- Test: `src/features/vendas-preview/VendasPreview.a11y.test.tsx`

**Interfaces:**
- Nenhuma API pública nova além de `InventoryDrawer.description` da Task 8.

- [ ] Substituir `text-faint` em texto informativo pequeno por `text-muted` ou `text-secondary`; reservar faint para decoração não essencial.
- [ ] Garantir 4,5:1 em textos e 3:1 em limites/foco de controles.
- [ ] Remover hex diretos e classes `slate-*` da feature quando houver token semântico equivalente.
- [ ] Garantir nome acessível em buscas, popovers, badges numéricos e botões de ícone.
- [ ] Fazer popover anunciar conteúdo, devolver foco e fechar somente a camada superior com Escape.
- [ ] Aplicar `useReducedMotion` a linhas, alertas, barras, métricas e DotMatrix; evitar AnimeJS + Motion no mesmo elemento.
- [ ] Garantir 44×44 px em chips removíveis, opções, botões de texto e edição.
- [ ] Testar navegação completa por Tab, setas, Enter e Escape.
- [ ] Run: `npx vitest run src/features/vendas-preview/VendasPreview.a11y.test.tsx src/components/ui/Select.test.tsx src/components/ui/Combobox.test.tsx`
- [ ] Expected: PASS.
- [ ] Commit: `fix(vendas): atingir consistencia visual e acessibilidade`

### Task 14: Remover pontes antigas e validar paridade

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Delete: `src/features/vendas-preview/components/ActionDrawer.tsx` se `rg` confirmar zero consumidores.
- Modify: `docs/superpowers/specs/2026-09-28-vendas-financeiro-unificado-design.md`
- Modify: `src/features/patchnotes/data.ts`

**Interfaces:**
- `/vendas` permanece a rota canônica.
- `vendas-antigo` só é removida após critérios abaixo.

- [ ] Executar `rg` para provar que Nova venda, recebimento, detalhe, cancelamento/reversão autorizada e comprovantes possuem destino na nova experiência.
- [ ] Confirmar que usuários sem cada permissão recebem o estado correto e não um botão quebrado.
- [ ] Remover “Gerenciar na tela anterior” somente após paridade; manter a rota antiga durante uma release de observação se cancelamento ainda depender dela.
- [ ] Remover código demonstrativo e documentação que afirme capacidades inexistentes.
- [ ] Adicionar patchnote descrevendo nova venda por unidade, conciliação, drawers e acessibilidade.
- [ ] Run: `npm run lint`
- [ ] Expected: exit 0.
- [ ] Run: `npm test`
- [ ] Expected: exit 0.
- [ ] Run: `npm run build`
- [ ] Expected: exit 0.
- [ ] Validar manualmente 375×812, 768×1024 e 1440×900: quatro tabs, filtros, drawers, teclado, redução de movimento e cifras grandes.
- [ ] Revisar diff completo e solicitar revisão Codex final das áreas financeiras e críticas.
- [ ] Commit: `feat(vendas): concluir migracao da nova experiencia`

---

## Ordem de execução e releases

1. **Release A — confiabilidade e leitura:** Tasks 1–9 e 13. Corrige números, períodos, detalhes, responsividade e acessibilidade sem mudar schema.
2. **Release B — operação real:** Tasks 10–11 após D1. Incorpora recebimentos e Nova venda coerente na nova interface.
3. **Release C — evolução transacional:** Task 12 após D1–D3 e aprovação explícita de migration/produção.
4. **Release D — retirada da tela anterior:** Task 14 após paridade comprovada e observação em produção.

## Critérios finais de aceite

- Nenhum card mistura dado global e dado do período sem rótulo explícito.
- Nenhuma venda recebe estado financeiro contraditório; inconsistência vira conciliação necessária.
- Nova venda usa unidade física, quantidade 1, cliente pesquisável com motos e valores em BRL.
- Movimentações calculam total sobre o mesmo conjunto visível.
- Pendências atuais podem receber pagamento e revisão em drawer.
- Contas a pagar aparecem somente quando houver fonte real aprovada.
- Fotos, condição, moto, observações, ML e comprovantes aparecem quando existirem.
- Desktop e mobile têm composições próprias e equivalência funcional.
- Todos os componentes críticos operam por teclado, têm foco visível e respeitam movimento reduzido.
- Não existem hex diretos na feature quando um token semântico cobre o uso.
- A tela anterior deixa de ser necessária antes de sua ponte ser removida.

## Self-review

- Cobertura da auditoria: confiabilidade financeira, escopo das métricas, overview, gráficos, filtros, mobile, Mercado Livre, métodos, detalhe, movimentações, pendências, Nova venda, contraste, teclado, motion, estados, testes e retirada da tela antiga possuem task associado.
- Decisões de banco/produto não foram inventadas: D1–D4 bloqueiam somente as tasks que dependem delas.
- Interfaces compartilhadas mantêm nomes consistentes entre produtores e consumidores.
- Não há alteração de código de produção neste documento.
