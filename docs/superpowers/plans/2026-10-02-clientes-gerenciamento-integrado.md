# Clientes — central de gerenciamento operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use subagents only if the user explicitly requests delegation and the files can remain isolated. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar Clientes em uma central operacional integrada a Tarefas e Estoque, com contatos WhatsApp/Instagram, pedidos em busca, visitas, correspondência assistida, reservas reais, notificações internas e mapa local do Brasil.

**Architecture:** Preservar `clientes`, `clientes_motos`, `pecas_procuradas`, `tarefas` e `estoque_reservas` como fontes existentes, evoluindo-as apenas por migrations novas. A UI de Clientes consome somente rotas Express; regras puras de prioridade/transição ficam em módulos testáveis; visitas continuam sendo registros de `tarefas`; reservas continuam sendo registros de `estoque_reservas`; correspondências viram sugestões persistidas e nunca encerram pedidos automaticamente.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind 4, Motion, Radix UI, Express 4, Supabase/Postgres, Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-10-02-clientes-gerenciamento-integrado-design.md`](../specs/2026-10-02-clientes-gerenciamento-integrado-design.md)

## Global Constraints

- Confirmar `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`, branch e alterações locais antes de cada fase.
- Não editar migration aplicada. `071` já está reservada pelo plano de correções de Vendas; este plano reserva `072`–`075`. Antes de criar cada arquivo, revalidar migrations existentes e planos ativos; se houver colisão, parar e renumerar o conjunto após revisão humana.
- Não executar SQL em Supabase real sem autorização explícita e confirmação da sequência aplicada.
- Frontend nunca acessa Supabase diretamente.
- Toda tabela nova habilita RLS e revoga `anon`/`authenticated`; toda função/RPC fixa `search_path = public`, revoga `PUBLIC` e concede execução somente a `service_role`, seguindo o padrão das migrations 066–069.
- Não alterar a atomicidade de `registrar_venda` ou `cancelar_venda`.
- Não criar fonte paralela para visita ou reserva.
- Não instalar dependências. O mapa usa SVG/GeoJSON local e projeção própria simples.
- Não enviar WhatsApp, Instagram, e-mail ou push; abrir canal é apenas navegação externa.
- Não implementar nesta entrega promoções, devoluções, campanhas, integração com API do WhatsApp, leitura de mensagens, união de duplicados, rastreio/rota de frete ou conquistas do mapa.
- Preservar ViaCEP com fallback manual; falha externa não bloqueia cadastro.
- Preservar clientes legados incompletos; obrigatoriedade vale em criação e na próxima edição/pedido.
- Usar os tokens/componentes de Vendas, Estoque e Tarefas; validar desktop e 375 px.
- Seguir TDD em regras, rotas e componentes. Cada tarefa termina com teste focal e revisão de diff.
- Não fazer commit, push, merge ou deploy sem pedido explícito, mesmo quando o workflow genérico sugerir commit.
- Arquivos críticos (`src/App.tsx`, `src/server/routes/`, `supabase/`) exigem checkpoint, inspeção de consumidores e revisão final focada.

## Decisions locked for execution

- `telefone` continua armazenando somente dígitos e representa o WhatsApp quando o canal existir.
- `instagram_usuario` armazena o identificador sem `@`, em minúsculas.
- `preferencia_contato` preserva valores legados e ganha `instagram`; a UI nova oferece WhatsApp/Instagram.
- Origens oferecidas pela UI: `whatsapp`, `facebook`, `mercado_livre`, `instagram`, `indicacao`, `balcao`; valores legados `redes_sociais` e `outro` permanecem válidos apenas para registros existentes.
- Pedido em busca continua em `pecas_procuradas`, com ciclo expandido e histórico append-only.
- Correspondência pendente não muda o status do pedido. Somente confirmação humana muda para `peca_disponivel`.
- Visita continua em `tarefas` (`tipo='visita'`) e ganha campos próprios; nenhuma tabela de visita concorrente será criada.
- Reserva continua em `estoque_reservas`. A regra aprovada é dois dias por padrão e máximo de cinco para novas reservas; o sinal mínimo atual de 20% permanece até decisão explícita no Gate 0/Checkpoint B, sem mudança unilateral.
- Reserva vencida com visita futura entra em `decisao_pendente`, continua bloqueando a unidade e exige `Renovar` ou `Liberar`; não recebe nova data silenciosamente.
- Mapa usa dados oficiais do IBGE gerados no desenvolvimento e versionados; zero chamadas geográficas em runtime.

## Current-state hazards to remove

1. `src/server/routes/estoque.ts::casarComPecasProcuradas` cria tarefa e marca `atendida` automaticamente. Isso contradiz a confirmação humana e deve ser substituído de forma compatível.
2. Estoque usa `DIAS_RESERVA_PADRAO = 7` e máximo de 30 dias. A nova regra precisa ser global, inclusive API e RPC.
3. `ClienteFormModal` exibe CEP, mas não persiste endereço completo.
4. `TaskNotificationBell` conhece somente tarefas e está duplicado em cabeçalhos de features.
5. `ClientesView.tsx` e `ClienteDetalheModal.tsx` são grandes; a nova UI deve ser dividida por responsabilidade sem reescrever métricas comerciais funcionais.

## File map

### Create

- `supabase/migration_072_clientes_operacao_base.sql` — contatos, endereço, moto principal, ciclo do pedido, eventos e RPC cliente+pedido.
- `supabase/migration_073_clientes_visitas.sql` — campos de visita em `tarefas`, vínculo N:N com pedidos e histórico de visita.
- `supabase/migration_074_clientes_matching.sql` — sugestões de correspondência e sinônimos auditáveis.
- `supabase/migration_075_clientes_reservas_politica.sql` — política global 2/5 dias e estado de decisão pendente.
- `docs/validacao-clientes-operacao-072-075.sql` — roteiro transacional de homologação e rollback lógico.
- `docs/validacao-clientes-gerenciamento-integrado.md` — matriz visual inicial e evidências finais desktop/mobile/a11y.
- `src/features/clientes/operacaoTypes.ts` — contratos do frontend.
- `src/features/clientes/operacaoModel.ts` e teste — prioridade, situação e transições.
- `src/features/clientes/operacaoCopy.ts` e teste — vocabulário cotidiano centralizado para estados e ações.
- `src/features/clientes/useClientesOperacao.ts` — carregamento/refresh da central.
- `src/server/routes/clientes/clientesValidacao.ts` e teste — normalização/validação de payloads.
- `src/server/routes/clientes/clientesOperacao.ts` e teste — resumo, cadastro+pedido e transições.
- `src/server/routes/clientes/clientesVisitas.ts` e teste — agenda sobre `tarefas`.
- `src/services/clientesMatchingService.ts` e teste — criação idempotente de sugestões.
- `src/server/routes/clientes/clientesMatching.ts` e teste — confirmação/rejeição/sinônimos.
- `src/components/ui/operationalTokens.ts` — tokens claros compartilhados, com aliases temporários para Estoque/Vendas.
- `src/components/ui/OperationalDrawer.tsx` e teste — drawer compartilhado com largura configurável e rodapé fixo.
- `src/features/clientes/components/ClientesHeader.tsx`
- `src/features/clientes/components/ClientesMetricStrip.tsx`
- `src/features/clientes/components/ClientesPainel.tsx` e teste.
- `src/features/clientes/components/ClientesLista.tsx` e teste.
- `src/features/clientes/components/ClientesAgenda.tsx` e teste.
- `src/features/clientes/components/ClienteDrawer.tsx` e teste.
- `src/features/clientes/components/RegistrarPedidoDrawer.tsx` e teste.
- `src/features/clientes/components/ClienteFormDrawer.tsx` e teste.
- `src/features/clientes/mapa/ClientesMapa.tsx` e teste.
- `src/features/clientes/mapa/mapaModel.ts` e teste.
- `src/features/clientes/mapa/brasil-estados.geo.json` — malha mínima versionada.
- `src/features/clientes/mapa/municipios-centroides.json` — coordenadas/versionamento.
- `src/features/clientes/mapa/README.md` — fonte, data e processo de atualização.
- `scripts/gerar-mapa-clientes.mjs` — geração explícita a partir da API oficial do IBGE.
- `src/features/notificacoes/OperationalNotificationBell.tsx` e teste.
- `src/features/notificacoes/operationalNotificationsModel.ts` e teste.
- `src/utils/instagram.ts` e teste.

### Modify

- `src/features/clientes/types.ts`, `api.ts`, `ClientesView.tsx`, `ClienteProfileCard.tsx`, `metricas.ts`.
- `src/features/clientes/ClienteFormModal.tsx` e `ClienteDetalheModal.tsx` — retirar do caminho novo após paridade; não excluir até o teste de regressão.
- `src/server/routes/clientes.ts` — campos legados e montagem dos subrouters antes de `/:id`.
- `src/server/routes/estoque.ts` e teste — substituir fechamento automático por serviço de sugestão.
- `src/server/routes/estoqueOrganizacao.ts` e teste — sugerir match ao adicionar unidade e aplicar 2/5 dias.
- `src/features/estoque-preview/inventoryPreviewModel.ts`, teste e `InventoryUnitDrawer.tsx` — regra 2/5 e estado de decisão.
- `src/features/estoque-preview/InventoryDrawer.tsx` — wrapper compatível sobre `OperationalDrawer`.
- `src/features/tarefas/types.ts`, `api.ts`, `useTarefas.ts` e componentes que exibem visitas.
- `src/features/notificacoes/TaskNotificationBell.tsx` — wrapper temporário compatível ou remoção depois de migrar consumidores.
- `src/features/estoque-preview/EstoquePreview.tsx`, `src/features/tarefas-preview/TasksPreview.tsx` — sino unificado.
- `src/constants/permissoes.ts` e teste — adicionar `clientes.administrar` para origem, bloqueio e sinônimos; preservar JSON legado e `clientes.editar` para ações rotineiras.
- `src/constants/loja.ts` — cidade/UF local do marcador da loja, derivados do CEP já existente.
- `src/App.tsx` — apenas deep-links do sino para tarefa/cliente, após checkpoint.

## Review Focus

1. Contato compartilhado por familiares: alerta de duplicidade deve permitir confirmação separada sem índice único bloqueando.
2. Peça com categoria compatível e moto incompatível: não sugerir match; ambos os critérios informados devem passar.
3. Visita reagendada: lembretes antigos desaparecem e a mesma tarefa permanece como fonte única.
4. Reserva vencida com visita futura: unidade continua bloqueada em `decisao_pendente`; sem visita, fica disponível e registra liberação.
5. Cidade sem coordenada ou grafia legada: lista continua funcional e o mapa mostra “Localização não encontrada”, sem posicionar ponto incorreto.

---

## GATE 0 — aprovação antes de executar código de produto

Antes da Task 1, o usuário deve aprovar este plano e registrar duas decisões transversais de reserva: (1) confirmar se o sinal mínimo atual de 20% permanece junto da regra global de dois dias por padrão/cinco no máximo; (2) decidir se uma venda para o mesmo cliente consome/libera a reserva dentro de `registrar_venda` ou continua exigindo liberação explícita antes da venda. Reservas legadas sem cliente nunca são consumidas por inferência. Sem essas decisões, é permitido continuar investigação read-only, mas não iniciar alteração de produto, banco ou contrato.

## Release 0 — Baseline e contratos puros

### Task 1: Fixar contratos atuais antes das migrations

**Files:**
- Test: `src/features/clientes/ClientesView.test.tsx`
- Test: `src/server/routes/clientes.operacao-baseline.test.ts`
- Test: `src/server/routes/estoque.test.ts`

**Interfaces:**
- Consumes: `clientesApi`, `ClientesView`, criação atual de estoque.
- Produces: testes que protegem histórico, cidade/UF, ViaCEP e evidenciam o auto-fechamento atual a ser substituído.

- [ ] **Step 1:** registrar em teste que `GET /api/clientes/:id` continua devolvendo notas, motos, peças procuradas e comprovantes.
- [ ] **Step 2:** registrar em teste que criar cliente legado sem telefone/cidade continua aceito pela rota atual; a nova obrigatoriedade será aplicada apenas nos endpoints novos/edição guiada.
- [ ] **Step 3:** escrever teste de caracterização verde demonstrando que o match atual muda `aguardando` para `atendida`; documentar que a expectativa será invertida dentro da Task 14, imediatamente antes da substituição.
- [ ] **Step 4:** executar `npx vitest run src/server/routes/clientes.operacao-baseline.test.ts src/server/routes/estoque.test.ts` e confirmar que o baseline permanece verde.
- [ ] **Step 5:** executar `git diff --check` e revisar que só testes foram adicionados.

### Task 2: Criar modelo puro de situação, prioridade e transições

**Files:**
- Create: `src/features/clientes/operacaoTypes.ts`
- Create: `src/features/clientes/operacaoModel.ts`
- Test: `src/features/clientes/operacaoModel.test.ts`
- Create: `src/features/clientes/operacaoCopy.ts`
- Test: `src/features/clientes/operacaoCopy.test.ts`

**Interfaces:**
- Produces:
  - `type PedidoBuscaEstadoPersistido = 'nova' | 'em_busca' | 'peca_disponivel' | 'aguardando_cliente' | 'vendida' | 'nao_encontrada' | 'cliente_desistiu' | 'cancelada' | 'aguardando' | 'atendida'`
  - `type PedidoBuscaSituacao = PedidoBuscaEstadoPersistido | 'reservada' | 'visita_agendada'`; os dois últimos são derivados dos registros reais, nunca fontes paralelas.
  - `type PedidoBuscaAcao = 'iniciar_busca' | 'cliente_avisado' | 'cliente_desistiu' | 'aguardando_resposta' | 'vai_buscar' | 'nao_quer_mais' | 'marcar_nao_encontrada' | 'cancelar' | 'reabrir'`
  - `type MatchDecisao = 'confirmar' | 'nao_compativel'`
  - `type VisitaStatus = 'agendada' | 'confirmada' | 'compareceu' | 'nao_compareceu' | 'reagendada' | 'cancelada'`
  - `calcularSituacaoCliente(entrada, agora): SituacaoCliente`
  - `ordenarPendencias(a, b, agora): number`
  - `podeTransicionarPedido(de, para): boolean`
  - `pedidoStatusCopy`, `pedidoAcaoCopy` e `situacaoCopy`, sem expor códigos internos na interface.

- [ ] **Step 1:** escrever testes tabelados para todas as transições aceitas e rejeitadas.
- [ ] **Step 2:** escrever a matriz completa de prioridade: visita atrasada/hoje, promessa vencida, reserva aguardando retirada/vencendo, peça disponível/aguardando resposta, busca antiga, pedido novo e sem pendências; incluir múltiplos pedidos e empate pela data mais antiga.
- [ ] **Step 3:** executar `npx vitest run src/features/clientes/operacaoModel.test.ts` e confirmar falha por módulos ausentes.
- [ ] **Step 4:** implementar tipos e funções puras; situação deve retornar `{ codigo, rotulo, nivel, proximaAcaoEm }` e nunca consultar relógio global fora do parâmetro `agora`.
- [ ] **Step 5:** testar os rótulos cotidianos aprovados e garantir que `em_busca`, `peca_disponivel`, `match`, `Demandas abertas` e `Peças encontradas` não apareçam como copy visível.
- [ ] **Step 6:** executar novamente os testes e `npm run lint`.

**Matriz de transição que os testes devem fixar:**

| Origem | Ação/evidência | Destino persistido | Regra |
| --- | --- | --- | --- |
| criação | registrar | `nova` | responsável obrigatório; não cria venda/reserva |
| `nova` | `iniciar_busca` | `em_busca` | evento obrigatório |
| `nova`/`em_busca` | confirmar match específico | `peca_disponivel` | nunca reservar automaticamente |
| `peca_disponivel` | rejeitar/desfazer último match confirmado | `em_busca` | manter auditoria do match |
| `peca_disponivel` | `cliente_avisado` | `aguardando_cliente` | registra horário manual do aviso |
| `aguardando_cliente` | `aguardando_resposta` | `aguardando_cliente` | `proxima_acao_em = aviso + 48 h` |
| `peca_disponivel`/`aguardando_cliente` | `cliente_desistiu`/`nao_quer_mais` | `cliente_desistiu` | terminal, com motivo/evento |
| `nova`/`em_busca` | `marcar_nao_encontrada` | `nao_encontrada` | terminal, com motivo/evento |
| qualquer ativo | `cancelar` | `cancelada` | terminal, com motivo/evento |
| `nao_encontrada`/`cliente_desistiu`/`cancelada` | `reabrir` | `em_busca` | explícito e auditado |
| pedido ligado a reserva ativa | evidência derivada | situação `reservada` | status persistido não é duplicado |
| pedido ligado a visita futura ativa | evidência derivada | situação `visita_agendada` | prioridade sobre reserva quando aplicável |
| pedido ligado a venda concluída não cancelada | venda real vinculada | `vendida` | nunca por ação manual sem `venda_id` |

`vendida` e o terminal legado `atendida` não reabrem; uma nova procura cria outro pedido. Atualização de estado/campos temporais e inserção em `pecas_procuradas_eventos` ocorrem na mesma RPC transacional.

## CHECKPOINT A — sequência e autorização de banco

Antes da Task 3: confirmar a última migration existente e a sequência disponível. Criar os arquivos SQL é permitido pelo plano; antes de aplicar cada migration, revisar o arquivo já escrito, confirmar a sequência do ambiente alvo e obter autorização explícita. Nunca executar SQL em Supabase real apenas porque o plano foi aprovado.

## Release 1 — Base de Clientes e Registrar pedido

### Task 3: Migration 072 — contatos, endereço, moto principal e pedidos

**Files:**
- Create: `supabase/migration_072_clientes_operacao_base.sql`
- Create/extend: `docs/validacao-clientes-operacao-072-075.sql`

**Interfaces:**
- Produces columns:
  - `clientes.instagram_usuario`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`.
  - `clientes_motos.principal boolean`, `modelo_texto` with unique partial index for the principal motorcycle per client.
  - `pecas_procuradas.cliente_moto_id`, `moto_modelo_texto`, `ano_compatibilidade`, `observacoes`, `responsavel_id`, `prometido_para`, `ultima_acao`, `ultima_acao_em`, `proxima_acao_em`, `encerrada_em`, `atualizado_em`, `idempotency_key`, `venda_id`.
- Produces tables/functions:
  - `clientes_eventos` append-only para correção administrativa de origem e mudanças cadastrais sensíveis.
  - `pecas_procuradas_eventos` append-only.
  - `registrar_cliente_com_pedido(p_cliente jsonb, p_pedido jsonb, p_usuario_id uuid) returns jsonb`.
  - `definir_moto_principal(p_cliente_id uuid, p_moto_id uuid) returns clientes_motos`.
  - `transicionar_pedido_busca(...)`, `registrar_acao_pedido(...)` e `corrigir_origem_cliente(...)`, cada uma atualizando registro e evento na mesma transação.

- [ ] **Step 1:** escrever uma migration de expansão, sem remover valores antigos: ampliar checks de `origem`, `preferencia_contato` e `pecas_procuradas.status`; aceitar as seis origens aprovadas na UI e preservar `redes_sociais`, `outro`, `aguardando`, `atendida` e `cancelada` para o código legado.
- [ ] **Step 2:** produzir consulta de perfil com contagens e amostras de `aguardando`, `atendida` e `cancelada`; não reescrever status históricos nesta entrega e nunca inferir que `atendida` significa peça apenas encontrada. O domínio novo trata `aguardando` como busca legada ativa e `atendida` como terminal `Atendido anteriormente`.
- [ ] **Step 3:** backfill somente `responsavel_id = criado_por` e snapshots textuais quando a origem for inequívoca; novos endpoints escrevem estados novos apenas depois de API/UI dual-read estarem implantadas.
- [ ] **Step 4:** adicionar `modelo_texto`/`moto_modelo_texto` para nomes ausentes do catálogo. Para novos registros, exigir `modelo_moto_id` ou texto livre; preservar legado vazio com constraint `NOT VALID` ou validação de aplicação. Para clientes com motos existentes, marcar deterministicamente a mais antiga como principal antes de criar o índice parcial.
- [ ] **Step 5:** criar índices não únicos para telefone e `lower(instagram_usuario)`, índices de pedidos ativos por responsável/data e eventos por pedido; criar unicidade de `idempotency_key` no escopo do criador sem impedir contatos familiares compartilhados.
- [ ] **Step 6:** implementar as RPCs atômicas de criação/transição/ação/origem; a criação aceita uma chave de idempotência gerada pelo cliente e retorna o mesmo `{ cliente, pedido }` em repetição/reload, sem duplicar registros.
- [ ] **Step 7:** registrar em `clientes_eventos`, sem copiar contato bruto, as decisões `duplicidade_sugerida`, `duplicidade_reutilizada` e `duplicidade_confirmada_separada` para permitir medir revisão/bloqueio.
- [ ] **Step 8:** adicionar ao roteiro SQL casos de rollback, repetição idempotente, contato compartilhado, moto por FK/texto, uma moto principal, estados legados preservados e falha do pedido sem cliente órfão.
- [ ] **Step 9:** validar RLS/revokes das tabelas e `search_path`/revoke/grant das RPCs, inclusive tentativa negada para `anon`/`authenticated` e execução por `service_role`.
- [ ] **Step 10:** rodar somente análise local: `git diff --check -- supabase/migration_072_clientes_operacao_base.sql docs/validacao-clientes-operacao-072-075.sql`; não executar no banco.

### Task 4: Validação e API operacional de clientes

**Files:**
- Create: `src/server/routes/clientes/clientesValidacao.ts`
- Test: `src/server/routes/clientes/clientesValidacao.test.ts`
- Create: `src/server/routes/clientes/clientesOperacao.ts`
- Test: `src/server/routes/clientes/clientesOperacao.test.ts`
- Modify: `src/server/routes/clientes.ts`
- Modify: `src/constants/permissoes.ts`
- Modify test: `src/constants/permissoes.test.ts`

**Interfaces:**
- Consumes: RPC `registrar_cliente_com_pedido`, `clientes.editar`, `clientes.criar`.
- Produces endpoints:
  - `GET /api/clientes/operacao/resumo`
  - `GET /api/clientes/operacao/clientes?cursor&limit&...`
  - `GET /api/clientes/operacao/clientes/:clienteId`
  - `POST /api/clientes/operacao/duplicidades`
  - `POST /api/clientes/operacao/clientes`
  - `PATCH /api/clientes/operacao/clientes/:clienteId`
  - `POST /api/clientes/operacao/pedidos`
  - `PATCH /api/clientes/operacao/pedidos/:pedidoId/status`
  - `POST /api/clientes/operacao/pedidos/:pedidoId/acao`
  - `PATCH /api/clientes/operacao/clientes/:clienteId/moto-principal`
- Produces normalizers: `normalizarInstagram`, `validarContatoObrigatorio`, `validarPedidoInput`.

- [ ] **Step 1:** testar telefone vazio + Instagram válido, telefone válido + Instagram vazio, ambos vazios, preferência WhatsApp sem telefone, preferência Instagram sem handle, `@` duplicado em caixa diferente e origem inválida.
- [ ] **Step 2:** testar `POST /duplicidades` com telefone em formatos diferentes, Instagram com/sem `@` e nome aproximado; retornar candidatos sem criar/unir registros e sem colocar contatos na URL/log.
- [ ] **Step 3:** testar criação com cliente existente e criação atômica de cliente novo; simular falha da RPC e confirmar resposta sem sucesso parcial.
- [ ] **Step 4:** testar criação standalone pelo CTA `Novo cliente` e edição guiada. Criação exige nome, contato, cidade, UF e origem; edição valida o registro resultante e lista precisamente mínimos ausentes, sem exigir moto como campo obrigatório.
- [ ] **Step 5:** testar que `/resumo` retorna projeção agregada e `capabilities` em quantidade fixa de consultas, sem buscar ficha completa individualmente. Módulos futuros ausentes retornam capability `false` e coleção vazia somente para sua própria release; erro inesperado nunca é mascarado.
- [ ] **Step 6:** testar paginação por cursor/limite, filtros no servidor e payload resumido da lista; nenhum endereço residencial completo integra resumo, mapa ou logs.
- [ ] **Step 7:** testar transição inválida e autorização; status encerrado deve preencher `encerrada_em` e evento na mesma RPC. Cobrir `Cliente avisado`, `Cliente desistiu`, `Aguardando resposta`, `Vai buscar` e `Não quer mais`, sem considerar a mera abertura de link externo como aviso. `Não é compatível` rejeita um match específico e fica para a Task 14.
- [ ] **Step 8:** implementar validação sem `any` no contrato externo e montar subrouter antes de `router.get('/:id')`; rotas de estado/origem chamam somente as RPCs transacionais, sem update+insert separados.
- [ ] **Step 9:** testar e implementar `definir_moto_principal`; trocar a principal usa lock/transação, confirma que a moto pertence ao cliente e mantém exatamente uma principal.
- [ ] **Step 10:** adicionar `clientes.administrar` ao catálogo granular. `clientes.editar` continua cobrindo dados, motos, notas e pedidos; `clientes.administrar` protege no backend origem histórica, `ativo`, `banido` e sinônimos globais por `temPermissao`/`exigirPermissao`, com admin preservado como superusuário.
- [ ] **Step 11:** atualizar CRUD legado para aceitar os campos novos sem tornar registros antigos inválidos; separar os campos administrativos de `CAMPOS_EDITAVEIS` para que o payload comum não contorne o gate.
- [ ] **Step 12:** testar permitido/negado para bloquear, desbloquear, desativar, reativar, corrigir origem e administrar sinônimos; correção de origem gera evento/auditoria no histórico.
- [ ] **Step 13:** registrar uma linha de base dos indicadores de sucesso: pendências por classe/idade, respostas >48 h, reservas sem decisão, visitas vencidas e decisões de duplicidade; não usar volume vendido como proxy.
- [ ] **Step 14:** executar `npx vitest run src/server/routes/clientes/clientesValidacao.test.ts src/server/routes/clientes/clientesOperacao.test.ts src/constants/permissoes.test.ts` e `npm run lint`.

### Task 5: Tipos, API e helpers de contato

**Files:**
- Modify: `src/features/clientes/types.ts`
- Modify: `src/features/clientes/api.ts`
- Modify: `src/features/clientes/ClientesView.tsx`
- Modify: `src/features/clientes/ClienteDetalheModal.tsx`
- Modify: `src/features/clientes/metricas.ts`
- Modify tests: `src/features/clientes/ClienteDetalheModal.test.tsx`, `src/features/clientes/metricas.test.ts`
- Create: `src/utils/instagram.ts`
- Test: `src/utils/instagram.test.ts`

**Interfaces:**
- Produces `linkInstagram(handle): string | null` and `normalizarInstagram(handle): string`.
- Produces `clientesApi.resumoOperacional`, `listarOperacao`, `buscarOperacao`, `buscarDuplicidades`, `criarCliente`, `editarCliente`, `registrarPedido`, `transicionarPedido`, `agirSobrePedido` e `definirMotoPrincipal`, reutilizando `operacaoTypes.ts`.

- [ ] **Step 1:** testar `@Loja.Moto`, espaços, URL completa, vazio e caracteres inválidos.
- [ ] **Step 2:** implementar helper retornando `https://www.instagram.com/<handle>/` somente para handle válido.
- [ ] **Step 3:** atualizar unions preservando valores legados de origem/preferência/status e adicionar moto por FK ou texto livre.
- [ ] **Step 4:** atualizar no mesmo passo todos os `Record<PecaProcuradaStatus, ...>` e adaptadores exaustivos da UI legada para aceitar estados antigos e novos sem quebrar lint/build entre releases.
- [ ] **Step 5:** tipar respostas, paginação e `capabilities` da API sem duplicar interfaces de `operacaoTypes.ts`.
- [ ] **Step 6:** executar `npx vitest run src/utils/instagram.test.ts src/features/clientes` e `npm run lint`.

### Task 6: Extrair drawer operacional compartilhado

**Files:**
- Create: `src/components/ui/operationalTokens.ts`
- Create: `src/components/ui/OperationalDrawer.tsx`
- Test: `src/components/ui/OperationalDrawer.test.tsx`
- Modify: `src/features/estoque-preview/InventoryDrawer.tsx`
- Verify consumer: `src/features/vendas-preview/VendasPreview.tsx`

**Interfaces:**
- Produces `operationalLightTokens`, `OperationalTokensContext` and compatibility re-exports `lightInventoryTokens`/`InventoryTokensContext` from `InventoryDrawer.tsx`.
- Produces `<OperationalDrawer open onOpenChange title description size="default|wide" footer portalStyle?>`.
- `wide` usa largura máxima de `760px`; conteúdo rola e footer permanece fora da área rolável.
- `InventoryDrawer` preserva props e exports atuais como wrapper `size="default"`; Vendas continua compilando sem alteração visual.

- [ ] **Step 1:** testar Escape, overlay, body scroll-lock, retorno de foco, `aria-describedby`, `h-[100dvh]`, footer fixo, conteúdo com `overflow-y-auto` e aplicação de tokens no portal.
- [ ] **Step 2:** extrair os valores existentes sem alterá-los; implementar com Radix Dialog, Motion e `useReducedMotion` usando tokens semânticos compartilhados.
- [ ] **Step 3:** converter `InventoryDrawer` em wrapper sem alterar seus consumidores ou remover exports usados por Vendas.
- [ ] **Step 4:** executar `npx vitest run src/components/ui/OperationalDrawer.test.tsx src/features/estoque-preview src/features/vendas-preview` e `npm run build`.

## CHECKPOINT VISUAL — calibração antes da nova composição

Antes das Tasks 7–10, abrir a aplicação nova em `http://127.0.0.1:3001/` e comparar Vendas, Estoque e Tarefas em desktop e 375 px. Iniciar `docs/validacao-clientes-gerenciamento-integrado.md` com uma matriz dos valores reais observados: shell/max-width, paddings, títulos, eyebrow mono, raios, bordas, sombras, altura de controles, abas, ação preenchida, densidade de linha e espaçamento vertical. Não usar a porta 4173 nem uma captura do sistema legado como referência.

### Task 7: Drawer Registrar pedido e cadastro de contato alternativo

**Files:**
- Create: `src/features/clientes/components/RegistrarPedidoDrawer.tsx`
- Test: `src/features/clientes/components/RegistrarPedidoDrawer.test.tsx`
- Create: `src/features/clientes/components/ClienteFormDrawer.tsx`
- Test: `src/features/clientes/components/ClienteFormDrawer.test.tsx`
- Modify: `src/features/clientes/ClienteFormModal.tsx` only to reuse field helpers if necessary.

**Interfaces:**
- Consumes: `OperationalDrawer`, `PreviewTabs`, `CepInput`, `StateCitySelect`, `clientesApi.registrarPedido`.
- `ClienteFormDrawer` supports `mode="create|edit|inline-order"`; standalone create/edit returns `onSaved({ clienteId })` and inline order returns `onSaved({ clienteId, pedidoId })`.

- [ ] **Step 1:** testar Tabs por teclado e validação condicional: WhatsApp exige telefone; Instagram exige handle.
- [ ] **Step 2:** ao iniciar pela tab Instagram, sugerir origem Instagram sem salvar automaticamente; troca de tab não sobrescreve uma origem já confirmada.
- [ ] **Step 3:** testar preflight de duplicidade por nome/WhatsApp/Instagram, escolha do existente e confirmação explícita `confirmar_contato_compartilhado` para cadastro separado; nenhum índice único bloqueia familiares.
- [ ] **Step 4:** testar ViaCEP bem-sucedido e falha mantendo cidade manual.
- [ ] **Step 5:** testar persistência de CEP, logradouro, número, complemento e bairro opcionais; cidade/UF continuam obrigatórias e nunca são apagadas quando o ViaCEP falha.
- [ ] **Step 6:** testar criação/vínculo de moto por catálogo ou `modelo_texto`, snapshot textual no pedido, seleção da moto principal, ano opcional e categoria opcional.
- [ ] **Step 7:** testar etapa 2 com descrição/responsável obrigatórios. Quando `Data combinada` estiver desmarcada, prazo é opcional; quando marcada, a data prometida é obrigatória.
- [ ] **Step 8:** testar que confirmar cria somente cliente+pedido em estado `nova`, nunca venda/reserva, e o novo item aparece no Painel após um refresh único.
- [ ] **Step 9:** implementar as duas etapas com um `<form>`, erro persistente e footer fixo `Cancelar` / `Registrar pedido`; bloquear duplo submit e reutilizar a mesma chave de idempotência em retry.
- [ ] **Step 10:** associar labels, `aria-invalid` e `aria-describedby`; em erro de submissão, preservar valores, mover o foco para o primeiro campo inválido e anunciar o resumo com `role="alert"`; sucesso usa `role="status"` não intrusivo.
- [ ] **Step 11:** exigir dados mínimos ao editar ou registrar pedido para cliente legado incompleto, indicando nominalmente contato, cidade, UF ou origem ausente sem bloquear sua consulta; ausência de moto mantém o selo, mas não impede salvar.
- [ ] **Step 12:** testar os modos create/edit/inline-order e 375 px via `window.innerWidth`/classes; executar `npm run lint`.

## Release 2 — Shell, lista e drawer do cliente

### Task 8: Compor Painel e indicadores

**Files:**
- Create: `src/features/clientes/useClientesOperacao.ts`
- Create: `src/features/clientes/components/ClientesHeader.tsx`
- Create: `src/features/clientes/components/ClientesMetricStrip.tsx`
- Create: `src/features/clientes/components/ClientesPainel.tsx`
- Test: `src/features/clientes/components/ClientesPainel.test.tsx`
- Modify: `src/features/clientes/ClientesView.tsx`

**Interfaces:**
- Consumes: `calcularSituacaoCliente`, `ordenarPendencias`, `clientesApi.resumoOperacional`.
- Produces tabs `painel|todos|agenda`, refresh único, CTA principal `Registrar pedido` e ação secundária `Novo cliente`.

- [ ] **Step 1:** testar os rótulos `Pedidos em busca`, `Peças disponíveis`, `Próximas visitas` e `Reservas vencendo`, a ordem das seis classes de pendência e cada indicador abrindo o filtro correspondente.
- [ ] **Step 2:** testar `Registrar pedido` como única ação preenchida do cabeçalho e `Novo cliente` como secundária; cada CTA abre o modo correto do drawer e respeita `clientes.criar`.
- [ ] **Step 3:** testar loading, erro com retry, vazio e refresh preservando aba/filtros; mudanças de estado relevantes usam `aria-live` sem anunciar a página inteira.
- [ ] **Step 4:** implementar shell com `operationalLightTokens` no root da feature e `OperationalTokensContext` para portais, reutilizando classes observadas em Vendas, Estoque e Tarefas; não copiar tema legado.
- [ ] **Step 5:** manter props de deep-link atuais (`pendingClienteId`, `pendingFiltroSumidos`).
- [ ] **Step 6:** executar teste focal, `npm run lint` e inspeção visual inicial abrindo `http://127.0.0.1:3001/` e selecionando a aba Clientes.

### Task 9: Lista completa e filtros

**Files:**
- Create: `src/features/clientes/components/ClientesLista.tsx`
- Test: `src/features/clientes/components/ClientesLista.test.tsx`
- Modify: `src/features/clientes/ClientesView.tsx`
- Preserve: `src/features/clientes/metricas.ts`

**Interfaces:**
- Consumes: métricas existentes, situação calculada, busca por nome/telefone/Instagram/moto/cidade.
- Produces filtros `situacao`, `origem`, `cidade`, `responsavel`, `cadastroIncompleto`, `ultimaCompra`, `semPendencias`.

- [ ] **Step 1:** testar busca com acento, telefone formatado, `@`, moto e cidade.
- [ ] **Step 2:** testar que somente a situação mais urgente aparece na linha e todas continuam no view-model.
- [ ] **Step 3:** testar chips removíveis, `Limpar filtros` e vazio filtrado.
- [ ] **Step 4:** testar selo/filtro `Cadastro incompleto` para ausência de contato, cidade/UF, origem ou moto; moto ausente sinaliza, mas não vira mínimo obrigatório de criação.
- [ ] **Step 5:** testar as colunas desktop cliente/contato, cidade, moto principal, situação, última compra, total comprado, próxima ação e ações rápidas; no bloco mobile, situação e próxima ação permanecem visíveis.
- [ ] **Step 6:** testar ações rápidas da linha: abrir canal preferido, registrar pedido e agendar visita; abrir contato externo não registra `cliente_avisado`.
- [ ] **Step 7:** implementar tabela desktop e bloco mobile sem esconder próxima ação; não aninhar botões dentro de outro botão/link. A abertura da linha e cada ação rápida têm alvos de foco independentes e rótulos acessíveis.
- [ ] **Step 8:** preservar cálculos de compras e exclusão de vendas canceladas já cobertos em `metricas.test.ts`.
- [ ] **Step 9:** executar `npx vitest run src/features/clientes/components/ClientesLista.test.tsx src/features/clientes/metricas.test.ts`.

### Task 10: Drawer do cliente com ações fixas

**Files:**
- Create: `src/features/clientes/components/ClienteDrawer.tsx`
- Test: `src/features/clientes/components/ClienteDrawer.test.tsx`
- Modify: `src/features/clientes/ClientesView.tsx`
- Preserve until parity: `src/features/clientes/ClienteDetalheModal.tsx`

**Interfaces:**
- Consumes: `clientesApi.buscar`, `buscarOperacao`, métricas, tarefas/reservas reais.
- Produces callbacks `onRegistrarPedido`, `onAgendarVisita`, `onEdit`, `onAdminAction`.

- [ ] **Step 1:** testar ordem das seções, ausência de seções vazias e hierarquia semântica de título/headings/landmarks no drawer.
- [ ] **Step 2:** testar WhatsApp/Instagram preferido e canal secundário.
- [ ] **Step 3:** testar adição do segundo canal depois do cadastro e troca explícita do canal preferido.
- [ ] **Step 4:** testar footer fora do scroll, safe-area e apenas uma ação preenchida; ação indisponível permanece explicada por texto/tooltip acessível em vez de simplesmente desaparecer quando isso ajuda a próxima etapa.
- [ ] **Step 5:** testar que bloqueio/desativação/origem não aparecem sem permissão administrativa.
- [ ] **Step 6:** testar ações operacionais de peça disponível: `Cliente avisado`, `Não é compatível` e `Cliente desistiu`; após aviso, exibir `Aguardando resposta`, `Vai buscar` e `Não quer mais`. `Não é compatível` chama a rejeição do match; `Vai buscar` abre o próximo passo de agendar visita e, quando houver unidade confirmada, oferecer a reserva real.
- [ ] **Step 7:** testar adicionar moto e alterar moto principal sem duplicar o veículo; correção de origem aparece somente para administrador.
- [ ] **Step 8:** implementar drawer largo; manter histórico, notas, motos e comprovantes existentes.
- [ ] **Step 9:** comparar paridade com `ClienteDetalheModal`; só então removê-lo do render da rota nova.

## Release 3 — Visitas como Tarefas

### Task 11: Migration 073 e API de visitas

**Files:**
- Create: `supabase/migration_073_clientes_visitas.sql`
- Create: `src/server/routes/clientes/clientesVisitas.ts`
- Test: `src/server/routes/clientes/clientesVisitas.test.ts`
- Modify: `src/server/routes/clientes.ts`
- Modify: `src/server/routes/tarefas.ts`
- Create test: `src/server/routes/tarefas.visitas.test.ts`
- Modify: `src/features/tarefas/types.ts`, `api.ts`.

**Interfaces:**
- Mantém `tarefas.prazo timestamptz` como única fonte canônica de data/hora e adiciona somente `visita_tem_horario boolean` e `visita_status text`.
- Creates `tarefa_pecas_procuradas(tarefa_id, pedido_id)` and `tarefa_visita_eventos`.
- Creates RPCs `registrar_visita_cliente(...)`, `transicionar_visita(...)` and `reagendar_visita(...)` so task, links and event change atomically.
- Endpoints: `GET/POST /api/clientes/operacao/visitas`, `PATCH /visitas/:id/status`, `PATCH /visitas/:id/reagendar`.

- [ ] **Step 1:** migration mantém `prazo` intacto; visitas legadas com prazo recebem `visita_status='agendada'` e `visita_tem_horario=false` por segurança, e visitas sem prazo ficam consultáveis como `Data não informada`, sem inventar data.
- [ ] **Step 2:** novos endpoints exigem prazo; data sem horário é persistida como 12:00 em `America/Sao_Paulo` + `visita_tem_horario=false`, enquanto horário informado preserva o instante + `true`. Tarefas genéricas permanecem inalteradas.
- [ ] **Step 3:** validar RLS/revokes da nova tabela e `search_path`/grants das funções auxiliares.
- [ ] **Step 4:** fixar matriz: `agendada|confirmada|reagendada` ↔ tarefa `pendente`/`concluida_em=null`; `compareceu|nao_compareceu|cancelada` ↔ tarefa `concluida`/`concluida_em` preenchido. Reabrir uma visita finalizada volta a `agendada` somente por ação explícita e evento.
- [ ] **Step 5:** testar tarefa comum invisível na Agenda, responsável padrão herdado do pedido com troca permitida, autorização, múltiplos pedidos vinculados e histórico.
- [ ] **Step 6:** testar reagendamento mantendo o mesmo `tarefas.id`, registrando evento, atualizando `prazo` e invalidando lembretes derivados antigos.
- [ ] **Step 7:** testar que conclusão/reabertura pela rota de Tarefas respeita a matriz de visita e não deixa `tarefas.status` divergente de `visita_status`.
- [ ] **Step 8:** implementar rotas usando `clientes.editar` mais permissões existentes de Tarefas via `exigirAlguma`; criação/transição/reagendamento chamam RPC única, nunca writes separados no frontend/API.
- [ ] **Step 9:** add SQL validation cases and run `clientesVisitas`, `tarefas.visitas` and existing task tests/lint.

### Task 12: Agenda e visita no drawer

**Files:**
- Create: `src/features/clientes/components/ClientesAgenda.tsx`
- Test: `src/features/clientes/components/ClientesAgenda.test.tsx`
- Modify: `src/features/clientes/components/ClienteDrawer.tsx`
- Modify: `src/features/tarefas/TarefaCards.tsx` and visit detail rendering only.

**Interfaces:**
- Consumes visit endpoints and shared `Tarefa` identity.
- Produces day/week selection, filters and actions `Confirmar`, `Reagendar`, `Compareceu`, `Não compareceu`, `Cancelar`.

- [ ] **Step 1:** testar atrasadas primeiro, lista cronológica, `Hoje` acessível, data sem horário, data com horário e timezone `America/Sao_Paulo`.
- [ ] **Step 2:** test actions update Agenda, Cliente drawer and Tarefas after one refresh.
- [ ] **Step 3:** testar filtros por responsável, situação e cidade; cada item mostra horário, cliente, peça, moto, responsável e reserva vinculada.
- [ ] **Step 4:** testar que selecionar uma visita abre o drawer do cliente focado no mesmo `tarefa.id`.
- [ ] **Step 5:** implementar faixa horizontal de datas no celular, alternância `Dia`/`Semana` e calendário mensal somente como seletor de data.
- [ ] **Step 6:** add accessible labels and focus return from reschedule dialog.
- [ ] **Step 7:** execute component tests and existing `src/features/tarefas` tests.

## Release 4 — Correspondência assistida e sino

### Task 13: Migration 074 — matches e sinônimos auditáveis

**Files:**
- Create: `supabase/migration_074_clientes_matching.sql`
- Extend: `docs/validacao-clientes-operacao-072-075.sql`

**Interfaces:**
- Creates `pecas_procuradas_matches(id, pedido_id, estoque_id, status, pontuacao, motivos jsonb, criado_em, decidido_em, decidido_por)` with unique `(pedido_id, estoque_id)`.
- Creates `pecas_sinonimos(id, termo, termo_normalizado, nome_canonico, status, sugerido_por, aprovado_por, criado_em, atualizado_em)`.

- [ ] **Step 1:** add checks `match.status in ('pendente','confirmado','rejeitado','encerrado')` and synonym status `sugerido|aprovado|rejeitado`.
- [ ] **Step 2:** add indexes for pending matches by request age and unique approved synonym lookup on normalized term; correction/removal uses a new row or status `rejeitado`, never hard-delete of audit history.
- [ ] **Step 3:** criar índice de busca compatível com pedidos `aguardando`, `nova` e `em_busca`; só remover o índice parcial antigo depois de confirmar que a consulta nova está implantada.
- [ ] **Step 4:** validar RLS/revokes das tabelas e `search_path`/grants de qualquer função criada.
- [ ] **Step 5:** add validation SQL proving duplicate suggestion is idempotent and rejected synonym is not used.
- [ ] **Step 6:** run `git diff --check`; do not apply.

### Task 14: Serviço de matching e substituição do auto-fechamento

**Files:**
- Create: `src/services/clientesMatchingService.ts`
- Test: `src/services/clientesMatchingService.test.ts`
- Create: `src/server/routes/clientes/clientesMatching.ts`
- Test: `src/server/routes/clientes/clientesMatching.test.ts`
- Modify: `src/server/routes/estoque.ts`
- Modify: `src/server/routes/estoqueOrganizacao.ts`

**Interfaces:**
- Produces `sugerirMatchesParaEstoque(supabase, estoqueId, autorId): Promise<number>`.
- Endpoints: `GET /matches`, `PATCH /matches/:id/confirmar`, `PATCH /matches/:id/rejeitar`, `PATCH /matches/:id/desfazer`, CRUD de sinônimos protegido por `clientes.administrar`.

- [ ] **Step 1:** inverter o teste de caracterização da Task 1 para esperar pedido inalterado + sugestão; executar apenas esse teste e confirmar a falha antes de implementar.
- [ ] **Step 2:** testar normalização de acentos/plural simples, sinônimo aprovado, moto por FK ou `modelo_texto`, categoria+moto e ano incompatível. Ano simples/faixa de quatro dígitos vira intervalo inclusivo; ausência é neutra; texto não analisável aparece como `ano_inconclusivo` e não aumenta a pontuação.
- [ ] **Step 3:** testar idempotência quando item e unidade disparam o serviço para o mesmo pedido e dual-read de pedidos ativos `aguardando|nova|em_busca`.
- [ ] **Step 4:** testar que sugestão mantém pedido `em_busca`; confirmação muda para `peca_disponivel`; rejeição mantém busca; nenhum desses passos cria linha em `estoque_reservas`.
- [ ] **Step 5:** testar ordenação de todos os matches pelo pedido mais antigo e destaque de promessa/visita próxima, sem usar total comprado como desempate.
- [ ] **Step 6:** implementar motivos explicáveis como `['modelo_exato','categoria','termo:aranha→suporte do farol']`.
- [ ] **Step 7:** testar regras quando categoria ou moto estiver ausente: descrição normalizada continua obrigatória; todo critério estruturado presente nos dois lados deve ser compatível e critérios ausentes nunca viram “match exato”.
- [ ] **Step 8:** testar desfazer confirmação: match volta a rejeitado/desfeito com evento; pedido retorna a `em_busca` somente se não houver outro match confirmado, reserva real ou venda vinculada.
- [ ] **Step 9:** ao confirmar uma correspondência, criar apenas uma sugestão de sinônimo auditável; atendente não aprova regra global. Testar aprovação/correção/remoção global por `clientes.administrar` e preservação de históricos encerrados.
- [ ] **Step 10:** substituir `casarComPecasProcuradas`; remover atualização automática e criação automática de tarefa.
- [ ] **Step 11:** chamar serviço após criar item e após adicionar unidade a item sem disponibilidade anterior; falha é registrada sem derrubar estoque.
- [ ] **Step 12:** executar testes de matching e `src/server/routes/estoque.test.ts` até o baseline novo passar; não encerrar a tarefa com teste vermelho.

### Task 15: Notificações operacionais unificadas

**Files:**
- Create: `src/features/notificacoes/operationalNotificationsModel.ts`
- Test: `src/features/notificacoes/operationalNotificationsModel.test.ts`
- Create: `src/features/notificacoes/OperationalNotificationBell.tsx`
- Test: `src/features/notificacoes/OperationalNotificationBell.test.tsx`
- Modify: `src/features/notificacoes/TaskNotificationBell.tsx`
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`
- Modify: `src/features/clientes/components/ClientesHeader.tsx`
- Modify: `src/server/routes/clientes/clientesOperacao.ts`
- Modify test: `src/server/routes/clientes/clientesOperacao.test.ts`

**Interfaces:**
- Consumes task notifications plus `GET /api/clientes/operacao/notificacoes`, filtered on the server from `req.usuario`; never accepts a trusted `usuarioId` from the browser.
- Produces `NotificationTarget = { tab:'tarefas'; taskId } | { tab:'clientes'; clienteId; focus:{ kind:'pedido'|'match'|'visita'|'reserva'; id } }`.
- Produces notification union `{ id, kind: 'task'|'match'|'visit'|'reservation'|'reply', title, detail, urgency, responsavelId, target }`.

- [ ] **Step 1:** testar limites: visita um dia antes, uma hora antes somente com horário e atraso; visita com horário não recebe lembrete adicional no início do dia; conclusão/cancelamento/reagendamento removem lembretes antigos; `aguardando_resposta` volta à fila após 48 h contadas do evento `cliente_avisado`.
- [ ] **Step 2:** testar que atendente recebe somente alertas sob sua responsabilidade; visão ampla exige permissão já existente adequada ou `clientes.administrar`, e nunca é liberada por parâmetro do frontend.
- [ ] **Step 3:** testar dedupe pela identidade canônica do alvo, de modo que a mesma `tarefas.id` não apareça como `task` e `visit`; preferir o aviso operacional enriquecido, ordenar por urgência/data e tolerar erro de uma fonte sem esconder a outra.
- [ ] **Step 4:** implement bell with tabs `Pendentes`/`Visualizadas` only for tasks; operational alerts disappear by resolving condition, not arbitrary read.
- [ ] **Step 5:** preserve `TaskNotificationBell` as wrapper during consumer migration, then remove only after all imports change.
- [ ] **Step 6:** execute notification, Tarefas, Clientes route and Estoque tests.

## CHECKPOINT B — regra transversal de reserva

Antes da Task 16: reconfirmar as decisões registradas no Gate 0; confirmar no ambiente alvo que migrations 067–070, especialmente 068, estão aplicadas; inventariar assinaturas reais das RPCs. `decisao_pendente` bloqueia até ação explícita quando há visita futura. Qualquer consumo de reserva dentro de `registrar_venda` exige revisão focada da atomicidade por Estoque/Vendas/Caixa e autorização de banco.

## Release 5 — Reserva real integrada

### Task 16: Migration 075 e política global de reserva

**Files:**
- Create: `supabase/migration_075_clientes_reservas_politica.sql`
- Modify: `src/server/routes/estoqueOrganizacao.ts`
- Test: `src/server/routes/estoqueOrganizacao.test.ts`
- Modify: `src/features/estoque-preview/inventoryPreviewModel.ts`
- Test: `src/features/estoque-preview/inventoryPreviewModel.test.ts`
- Modify: `src/features/estoque-preview/realInventoryAdapter.ts`
- Test: `src/features/estoque-preview/realInventoryAdapter.test.ts`
- Modify: `src/features/estoque-preview/InventoryUnitDrawer.tsx`
- Modify: `src/features/clientes/api.ts`
- Modify: `src/features/clientes/components/ClienteDrawer.tsx`
- Test: `src/features/clientes/components/ClienteDrawer.test.tsx`

**Interfaces:**
- Adds `estoque_reservas.pedido_id`, `visita_id`, `decisao_pendente_em`.
- RPC `reservar_unidade_estoque` usa dois dias quando prazo é omitido, limita novas reservas a cinco dias e aceita vínculos opcionais.
- RPC `processar_reservas_vencidas()` releases no-visit reservations and marks linked-future-visit reservations pending.
- API adds `renovar` and lists customer reservations from existing table.

- [ ] **Step 1:** antes de escrever SQL, inventariar com `rg` todos os predicados e RPCs que leem `estoque_reservas`, inclusive `registrar_venda`, exclusão, arquivamento e sincronização; registrar a lista no roteiro de validação.
- [ ] **Step 2:** confirmar no banco alvo a presença/assinatura de 067–070; parar se 068 ou outro pré-requisito estiver ausente. A migration deve usar `DROP FUNCTION` com a assinatura exata anterior para não criar overload ambíguo.
- [ ] **Step 3:** write tests for omitted, 1, 2, 5 and 6 days; omission resolves to 2 in UI, API and RPC, while 5 is enforced API+DB.
- [ ] **Step 4:** test existing reservation longer than five days remains readable and valid until its recorded expiry.
- [ ] **Step 5:** test no-visit expiry releases and records history; future visit expiry marks pending and still blocks sale/archive. A liberação automática cria alerta para `criada_por`/responsável operacional.
- [ ] **Step 6:** testar aviso de vencimento quando faltarem no máximo 24 horas, sem duplicar o alerta entre Clientes e Estoque.
- [ ] **Step 7:** atualizar `RESERVAS_BASE`, capability detection, adaptador real, `UnidadeEstoque`/`EstadoUnidade` e histórico para carregar `pedido_id`, `visita_id` e `decisao_pendente_em` sem tratar pendência como unidade disponível.
- [ ] **Step 8:** atualizar todos os predicados SQL que hoje tratam somente `reservada_ate > now()` como ativo para também considerar `decisao_pendente_em is not null`; qualquer ajuste autorizado em `registrar_venda` preserva a mesma RPC e atomicidade, sem janela liberar→vender.
- [ ] **Step 9:** invocar `processar_reservas_vencidas()` de forma idempotente nas leituras operacionais de reservas e antes das mutações de unidade/venda; não depender de cron ou plataforma externa.
- [ ] **Step 10:** preserve signal validation and payment form; do not decompose or replace financial RPCs.
- [ ] **Step 11:** expose renewal/release in Cliente drawer and Estoque drawer using the same API; renovação mantém máximo de cinco dias a partir da ação e registra evento.
- [ ] **Step 12:** validar RLS/revokes e segurança/atomicidade das RPCs alteradas, inclusive acesso exclusivo por `service_role`.
- [ ] **Step 13:** run inventory route/model tests, build and SQL validation in a non-production environment only after authorization.

## Release 6 — Mapa local do Brasil

### Task 17: Gerar e versionar dados geográficos oficiais

**Files:**
- Create: `scripts/gerar-mapa-clientes.mjs`
- Create: `src/features/clientes/mapa/brasil-estados.geo.json`
- Create: `src/features/clientes/mapa/municipios-centroides.json`
- Create: `src/features/clientes/mapa/README.md`
- Test: `src/features/clientes/mapa/mapaDados.test.ts`

**Interfaces:**
- Source: `https://servicodados.ibge.gov.br/api/v3/malhas/...` with GeoJSON and minimum quality.
- Produces state features and `{ uf, cidade, codigoIbge, latitude, longitude }` for municipalities.

- [ ] **Step 1:** o script busca explicitamente as malhas do país/estados com intrarregião municipal, valida HTTP/content type e calcula um ponto representativo determinístico a partir da malha oficial. O ponto deve pertencer ao polígono do município; usar centroide de área quando interno e fallback de ponto-na-superfície no maior polígono para geometrias côncavas/MultiPolygon.
- [ ] **Step 2:** add `--check` mode that compares generated content without writing and fails on missing/duplicate `UF|cidade`.
- [ ] **Step 3:** document source/licença, versão/data de obtenção, SIRGAS 2000, simplificação, tamanho bruto/final e comando de atualização; no runtime fetch.
- [ ] **Step 4:** test 27 UFs, every city from current `ibge-municipios.json`, coordinate bounds of Brazil and Juazeirinho/PB.
- [ ] **Step 5:** execute generator only with network approval; inspect generated size before accepting and record a size budget/baseline in the README. Keep assets compact enough for lazy loading.

### Task 18: Renderizar mapa e sincronizar filtros

**Files:**
- Create: `src/features/clientes/mapa/mapaModel.ts`
- Test: `src/features/clientes/mapa/mapaModel.test.ts`
- Create: `src/features/clientes/mapa/ClientesMapa.tsx`
- Test: `src/features/clientes/mapa/ClientesMapa.test.tsx`
- Modify: `src/features/clientes/components/ClientesPainel.tsx`
- Modify: `src/constants/loja.ts`

**Interfaces:**
- Produces `agruparClientesPorCidade(clientes, situacoes)` and projection lon/lat→SVG.
- Consumes shared filters and emits `onSelectCliente(clienteId)`.

- [ ] **Step 1:** test grouping, marker size, urgency color, accents and same city in different UFs; cidade sem coordenada mostra `Localização não encontrada` e nunca recebe coordenada aproximada incorreta.
- [ ] **Step 2:** implement SVG with state paths, markers as buttons, legend textual and store marker from `CEP_ORIGEM_LOJA` locality stored locally.
- [ ] **Step 3:** city click highlights the state discreetly and opens summary/list; keyboard Enter/Space works; cada marcador tem alvo mínimo 24×24 px, foco visível e nome acessível com cidade/UF, quantidade e urgência; paths estaduais são decorativos para leitor de tela; cor nunca é o único sinal e existe alternativa textual/lista equivalente. Após filtros, anunciar a quantidade visível; marcador da loja tem texto/ícone próprio. Não usar HTML inválido dentro do SVG. O payload/render usa somente cidade/UF/coordenada municipal, nunca endereço residencial.
- [ ] **Step 4:** lazy-load map assets after operational queue so dashboard remains responsive.
- [ ] **Step 5:** test 60/40 desktop, map below queue at 375 px, synchronized filters and no second confusing scroll; sticky desktop only when available height permits.

## Release 7 — Integração, deep-links e acabamento

### Task 19: Conectar deep-links no App com mudança mínima

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/clientes/ClientesView.tsx`
- Modify: `src/features/tarefas-preview/TasksPreview.tsx`
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Create test: `src/App.navigation.test.tsx`
- Create test: `src/features/clientes/ClientesView.navigation.test.tsx`

**Interfaces:**
- Notification target opens `clientes` + drawer/match/visit or `tarefas` + task inspector.

- [ ] **Step 1:** antes de editar, confirmar que nenhum outro agente está em `App.tsx` e revisar `git diff -- src/App.tsx`.
- [ ] **Step 2:** test task notification remains functional and customer notification switches tab once without stale pending id.
- [ ] **Step 3:** add only callback/state needed; do not refactor routing or navigation dock.
- [ ] **Step 4:** execute navigation tests and review the complete `App.tsx` diff.

### Task 20: Estados completos, acessibilidade e regressão visual

**Files:**
- Modify tests/components from Tasks 7–19 only.
- Create/extend: `docs/validacao-clientes-gerenciamento-integrado.md`.

**Interfaces:**
- Produces manual evidence checklist for desktop and 375 px.

- [ ] **Step 1:** cobrir loading/operação em andamento, vazio inicial, vazio filtrado, erro recuperável preservando estado, proibido, sucesso, conflito, ação desabilitada explicada, submit duplicado e retry idempotente.
- [ ] **Step 2:** keyboard pass: tabs, list rows, map markers, drawers, date strip, footer and focus return.
- [ ] **Step 3:** verificar contraste 4,5:1 para texto e 3:1 para foco/controles/gráficos; `text-faint` fica apenas em conteúdo decorativo, nunca em labels, contagens, datas ou instruções. Verificar alternativas textuais, status não dependente de cor e movimento reduzido.
- [ ] **Step 4:** em 375 px, verificar drawer em `100dvh`, body sem rolagem por trás, footer acima da safe-area, último campo/erro visível ao abrir o teclado virtual, alvos essenciais de 44 px, fila antes do mapa e ausência de scroll horizontal fora da faixa de indicadores/datas.
- [ ] **Step 5:** verificar que abrir Painel/Todos não dispara uma requisição de detalhe por cliente e que os ativos do mapa continuam em chunk lazy separado.
- [ ] **Step 6:** run affected tests, then `npm run lint`, `npm run build`, `npm test`.
- [ ] **Step 7:** executar validação no navegador da aplicação nova em `http://127.0.0.1:3001/`, selecionar a aba Clientes e cobrir Painel/Todos os clientes/Agenda; nunca usar a porta legada 4173.
- [ ] **Step 8:** compare Clientes side by side with Vendas, Estoque and Tarefas at desktop and 375 px; registrar screenshots das três visões e dos drawers Registrar pedido/Cliente, mais observações mensuráveis, não apenas “parece igual”.
- [ ] **Step 9:** run `git diff --check`, inspect `git status --short`, review security/permissions and document any validation not executed.

## Acceptance coverage

| Grupo da especificação | Tarefas que implementam | Evidência principal |
| --- | --- | --- |
| Estrutura, identidade visual, drawer e responsividade | 6–10, 18, 20 | testes de componentes, calibração lado a lado e checklist desktop/375 px |
| Cadastro, contatos, origem, CEP, duplicidade e legado | 3–7, 10 | validação de rota, RPC atômica e testes dos drawers |
| Pedidos em busca, prioridades e métricas | 2–5, 8–10 | matriz de domínio, resumo operacional e regressão de métricas |
| Visitas e Agenda como uma única Tarefa | 11–12, 15 | testes de identidade, reagendamento, lembretes e sincronização |
| Correspondência, aviso ao cliente e sinônimos | 13–15 | testes de compatibilidade, confirmação humana, auditoria e alertas de 48 h |
| Reservas reais e proteção contra dupla venda | 16 | roteiro SQL, testes de API/modelo e revisão focada das RPCs |
| Mapa local, privacidade e filtros sincronizados | 17–18 | validação dos dados, testes SVG/teclado e ausência de chamada geográfica em runtime |
| Estados, acessibilidade, integração e regressão | 19–20 | testes de navegação, lint, build, suíte completa e validação manual registrada |

## Rollout order

1. Tasks 1–2: no database impact.
2. Confirmar a precedência da migration 071 de Vendas; escrever e revisar a migration 072 aditiva, aplicá-la em não produção somente após autorização, executar validação, então Tasks 4–10 com dual-read de estados antigos/novos.
3. Escrever e revisar a migration 073; aplicá-la após autorização, validar, então Tasks 11–12.
4. Escrever e revisar a migration 074; aplicá-la após autorização, validar, então Tasks 13–15; remover o auto-fechamento antigo somente na mesma release.
5. Checkpoint B; escrever/revisar a migration 075, aplicá-la após autorização e executar Task 16.
6. Gerar/versionar os ativos geográficos e executar Tasks 17–18.
7. Executar Tasks 19–20, verificação sistêmica e aceite humano.

Frontend for a migration must not ship before its backend/schema capability is confirmed. Backend endpoints should return a clear `409` capability error when the expected migration is absent rather than falling back to partial writes.

O rollout é `expand/contract`: esta entrega apenas expande checks/colunas e mantém defaults/estados/índices legados compatíveis. Nenhum backfill destrutivo de `atendida` ocorre. Uma migration de contrato futura só poderá remover estados/defaults/índices antigos depois de telemetria demonstrar ausência de escritores e leitores legados. Releases intermediárias podem ser validadas em não produção, mas a nova central não entra em produção com suíte vermelha ou com dependência obrigatória de uma capability ainda ausente.

## Definition of Done

- All acceptance criteria in the spec map to Tasks 7–20.
- Old customer history, notes, motos, purchases, PIX receipts and deep-links remain available.
- No automatic match closes an order.
- No visit or reservation is duplicated across domains.
- Reservation policy is consistent in UI, API and database.
- Map has no runtime dependency on an external map provider.
- Tests, lint and build pass with real command evidence.
- Manual desktop/mobile/accessibility validation is recorded.
- Database execution and deployment remain separate, explicitly authorized actions.
