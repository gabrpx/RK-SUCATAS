# Handoff operacional — `tarefas-preview` para Claude Code

## Propósito e limite de atuação

Este documento transfere a continuidade do preview de tarefas do RK Sucatas para Claude Code. O objetivo é evoluir a experiência de tarefas com qualidade visual, operacional e de movimento, preservando o que já funciona e registrando aprendizado de UX na skill de auditoria a cada problema confirmado.

`/tarefas-preview` é hoje uma área isolada de prototipação funcional. Ela não está conectada aos dados reais, não deve alterar o ambiente publicado e não autoriza deploy. O endereço `https://rk-sucatas.onrender.com/` é o sistema real e só poderá receber a nova aba após aprovação explícita do usuário para integrar dados, rotas, permissões e persistência.

## Leitura obrigatória antes de qualquer alteração

1. `AGENTS.md`
2. `docs/AI_CONTEXT.md`
3. `docs/AI_WORKFLOW.md`
4. `docs/DESIGN_SYSTEM.md`
5. `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md`
6. Este documento

Em seguida, executar `git status --short --branch`, inspecionar o diff existente e tratar o código como a fonte de verdade. Há trabalho local de outros agentes: não descartar, reformatar em massa ou reescrever arquivos sem entender sua intenção.

## Como acessar e validar o preview

- Rota local: `http://localhost:3000/tarefas-preview`
- Ponto de montagem: `src/App.tsx` contém o roteamento condicional da rota. É arquivo crítico: não alterá-lo sem autorização explícita e sem seguir a coordenação definida em `AGENTS.md`.
- Para iniciar localmente, usar o script de desenvolvimento já configurado no projeto, sem adicionar dependências.
- Validar visualmente no navegador após mudanças em layout, animações, modais, filtros, cards, drawers ou responsividade.

## Mapa de arquivos e responsabilidades

| Caminho | Responsabilidade | Como agir |
| --- | --- | --- |
| `src/features/tarefas-preview/TasksPreview.tsx` | Orquestra a tela: dados de demonstração, estado das abas, filtros, cards, drawer de tarefa, composição e painel de lembretes. | É o ponto principal de integração da UI. Mantenha estado de apresentação aqui e extraia regras puras para os models. |
| `src/features/tarefas-preview/taskPreviewModel.ts` | Tipos e helpers puros de tarefas do preview. | Concentrar filtros, agregações e transformações previsíveis; cobrir mudanças com teste. |
| `src/features/tarefas-preview/TaskComposer.tsx` | Modal e fluxo de criação/coordenação de tarefas. | Reutilizar padrões de overlays, seleção de responsáveis e confirmação já existentes. |
| `src/features/tarefas-preview/RemindersPanel.tsx` | Aba de lembretes: cards, contador urgente, criação, detalhes e confirmações. | Manter o painel integrado ao mesmo sistema visual de tarefas; não introduzir controles nativos genéricos. |
| `src/features/tarefas-preview/reminderModel.ts` | Tipos e regras puras de lembretes, prioridade e contagem regressiva. | Manter tempo, filtro e ordenação independentes da camada visual. |
| `tests/tarefas-preview/taskPreviewModel.test.ts` | Regras puras de tarefas. | Ampliar quando alterar helpers ou estados derivados. |
| `tests/tarefas-preview/reminderModel.test.ts` | Regras puras de lembretes. | Cobrir urgência, atraso, recorrência e ações de estado quando aplicável. |
| `src/components/animate-ui/components/` | Componentes Animate UI já disponíveis, incluindo tabs e botões. | Reutilizar antes de criar qualquer primitivo. |
| `src/components/charts/` | Primitivos locais de visualização no estilo Bklit. | Reutilizar para indicadores, progresso e dados operacionais. |
| `src/components/GlobalSearch.tsx` e `src/components/globalSearchModel.ts` | Busca global/command palette do projeto. | Evoluir por extensão do padrão existente; não criar uma segunda busca concorrente. |
| `docs/DESIGN_SYSTEM.md` | Decisões de design e fontes de componentes aprovadas. | Consultar antes de desenhar e atualizar apenas quando houver decisão durável. |
| `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md` | Critérios reutilizáveis de auditoria visual e UX. | Atualizar obrigatoriamente com aprendizados comprovados, conforme processo abaixo. |

## Arquivos que não devem ser alterados sem coordenação e autorização

Não tocar em `src/App.tsx`, `server.ts`, `middleware/auth.ts`, `src/context/DataContext.tsx`, `src/utils/api.ts`, `src/server/routes/`, `services/supabaseClient.ts`, `supabase/`, migrations, `.env`, `package.json`, lockfiles ou configurações de deploy para evoluir o preview.

Esses arquivos são críticos, têm impacto transversal ou envolvem contratos e dados reais. Se a próxima demanda exigir um deles, parar, explicar o contrato que falta e pedir decisão explícita do usuário antes de seguir. O frontend real deve continuar consumindo somente a API Express; nunca conectar o navegador diretamente ao Supabase ou expor credenciais.

## Arquitetura atual do preview

`TasksPreview.tsx` é o contêiner da experiência. Ele mantém o estado demonstrativo de tarefas e lembretes e entrega callbacks aos subcomponentes. Os models mantêm cálculos e tipos puros. Os componentes devem receber dados e emitir intenções; não devem duplicar regras de filtro, prioridade ou progresso.

As abas de alto nível separam “Meu turno” e “Lembretes”. A troca usa presença e movimento para não aparentar reload. Dentro de tarefas, os filtros da fila prioritária têm semântica própria e não devem competir com as abas de alto nível. O painel de categorias deriva seus itens das tarefas existentes: categorias vazias não aparecem e entram/saem com transição de layout suave.

Tarefas individuais e colaborativas vivem na mesma fila. A distinção deve ocorrer por metadados, avatares, responsáveis e progresso, não por uma tela paralela. Checklists devem poder ser marcados também na listagem, preservando consistência com os detalhes da tarefa.

O estado de lembretes foi elevado para `TasksPreview.tsx` para sobreviver à troca de abas. `RemindersPanel.tsx` recebe os lembretes, devolve alterações e informa a quantidade ativa para o cabeçalho. O contador de prioridade máxima abre os detalhes exatamente do lembrete que está sendo contado.

## Direção visual e de componentes

Siga `docs/DESIGN_SYSTEM.md`. Para novas superfícies do preview:

- Use a tipografia sans já adotada no projeto, preferencialmente Geist/Inter nos novos componentes. Não introduza `font-mono` em superfícies novas.
- Preserve a linguagem operacional clara: fundo claro, cartões brancos, azul como ação principal, esmeralda para sucesso, âmbar para atenção e rosa/vermelho para risco destrutivo.
- Reutilize Animate UI para tabs e botões, os primitivos locais de gráficos para dados, e os padrões de overlay existentes para dialogs, dropdowns, drawers e tooltips.
- Motion/AnimatePresence é a base para presença, saída e mudanças de layout. Anime.js pode complementar revelações discretas. Respeite `prefers-reduced-motion`.
- Não criar do zero nem usar controles HTML genéricos para dropdowns, dialogs, tooltips, menus, tabs ou botões quando houver componente/padrão já disponível. `select`, `alert` e `confirm` nativos não são aceitáveis para fluxos operacionais do preview.
- A animação deve esclarecer estado: entrada e saída de overlay, seleção de tab, adição e remoção de etapa, mudança de tamanho do modal, feedback de conclusão e transições entre categorias. Nunca usar animação meramente decorativa ou que pareça recarregamento.

## Regras para microinterações e overlays

Todo componente interativo deve ser auditado com a skill antes de ser considerado pronto. Em especial:

- Menus de responsáveis devem mostrar somente pessoas elegíveis no fluxo atual, ter altura limitada, rolagem interna personalizada, foco visível e não permitir que a página de fundo role.
- Dropdowns, dialogs e drawers precisam de entrada e saída, bloqueio de rolagem de fundo, Escape, clique externo quando apropriado, foco inicial e restauração do foco ao fechar.
- Ao adicionar etapas, itens ou campos que aumentem o modal, anime a mudança de layout e preserve o ponto focal: leve o novo conteúdo ou o campo ativo para uma área visível dentro do container rolável.
- Ações destrutivas e adiamentos exigem confirmação contextual feita pelo sistema visual. A ação segura deve ser dominante quando o risco justificar.
- Conclusão deve dar feedback perceptível e temporário, como a borda verde já usada em lembretes, sem quebrar o layout.
- Para lembretes urgentes, manter a contagem regressiva real, sinais de atraso, CTA contextual e navegação direta para o item correspondente.
- Ação primária, secundária e destrutiva devem ter hierarquia inequívoca. Não deixar botões visualmente soltos ou desalinhados da identidade da tela.

## Processo obrigatório de evolução da skill de auditoria

Esta é uma regra intrínseca do projeto: cada problema de UX ou interface confirmado pelo usuário, por teste manual ou por auditoria deve melhorar a skill para que o mesmo erro não retorne em outra tela.

1. Registrar o problema com precisão: componente, interação, resultado observado e resultado esperado.
2. Confirmar que é um padrão reaproveitável, não apenas um texto ou caso isolado de dados de demonstração.
3. Antes de encerrar a implementação, ampliar `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md` com um critério curto, verificável e genérico. Use a seção de critérios obrigatórios ou o roteiro de overlays quando for pertinente.
4. Incluir a condição de aceite correspondente. Exemplo: não basta dizer “dropdown melhor”; definir que listas longas ficam dentro de uma área com rolagem interna, sem corte e sem rolagem da página de fundo.
5. Aplicar o novo critério à mudança atual. A skill não é um arquivo de retrospectiva: ela precisa influenciar a implementação em curso.
6. Evitar regras vagas, duplicadas ou não comprovadas. Quando a evidência for insuficiente, registrar a hipótese como “a confirmar” no relatório, sem transformá-la em regra mandatória.
7. No relatório final, declarar qual aprendizado foi adicionado à skill, qual comportamento foi corrigido e como foi validado.

Exemplos de aprendizados já consolidados incluem: não usar dropdown nativo em seleção contextual; animar adição/remoção e redimensionamento de coleções; preservar foco em mutações; bloquear scroll de fundo em overlays; fornecer saída animada; não mostrar categorias sem tarefa; e tornar ações de checklist disponíveis na fila quando o contexto permitir.

## Método de trabalho para cada nova solicitação

1. Ler o pedido, confirmar o objetivo e os critérios concretos. Não inventar regras de negócio, dados reais ou integração.
2. Inspecionar estado, diff, arquivos próximos e componentes reutilizáveis com `rg` antes de editar.
3. Aplicar a skill `ux-user-audit` para a área afetada e verificar `docs/DESIGN_SYSTEM.md` antes de decidir componentes ou motion.
4. Preservar componentes corretos existentes; alterar o menor conjunto de arquivos possível.
5. Manter regras puras nos models e apresentação nos componentes. Evitar duplicar estado entre card, drawer e composer.
6. Implementar o fluxo completo, incluindo estados vazios, foco, teclado, carregamento local quando aplicável, erro de interação e redução de movimento.
7. Atualizar a skill com qualquer problema confirmado durante a tarefa.
8. Validar código, comportamento e visual. Só então relatar o resultado com limites reais.

## Validação prática

O `npm` global desta máquina está indisponível; use os binários locais até que isso seja corrigido. As validações recomendadas são:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\esbuild.cmd server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/server.js
git diff --check
```

Além disso, validar manualmente a rota local, em viewport desktop e estreita, com teclado e `prefers-reduced-motion` quando a alteração envolver movimento. Testes de models ficam em `tests/tarefas-preview/`; caso o runner local falhe por ambiente, informar claramente que não houve execução, sem declarar teste aprovado.

## Checklist de aceite para uma mudança no preview

- O fluxo solicitado funciona sem navegação inesperada ou aparência de reload.
- Componentes novos reutilizam os padrões e fontes autorizados.
- Não há `select`, `alert` ou `confirm` nativo introduzido em fluxos operacionais.
- Overlay não corta conteúdo, não vaza scroll para o fundo e tem saída animada.
- Mudanças dinâmicas preservam foco e contexto visual.
- Ações têm hierarquia visual, estados de hover/foco/disabled e semântica acessível.
- Dados vazios, concluídos, atrasados e colaborativos seguem o mesmo modelo de estado.
- A skill foi ampliada se surgiu um novo problema comprovado.
- TypeScript, build e verificação de diff foram executados ou a limitação foi relatada.

## Preparação para a integração no sistema real

Quando o usuário autorizar transformar o preview em aba do sistema publicado, não migrar por suposição. Primeiro produzir e obter aprovação para:

1. Mapa entre tipos do preview e os contratos reais de tarefas, usuários, checklists, responsáveis, prioridade e lembretes.
2. Fonte de verdade, endpoints Express, autorização por perfil e semântica de criação, conclusão, cancelamento, adiamento e exclusão.
3. Data/hora, timezone, recorrência e atualização em tempo real.
4. Estados de carregamento, erro, vazio e concorrência com dados reais.
5. Estratégia de rollout e validação, sem editar Supabase, migrations, RLS ou produção sem autorização explícita.

Somente depois dessa aprovação poderá haver coordenação para arquivos críticos e integração. O preview deve continuar utilizável enquanto a adaptação é construída.

## Resultado esperado do Claude em cada turno

No início: dizer brevemente o que foi encontrado no código e quais arquivos serão afetados. Durante o trabalho: comunicar apenas atualizações úteis. No final: reportar objetivo, arquivos modificados, estado herdado, alterações próprias, validações reais, limitações, decisões, riscos e próximos pontos que dependem do usuário.
