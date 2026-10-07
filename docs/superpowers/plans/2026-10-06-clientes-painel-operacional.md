# Clientes — Painel Operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o Painel de Clientes com indicadores operacionais e um mapa local, agrupado por cidade, que ajude a priorizar atendimentos sem expor endereços.

**Architecture:** O painel continua sendo a fonte visual da prioridade: a faixa de métricas permanece no topo, a fila fica à esquerda e o mapa vetorial do Brasil fica ao lado em telas largas e abaixo em telas pequenas. Os limites estaduais e os centroides municipais são gerados uma vez a partir da malha oficial do IBGE, versionados como ativos locais e carregados sob demanda pelo componente; a aplicação não consulta provedores geográficos em runtime.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, SVG nativo e GeoJSON local.

**Spec:** `docs/superpowers/specs/2026-10-02-clientes-gerenciamento-integrado-design.md` (itens 9.3, 9.4, 11.1 e tarefas 17–18); `docs/superpowers/plans/2026-10-02-clientes-gerenciamento-integrado.md` (tarefas 8, 17–18).

## Global Constraints

- Não alterar rotas Express, contratos de API, banco, RLS ou dados de clientes.
- Nunca expor endereço, CEP, telefone ou localização residencial no mapa.
- Usar somente ativos geográficos locais em runtime; sem SDK, dependência ou token de mapas.
- Agrupar marcadores por município e UF; não usar coordenadas aproximadas nem geocodificação no navegador.
- Manter a fila de pendências como primeiro conteúdo operacional e preservar navegação por teclado.
- Não criar commit, push, migration ou dependência nova.

## Review Focus

- Município homônimo em UFs diferentes deve produzir dois grupos independentes — coberto pela tarefa 1.
- Cliente sem cidade ou UF não pode sumir silenciosamente — coberto pela tarefa 1 e pela tarefa 3.
- Marcador com vários clientes deve abrir a lista daquela cidade, e cada item deve abrir o cliente correto — coberto pela tarefa 3.
- Geometria multipolígono deve receber um ponto interno ao maior polígono — coberto pela tarefa 2.
- Em 375px o mapa deve ficar abaixo da fila sem rolagem horizontal da página — coberto pela tarefa 4.

### Task 1: Modelo de distribuição geográfica

**Files:**
- Create: `src/features/clientes/mapa/mapaModel.ts`
- Create: `src/features/clientes/mapa/mapaModel.test.ts`

**Interfaces:**
- Consomes: `ClienteOperacaoListaItem` e `SituacaoCliente` de `../operacaoTypes`.
- Produces: `agruparClientesPorCidade(itens, situacoes): GrupoCidade[]` e `normalizarChaveCidade(cidade, estado): string | null`.

- [ ] Escrever testes que agrupem clientes da mesma cidade/UF, separem homônimos e mantenham o total sem localização.
- [ ] Implementar normalização por espaço, acento e caixa, usando chave `UF:nome-normalizado`.
- [ ] Implementar ordenação por criticidade, total de clientes e nome da cidade para resultados estáveis.
- [ ] Rodar `node node_modules/vitest/vitest.mjs run src/features/clientes/mapa/mapaModel.test.ts` e confirmar aprovação.

### Task 2: Ativos geográficos reprodutíveis

**Files:**
- Create: `scripts/gerar-mapa-clientes.mjs`
- Create: `src/features/clientes/mapa/brasil-estados.geo.json`
- Create: `src/features/clientes/mapa/municipios-centroides.json`
- Create: `src/features/clientes/mapa/mapaDados.test.ts`
- Create: `src/features/clientes/mapa/README.md`

**Interfaces:**
- Produces: GeoJSON de UFs e dicionário `Record<string, { longitude: number; latitude: number }>` indexado por `UF:nome-normalizado`.
- Supports: `node scripts/gerar-mapa-clientes.mjs` para gerar e `node scripts/gerar-mapa-clientes.mjs --check` para conferir o resultado versionado.

- [ ] Consultar a malha municipal de qualidade mínima e a malha de UFs da fonte oficial IBGE, validando status, `FeatureCollection` e quantidade esperada antes de gravar ativos.
- [ ] Implementar no script o cálculo de área, ponto no polígono e ponto de superfície por linha de varredura; em `MultiPolygon`, selecionar o polígono de maior área.
- [ ] Gerar coordenadas para cada município, validar que latitude/longitude são finitas e que o conjunto de UFs contém as 27 siglas.
- [ ] Documentar origem, data de geração, comando de atualização e proibição de fetch no navegador.
- [ ] Rodar `node scripts/gerar-mapa-clientes.mjs --check` e `node node_modules/vitest/vitest.mjs run src/features/clientes/mapa/mapaDados.test.ts`.

### Task 3: Mapa interativo de clientes

**Files:**
- Create: `src/features/clientes/mapa/ClientesMapa.tsx`
- Create: `src/features/clientes/mapa/ClientesMapa.test.tsx`

**Interfaces:**
- Consomes: `ClienteOperacaoListaItem[]`, `SituacaoCliente[]`, o modelo da tarefa 1 e os ativos da tarefa 2.
- Produces: `ClientesMapa({ itens, situacoes, onSelectCliente }): JSX.Element`.

- [ ] Escrever testes para marcador acessível, agrupamento por cidade, clientes sem localização e clique que seleciona um cliente.
- [ ] Implementar projeção SVG a partir dos limites do GeoJSON, contorno discreto de UFs e marcador da loja confirmado como `Juazeirinho, PB`.
- [ ] Renderizar marcadores como botões com cidade, UF, quantidade e maior urgência; usar cores complementadas por texto/legenda.
- [ ] Ao ativar um marcador, exibir a lista de clientes daquela cidade; ao ativar um cliente, chamar `onSelectCliente`.
- [ ] Rodar `node node_modules/vitest/vitest.mjs run src/features/clientes/mapa/ClientesMapa.test.tsx`.

### Task 4: Integração responsiva no Painel

**Files:**
- Modify: `src/features/clientes/components/ClientesPainel.tsx`
- Modify: `src/features/clientes/components/ClientesPainel.test.tsx`

**Interfaces:**
- Consomes: `ClientesMapa` carregado com `React.lazy`, a fila e o resumo existentes.
- Preserves: `ClientesPainelProps` e callbacks já consumidos por `ClientesView`.

- [ ] Escrever teste que mantenha métricas, fila e região do mapa no painel com dados operacionais.
- [ ] Construir área `lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]`, com fila primeiro e mapa abaixo no mobile.
- [ ] Carregar o mapa somente depois da fila, com fallback compacto sem mudar a altura da tela de forma brusca.
- [ ] Rodar a suíte de Clientes, build Vite e revisão de diff; validar visualmente em `http://127.0.0.1:3001/clientes` em 375px e desktop.

## Self-review

- Cobertura da especificação: indicadores e fila existentes são preservados; o mapa oficial, agrupado por cidade, com marcador de loja, legenda, lista acessível e ordem responsiva são cobertos nas tarefas 2–4.
- Sem placeholders: cada tarefa declara arquivos, interface, comportamento e comando de verificação.
- Consistência: a chave geográfica produzida na tarefa 1 é a mesma que indexa os centroides da tarefa 2 e que o componente consome na tarefa 3.
- Fora de escopo preservado: visitas e reservas continuam mostrando a disponibilidade real da API, sem métricas inventadas.
