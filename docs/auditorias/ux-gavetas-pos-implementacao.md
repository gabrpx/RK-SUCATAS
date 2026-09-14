# Auditoria UX — Área de Gavetas (pós-implementação)

**Data:** 2026-09-14
**Branch:** `claude/ux-gavetas-operacao` (a partir de `origin/main`)
**Preview validada:** `http://localhost:3000/estoque` (a porta 3011 do prompt não é a usada pelo `launch.json`; o dev sobe em 3000 com dados reais)

> **Skill `ux-audit`:** não foi localizada no repositório nem no diretório de skills do Claude Code (`~/.claude/skills`). Conforme o próprio plano, **não afirmo tê-la executado.** Esta auditoria usa como _fallback_ o framework descrito no plano (pontos fortes / problema / impacto / evidência / recomendação / risco de acessibilidade), apoiada em verificação visual ao vivo a cada tarefa.

## Método

Auditoria comparativa antes/depois por fluxo, com screenshots capturadas na preview local com dados reais (255 variantes, 587 unidades, 4 gavetas, 241 itens não agrupados). Cada finding foi convertido em mudança testável (TDD) e reverificado ao vivo.

## Findings e estado final

| # | Fluxo | Problema (antes) | Estado final | Evidência |
|---|-------|------------------|--------------|-----------|
| P0 | Lista de gavetas | Nenhuma pendência visível; só faixa de preço e contagem | Chips "N fichas pendentes / N com avaria / sem foto…" por gaveta, ícone+texto | screenshot lista |
| P0 | Variante / unidade | Pendências implícitas; foto legada confundida com foto própria | Chips na variante; unidade distingue foto própria × legada (marcador) × sem foto | screenshot detalhe |
| P1 | Busca / filtros | Só filtro de categoria; sem limpar; total geral misturado ao resultado | Filtros rápidos por estado (AND), "Limpar busca/filtros", "X resultados em Y gavetas" separado de "Resumo do estoque" | screenshot "21 resultados em 2 gavetas" |
| P1 | Itens não agrupados | Lista passiva de rows clicáveis | Fila: contador "241 aguardando organização", seleção múltipla, "Mover para gaveta" em lote, "Criar nova gaveta" | screenshot fila + diálogo destino |
| P1 | Detalhe da gaveta | Cabeçalho pobre; sem ordenação/filtro; vendidas somem; "Soltar" imediato; erro de título silencioso | Cabeçalho com disponíveis + fichas pendentes + chips; ordenar por nome/qtd/valor/pendências; filtro interno; vendidas em seção recolhida; "Soltar" com toast + Desfazer; erro de título visível | screenshot detalhe |
| P1 | Ficha da unidade | Sem visão do que falta; herança implícita | "Pendências desta ficha" + "Completar ficha"; herança de preço/nota rotulada; foto legada com aviso de origem | screenshot ficha |
| P2 | Adicionar peças | Sem "selecionar todos"; sem resumo do destino | "Selecionar todos os resultados (N)", contador, resumo "N peças → gaveta" | screenshot "241 selecionadas" |
| P2 | Estados | Erro de rede como texto solto; sem estado de permissão | `ErroEstadoGavetas` com "Tentar novamente"; `SemPermissaoGavetas`; role=alert | teste EstadosGaveta |

## Já existente antes desta branch (herdado de `origin/main`)

- Busca tolerante (acentos/ordem, código/categoria/modelo/unidades) — `correspondeBuscaEstoque`.
- Nomes completos com quebra de linha e preço alinhado em "Adicionar peças" (Task 10) — já implementado e testado.
- Dropdown de categoria pesquisável (Animate UI Radix) em criar e editar gaveta — `CategoriaGavetaDropdown`.
- Skeletons de carregamento, empty state e barra offline.

## Acessibilidade

- Filtros usam `aria-pressed`; categoria usa `role=tab`/`aria-selected`; contagem de resultados em `role=status aria-live`; estados de erro em `role=alert`.
- Pendências sempre com ícone **e** texto — não dependem só de cor.
- Alvos de toque ≥ 44px (min-h-11) mantidos nos controles novos.

## Limitações / pendências para revisão humana

1. **`npm run lint` (`tsc --noEmit`) vermelho — pré-existente.** `@types/react` não está declarado em `package.json` nem no `package-lock.json`; erros aparecem em arquivos não tocados (VisaoDono, DeclaracaoVendaModal, TarefaCards, vite.config). Não é regressão desta branch. `npm run build` passa (Vite/esbuild não faz typecheck). Corrigir a toolchain é mudança crítica (mexe no lock com tipos sensíveis de animate-ui/motion/tremor) e ficou fora do escopo.
2. **`CategoriaGavetaDropdown.test.tsx` falha — pré-existente.** Limitação Radix+jsdom (o trigger abre por evento de ponteiro, não `fireEvent.click`). Falha também na base sem minhas mudanças; funcionalidade verificada ao vivo.
3. **`prefers-reduced-motion`** nas animações do Animate UI é comportamento de biblioteca (motion) e não foi auditado a fundo; as animações novas próprias são transições curtas de cor/transform.
4. Screenshots foram capturadas na preview durante a execução, mas não versionadas no repositório.
