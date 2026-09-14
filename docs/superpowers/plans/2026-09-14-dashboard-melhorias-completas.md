# Plano: melhoria completa do dashboard

## Goal

Tornar o dashboard um painel operacional confiável e legível: alertas importantes aparecem cedo, métricas não se contradizem, a hierarquia é clara em desktop e mobile, e todos os estados de carregamento, erro, vazio e acessibilidade são tratados.

## Architecture

Preservar o acesso atual do frontend à API Express e concentrar a composição das métricas em seletores/helpers tipados. `DashboardView` será a composição da experiência; `VisaoDono` será uma camada executiva secundária, sem duplicar o painel operacional. Não alterar banco, autenticação ou contratos sem evidência de necessidade.

## Tech Stack

React, TypeScript, Vite, Tailwind, componentes existentes do dashboard, Vitest/React Testing Library quando disponíveis e o preview local para validação visual. Auditoria final com a skill de UX (`product-design:audit`/`ux-audit` do projeto) e revisão WCAG.

## Spec

`docs/superpowers/specs/2026-09-14-dashboard-clipboard-design.md`

## Diagnóstico que motivou o plano

- Há duas camadas extensas de dashboard na mesma rota, com repetição de vendas, alertas e clientes.
- Os alertas críticos aparecem depois de muitos blocos; em telas estreitas, alguns KPIs horizontais ficam cortados.
- Foram observados valores de vendas diferentes entre a visão executiva e a visão operacional; a origem e o período precisam ser explicitados e unificados.
- Há linhas visualmente clicáveis implementadas como `div`, sem semântica de botão/link e sem garantia de teclado.
- Há captura de erro silenciosa em resumo de pendências (`catch(() => {})`), o que transforma falha de dados em falsa normalidade.
- Gráficos dependem apenas de leitura visual e precisam de resumo textual/tabela acessível.
- Ações flutuantes competem com conteúdo e navegação em mobile.
- Evidência mobile anexada em 14/09/2026: a tela estreita mostra KPIs parcialmente fora da viewport, filtros em uma faixa que exige arraste, nomes de peças/categorias truncados com reticências, valores encostados na borda e ações flutuantes sobre a lista. Esse padrão confirma que a regra de responsividade precisa priorizar leitura completa, não apenas indicar que existe conteúdo horizontal.

## Critérios de aceitação

- Em 375 px de largura, nenhum KPI, nome, valor ou ação crítica é cortado horizontalmente.
- Em 375 px, nomes longos de peças e categorias quebram em até duas linhas ou têm uma forma acessível de leitura completa; não dependem apenas de `truncate`/reticências.
- Em 375 px, filtros e ações podem ser alcançados sem esconder a informação principal e nenhum botão flutuante cobre uma linha de conteúdo.
- Em desktop, a primeira área mostra o resumo operacional e os alertas sem exigir rolagem longa.
- Cada valor de vendas usa a mesma fonte e o mesmo período, ou exibe uma explicação explícita quando o recorte for diferente.
- Uma falha de resumo mostra mensagem, estado stale quando aplicável e ação de tentar novamente.
- Linhas interativas são navegáveis por teclado, têm foco visível e nome acessível.
- Cada gráfico possui resumo textual equivalente para leitor de tela e para quem não interpreta o gráfico.
- O usuário consegue diferenciar carregando, vazio, erro e dados atualizados.
- A auditoria visual final cobre mobile e desktop no preview.

## Tarefas de implementação

### 1. Mapear e tipar a fonte de verdade

Arquivos prováveis: `src/features/dashboard/DashboardView.tsx`, `src/features/dashboard/VisaoDono.tsx`, tipos/helpers do dashboard e rota Express correspondente, somente se a inspeção provar divergência.

- Catalogar cada KPI, período e origem atual.
- Criar tipos para o resumo executivo e pendências; remover `any` onde ele atravessa a UI.
- Extrair seletores puros para vendas do período, estoque, pendências e ticket médio.
- Escrever testes primeiro para períodos, soma de vendas e estados sem dados.

### 2. Reorganizar a hierarquia acima da dobra

- Definir um único bloco inicial: título, período/atualização, quatro KPIs essenciais e alertas prioritários.
- Mover `estoque baixo`, `pendências financeiras` e tarefas urgentes para uma faixa de ação próxima ao topo.
- Transformar `VisaoDono` em seção executiva recolhível ou secundária, respeitando a preferência existente sem duplicar o painel inteiro.
- Manter permissões e links de navegação atuais.

### 3. Corrigir responsividade e leitura dos KPIs

- Trocar carrosséis/filas que cortam conteúdo por grid responsivo ou cards que quebram de forma previsível.
- Mostrar rótulos completos, valor, unidade e período; usar tooltip apenas como complemento.
- Definir largura mínima, `min-width: 0`, quebra de texto e comportamento para números longos.
- Validar 375 px, 768 px e desktop amplo.
- Tratar a referência visual de 14/09 como caso de regressão: cards devem caber na largura disponível, títulos devem quebrar com segurança e faixas horizontais devem ser usadas apenas quando a rolagem for a interação principal explicitamente indicada.

### 4. Unificar métricas e comunicar contexto

- Resolver a divergência entre os valores de vendas observados, identificando se é período, status, canal ou fonte diferente.
- Exibir “atualizado em”, período selecionado e, quando relevante, “inclui vendas confirmadas”.
- Não mascarar ausência de dados com zero quando a consulta falhou.
- Cobrir o contrato com testes de regressão.

### 5. Estados de carregamento, erro e atualização

- Criar skeletons proporcionais ao layout final.
- Trocar catches silenciosos por estado de erro local com texto curto e botão `Tentar novamente`.
- Preservar último dado válido com indicação de desatualização quando for seguro.
- Diferenciar “nenhuma pendência” de “não foi possível carregar pendências”.

### 6. Acessibilidade e interação

- Converter linhas clicáveis em `button`/`a` semânticos ou aplicar semântica completa apenas quando necessário.
- Garantir foco visível, ordem de tabulação, `aria-label` e área de toque adequada.
- Fornecer resumo textual para gráficos e não usar apenas cor para indicar estado.
- Revisar contraste, zoom de 200% e leitura em viewport estreito.

### 7. Ações flutuantes e densidade visual

- Reposicionar o botão flutuante e o botão de busca para não cobrirem gráficos, navegação ou listas.
- Reduzir bordas/ênfases concorrentes e estabelecer níveis claros: alerta, KPI, tendência e detalhe.
- Preservar a identidade visual laranja do sistema.

### 8. Validação e entrega

- Executar testes relevantes, `npm run lint` e `npm run build`.
- Abrir o preview e validar manualmente desktop e mobile com dados reais e estados sem dados.
- Rodar a auditoria de UX e revisar os achados contra os critérios acima.
- Atualizar a patchnote do sistema.
- Revisar o diff, registrar limitações e fazer commit/push somente após as validações.

## Riscos e decisões que exigem atenção

- Se os valores divergentes vierem de contratos diferentes da API, não corrigir por heurística na UI: documentar a diferença e ajustar na camada correta.
- Não remover a visão executiva sem manter sua capacidade informativa; primeiro consolidar conteúdo e depois reduzir duplicação.
- Dados de clientes devem aparecer apenas quando necessários para a ação e com a menor exposição possível.
- A validação atual foi principalmente em viewport estreita; desktop precisa ser confirmado no preview antes de declarar concluído.

## Checklist final

- [x] Fonte e período de cada métrica documentados na interface (`período atual`); divergências de origem dos dados continuam registradas como follow-up.
- [x] Alertas críticos acima da dobra.
- [x] Nenhum clipping em mobile/desktop na área validada do Dashboard.
- [x] Evidência mobile anexada incorporada e validada no preview.
- [x] Estados loading/empty/error/retry cobertos para o resumo remoto de pendências.
- [x] Interações de listas e da visão executiva acessíveis por teclado.
- [x] Gráficos com equivalente textual.
- [x] Auditoria visual com o framework fallback do projeto e revisão de acessibilidade executadas; a skill `ux-audit` não existe nesta cópia nem nas outras cópias localizadas.
- [x] TypeScript, testes e build executados; `npm run lint` não pôde ser usado porque o npm global está quebrado, mas `node node_modules/typescript/bin/tsc --noEmit` passou.
- [x] Patchnote atualizada.
- [x] Commit e push realizados pelo agente executor.

## Estado da execução em 14/09/2026

Implementados nesta execução: cards responsivos sem carrossel em mobile, quebra segura de títulos/valores, alertas e notificações sem truncamento, FABs globais ocultos apenas no Dashboard (a busca já existe no cabeçalho), linhas interativas semânticas, resumo textual dos gráficos, estado de erro com retry e posição inicial operacional da visão executiva. O commit e o push desta execução serão registrados no relatório final.
