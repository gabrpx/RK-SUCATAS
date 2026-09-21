# Prompt — implementação da busca global do RK Sucatas

```md
Você é um Staff Frontend Engineer e Product Designer especializado em sistemas
operacionais B2B de alta densidade. Implemente a busca global do RK Sucatas com
qualidade de interação de produto final, aplicando obrigatoriamente a skill
local `ux-user-audit` antes, durante e depois da implementação.

## Contexto que deve ser preservado

- Stack: React 19, TypeScript, Vite, Tailwind CSS e Motion/Animate UI.
- Inspecione primeiro a implementação existente em
  `src/components/GlobalSearch.tsx`, seus consumidores e os componentes de UI
  reutilizáveis. Não altere `src/App.tsx`, rotas, APIs, banco, autenticação ou
  dependências sem pedir aprovação.
- A busca deve usar somente os dados já disponíveis no frontend. Não crie
  backend, banco, endpoint, contrato público ou regra operacional nova.
- O resultado precisa ser uma command palette operacional, rápida e legível,
  acionada por `Ctrl/Cmd + K`, com foco inicial no campo, resultados agrupados
  por domínio e filtros ricos (Todos, Estoque, Tarefas e Vendas) com contagem.
- Estados obrigatórios: inicial com atalhos úteis, carregando se aplicável,
  sem resultado, resultado parcial, item ativo por teclado e retorno de foco ao
  gatilho ao fechar.

## Critérios obrigatórios da `ux-user-audit`

1. Não use `select`, `alert`, `confirm`, `prompt` nem controles nativos
   genéricos para filtros, pessoas, decisões ou estados relevantes. Use
   componentes próprios, acessíveis e coerentes com o sistema.
2. Filtros e resultados devem ter foco visível, navegação por setas,
   Enter para abrir o item e Escape para fechar; explique atalhos e mantenha
   alvos de toque adequados.
3. Listas de resultados, sugestões e filtros nunca podem ser cortadas. Elas
   devem ter altura máxima baseada no viewport, rolagem interna e todos os
   itens — inclusive o primeiro, o último e o ativo — alcançáveis por mouse,
   toque e teclado. Posicione ou limite o overlay para não extrapolar a tela.
4. Ao abrir a command palette, bloqueie a rolagem do documento de fundo. A
   roda, trackpad e toque devem rolar somente a lista interna até seus limites,
   sem scroll chaining para a tela abaixo. Ao fechar, restaure a rolagem e o
   foco do gatilho sem salto de layout.
5. Use animações locais, discretas e contínuas apenas com `opacity` e
   `transform`. A superfície, backdrop, grupos e estados de resultado devem
   usar ciclo de presença com animação de saída real: não desmonte o componente
   antes de o exit terminar, nem gere sensação de reload. Respeite
   `prefers-reduced-motion`.
6. Todo overlay deve definir comportamento para foco, Escape e backdrop, e
   manter a interação de fundo bloqueada enquanto estiver aberto ou fechando.
7. Tooltips devem explicar ícones e ações ambíguas; não esconda o significado
   operacional de filtros, atalhos ou ações críticas.
8. Quando filtros, grupos ou resultados alterarem a altura da palette, a
   mudança deve usar transição de layout local, sem salto brusco. Ao alcançar
   o limite do viewport, transfira a rolagem para a área interna sem cortar
   resultado, foco ou item ativo.
9. A lista interna deve ter affordance de rolagem própria e coerente com a
   interface: trilho e polegar visuais, sem depender da barra padrão do
   navegador nem ocultar que existem resultados adicionais. Preserve mouse,
   trackpad, toque e teclado.
10. Se existir algum seletor dependente de outro filtro ou contexto, apresente
    somente opções válidas no conjunto previamente escolhido e reconcilie
    imediatamente uma seleção que deixe de ser válida.
11. Quando uma mudança de consulta, filtro ou navegação por teclado tornar o
    item ativo fora da área visível, desloque apenas a lista interna para
    mantê-lo em uma zona de leitura confortável. Foco DOM sem continuidade
    visual não é suficiente.

## Escopo de implementação

1. Leia a skill `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md` e audite
   a busca atual antes de editar; registre achados confirmados e o plano curto.
2. Reutilize primitives, tokens e componentes existentes. Caso seja necessário
   criar um componente local, mantenha-o dentro do escopo da busca global e
   não instale dependências.
3. Implemente busca por texto nos dados frontend existentes, filtros com
   contagens atualizadas, agrupamento escaneável, destaque da correspondência
   quando isso já for compatível com os dados e abertura do destino atual do
   item. Se algum destino não tiver rota/navegação existente, marque como
   limitação em vez de inventar fluxo.
4. Preserve acessibilidade: roles e labels adequados, foco previsível,
   contraste, leitor de tela, teclado, targets de toque e versão reduzida de
   movimento.
5. Não implemente funcionalidades fora deste escopo. Pare e pergunte antes de
   apagar arquivos, adicionar dependência, mudar contrato, banco, API,
   autenticação ou regras de negócio.

## Validação obrigatória

- Teste Ctrl/Cmd+K, abertura por botão, Escape, Enter, setas, troca de filtro,
  item inicial/intermediário/final e retorno de foco.
- Em desktop, viewport baixo e mobile, role a lista até os limites com mouse,
  trackpad e toque; confirme visualmente que nenhuma opção é cortada e a página
  de fundo não rola, e que o trilho/polegar da lista comunica os resultados
  adicionais.
- Troque filtros e altere a consulta para validar crescimento e redução suaves
  da altura da palette, sem salto; valide também que um filtro dependente nunca
  conserva ou apresenta uma opção fora do conjunto de origem.
- Confirme abertura e saída animadas, inclusive com `prefers-reduced-motion`.
- Execute o type-check/lint, build e os testes existentes. Caso alguma
  validação esteja indisponível, informe comando, erro real e impacto.
- Entregue relatório com arquivos modificados, achados da auditoria, validações
  executadas, limitações e pendências. Não faça commit, push, merge ou deploy.
```
