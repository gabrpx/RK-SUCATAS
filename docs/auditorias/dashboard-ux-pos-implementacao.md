# Auditoria UX — Dashboard pós-implementação

**Data:** 2026-09-14  
**Preview:** `http://127.0.0.1:3011/dashboard`  
**Viewports verificados:** 375 × 812 e 1440 × 900  
**Método:** framework de auditoria versionado no projeto + revisão de acessibilidade. A skill `ux-audit` não foi localizada nesta cópia nem nas outras pastas semelhantes encontradas (`D:\NOVO SISTEMA ATUALIZADO`, `D:\RK-Sucatas` e `D:\rk-sucatas-v2`), portanto não é declarada como executada.

## Evidência inicial

A referência mobile enviada pelo usuário mostrou cards e filtros parcialmente fora da viewport, nomes de peças/categorias com reticências, valores encostados na borda e ações flutuantes sobre a lista. O problema era de hierarquia e adaptação de conteúdo, não apenas de tamanho de fonte.

## Findings e estado

| Prioridade | Finding | Tratamento | Evidência pós-implementação |
|---|---|---|---|
| P0 | KPIs em carrossel dificultavam comparar e ler valores no celular | Cards passaram para grid responsivo: uma coluna em telas estreitas, duas a partir de 420 px e quatro no desktop | Preview em 375 px, sem clipping horizontal |
| P0 | Rótulos, contexto e nomes longos dependiam de `truncate` | `MetricCard`, alertas, notificações e linhas do dashboard agora quebram texto com limite legível de linhas | Texto completo preservado na árvore acessível |
| P1 | FAB de busca/declaração cobria cards do dashboard | FABs globais ficam fora do Dashboard; a busca permanece no cabeçalho e os FABs continuam nas áreas operacionais | Preview mobile sem sobreposição |
| P1 | Visão executiva extensa aparecia antes do resumo operacional em instalações novas | Preferência inicial passa a priorizar o painel operacional; a visão executiva continua disponível e recolhível | No preview, alertas e KPIs aparecem antes da visão completa |
| P1 | Linhas clicáveis eram `div` sem semântica de controle | Linhas de atividade, tarefas e cabeçalho de posição usam botões com foco visível e `aria-expanded`/`aria-label` quando aplicável | Árvore acessível expõe ações como `button` |
| P1 | Falha do resumo remoto era silenciosa | Estado de erro com `role=alert` e `Tentar novamente` | Contrato preservado sem mascarar falha com zeros |
| P2 | Gráficos dependiam apenas de interpretação visual | Área e donut ganharam resumo textual/label acessível | Árvore acessível expõe saldo e distribuição |

## Limitações e follow-ups

- A imagem enviada também representa a área de Estoque; truncamentos específicos da lista de gavetas/filtros devem ser tratados no plano de Estoque, não foram alterados neste escopo do Dashboard.
- A origem dos dados de vendas em algumas camadas executiva/operacional ainda merece consolidação posterior; nesta execução o período foi explicitado como `período atual` e não foi inventado um timestamp.
- O comando `npm run lint` não pôde ser executado porque o npm global aponta para um `npm-cli.js` ausente. O equivalente local `node node_modules/typescript/bin/tsc --noEmit` passou.
