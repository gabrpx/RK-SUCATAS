# Auditoria UX — Sistema Integrado RK Sucatas

Data: 22/09/2026  
Escopo: superfícies operacionais publicadas em `rk-sucatas.onrender.com`, preview local de estoque e inventário de componentes do repositório.  
Referência visual aprovada: painel light de **Tarefas / Torre de Operações** enviado pelo usuário.

## 1. Resumo executivo

O sistema já possui uma direção visual forte e funcional na tela light de
Tarefas: fundo slate claro, cartões brancos, azul para a ação principal,
hierarquia curta e navegação inferior. Essa é a identidade a ser estendida.

O maior desvio está no Estoque. Ele suporta os dados existentes — gavetas,
fichas agrupadas, variantes, unidades, fotos legadas, preço, avaria, situação
sem gaveta e endereço —, mas sua leitura e seus detalhes ainda não usam a
linguagem operacional da Torre de Operações. Em especial, a ficha de unidade
não é um drawer de trabalho como a ficha de tarefa: é um formulário reduzido.

Resultado geral: **a fundação de dados do estoque é aproveitável; a experiência
precisa ser unificada antes de o novo visual substituir a rota oficial.**
Confiança alta para os achados confirmados em produção e código; média para
comportamentos de erro, permissões e operações destrutivas, que não foram
executados para não alterar dados reais.

## 2. Fluxo percorrido

1. Tela de Tarefas em produção: fila, cards, filtros, checklist, busca e drawer
   de detalhe de uma tarefa concluída.
2. Tela de Estoque em produção: busca, abas Gavetas/Lista/Por moto/Organograma,
   filtros, resumo, gaveta com variantes, unidade individual e criação de
   gaveta sem submissão.
3. Dashboard, Frete, Mercado Livre, Vendas, Orçamentos, Caixa, Clientes e
   Configurações: entrada, hierarquia inicial, controles e semântica publicada.
4. Mobile em 390 x 844 px: Tarefas, Estoque, Vendas e Caixa.
5. Código: 171 componentes de produto sem arquivos de teste (15
   compartilhados, 46 UI, 30 gráficos Bklit e 80 por domínio); 54 têm teste
   direto correspondente. Foram verificados padrões de ação, formulários,
   overlays, tabs, navegação, rolagem e componentes muito extensos.

## 3. Achados

### UX-01 — Estoque não compartilha o modelo de detalhe da Torre de Operações

- Categoria / severidade: consistência e fluxo / **P1**.
- Evidência: **confirmado**.
- Observado: ao abrir uma tarefa, o drawer lateral traz contexto, status,
  responsável, prazo, métricas, instruções, checklist, histórico e próxima
  ação. A unidade do estoque abre uma ficha/formulário compacto com preço,
  grau, origem, endereço e aviso de foto.
- Esperado: cada unidade deve abrir no mesmo drawer de Tarefas: cabeçalho de
  contexto, estado, bloco de identificação, fotos, localização, condição,
  valor, compatibilidade/origem quando conhecida, histórico e ações.
- Impacto: quem está atendendo encontra dados sem ter uma ordem de leitura ou
  certeza de qual ação é a próxima; quem organiza não enxerga a evolução da
  unidade.
- Evidência concreta: produção, gaveta `MESA COMPLETA CG 125`; drawer de tarefa
  `MATAR A START 150`; código local em
  `src/features/estoque-preview/InventoryUnitDrawer.tsx`.
- Recomendação: criar um único `OperationalDetailDrawer`, usando a composição
  de Tarefas como base. No desktop, drawer lateral; no mobile, sheet quase
  total com cabeçalho e rodapé fixos. O formulário de edição vira um modo dentro
  do drawer, não a ficha inteira.
- Decisão humana: não. Seguro implementar diretamente após aprovar a nova
  preview de Estoque.

### UX-02 — A organização do legado aparece como uma lista longa, não como uma fila de trabalho

- Categoria / severidade: organização / **P1**.
- Evidência: **confirmado**.
- Observado: há 234 itens “aguardando organização” exibidos após as gavetas;
  cada item repete etiquetas de legado, preço, foto e unidade.
- Esperado: uma fila de organização com prioridade compreensível, por exemplo
  “sem localização”, “ficha incompleta”, “sem foto própria”, “sem preço” e
  “com avaria”, mostrando primeiro a causa que impede vender ou localizar.
- Impacto: a equipe precisa varrer muitos cartões para descobrir o próximo
  passo; as etiquetas alertam, mas não organizam o trabalho.
- Evidência concreta: estoque publicado informa 264 variantes, 608 unidades e
  234 itens não agrupados.
- Recomendação: manter a lista como visualização excepcional e criar uma fila
  prioritária no padrão de Tarefas. Seleção em lote deve abrir uma ação clara:
  “organizar X unidades”, com destino, categoria e motivo de pendência.
- Decisão humana: não. Seguro para a preview; qualquer migração automática de
  dados continua exigindo revisão humana.

### UX-03 — Cartões de estoque carregam informação demais antes da decisão

- Categoria / severidade: hierarquia / **P2**.
- Evidência: **confirmado**.
- Observado: um cartão mistura nome, categoria, variantes, ficha pendente,
  foto legada, preço/range, unidades e até marcador “+1”.
- Esperado: primeiro nome, disponibilidade/localização e um sinal de atenção;
  detalhes restantes devem estar no drawer ou em uma expansão deliberada.
- Impacto: a leitura no balcão fica lenta, sobretudo na lista extensa.
- Evidência concreta: cartões de `TAMPA DO CUBO`, `TANQUE` e itens legados na
  rota publicada `/estoque`.
- Recomendação: usar três densidades: resultado de busca (uma linha), card de
  família (resumo) e unidade no drawer (detalhe completo). Nunca mostrar os
  três níveis no mesmo cartão.
- Decisão humana: não. Seguro implementar na preview.

### UX-04 — Semântica de ações é inconsistente em listas operacionais

- Categoria / severidade: acessibilidade / **P1**.
- Evidência: **confirmado no código**.
- Observado: linhas clicáveis em `VendasView` e `TransactionList` são `div`
  com `onClick`.
- Esperado: ação primária de abrir registro deve ser `button` ou link com foco,
  nome acessível e Enter/Espaço.
- Impacto: teclado, leitor de tela e foco visível ficam incompletos em áreas
  que exigem velocidade operacional.
- Evidência concreta: `src/features/vendas/VendasView.tsx:173` e
  `src/components/ui/TransactionList.tsx:112`.
- Recomendação: normalizar `OperationalListRow` sem alterar a aparência.
- Decisão humana: não. Seguro implementar diretamente por área, com validação
  de foco e cliques internos.

### UX-05 — O drawer de unidade não completa o ciclo de acessibilidade e edição

- Categoria / severidade: acessibilidade e formulários / **P1**.
- Evidência: **confirmado no código**.
- Observado: o drawer local de unidade é um `aside role="dialog"`, sem
  `aria-modal`, sem foco inicial/restauração explicitamente garantidos, sem
  rodapé fixo e com `select` nativo para grau.
- Esperado: o mesmo primitive de drawer/dialog já usado na Torre, com foco,
  Escape, backdrop, rolagem interna, ações fixas e seletor coerente.
- Impacto: edição lenta em mobile e risco de perder contexto ao rolar uma
  ficha longa.
- Evidência concreta: `src/features/estoque-preview/InventoryUnitDrawer.tsx`.
- Recomendação: substituir pelo primitive compartilhado e manter o estado de
  edição dentro do drawer de detalhe.
- Decisão humana: não. Seguro implementar na preview.

### UX-06 — O sistema tem uma boa base light, mas há superfícies que ainda não a aplicam

- Categoria / severidade: design system / **P1**.
- Evidência: **confirmado**.
- Observado: Tarefas publicadas usa a referência light; Estoque publicado e o
  preview local não reproduzem de forma integral seu cabeçalho, navegação,
  densidade, cartões e padrão de detalhes.
- Esperado: mesma família visual e comportamental, sem copiar layout de
  Tarefas quando a decisão operacional for outra.
- Impacto: o usuário reaprende o sistema a cada domínio e o Estoque parece uma
  ferramenta separada.
- Evidência concreta: referência visual fornecida e rotas publicadas
  `/tarefas` e `/estoque`.
- Recomendação: definir primitives obrigatórios: `AppHeader`, `PageIntro`,
  `ViewTabs`, `SummaryMetric`, `OperationalCard`, `OperationalDetailDrawer`,
  `StatusChip` e `BottomNavigation`.
- Decisão humana: não. Seguro iniciar na preview e migrar por domínio.

### UX-07 — Mobile preserva a página, mas ainda tem alvos pequenos

- Categoria / severidade: responsividade / **P2**.
- Evidência: **confirmado**.
- Observado: em 390 px não houve rolagem horizontal da página em Tarefas,
  Estoque, Vendas ou Caixa. Porém a inspeção encontrou alvos visíveis menores
  que 44 px, especialmente em Vendas e Caixa.
- Esperado: todo alvo efetivo de toque deve ter ao menos 44 x 44 px, mesmo
  quando o ícone ou texto parecer menor.
- Impacto: toque impreciso em balcão e em celular.
- Evidência concreta: viewport 390 x 844; Vendas e Caixa apresentaram a maior
  concentração de controles menores.
- Recomendação: ampliar área de toque invisível, não necessariamente o visual;
  priorizar filtros, ações de linha e ícones da navegação.
- Decisão humana: não. Seguro implementar depois de medir cada alvo real.

### UX-08 — A faixa horizontal de resumo de Tarefas exige uma affordance mobile explícita

- Categoria / severidade: responsividade / **P2**.
- Evidência: **risco provável**.
- Observado: a região “Resumo do turno” tem 920 px de largura de conteúdo em
  viewport de 390 px; a página em si não transborda.
- Esperado: como essa é uma exceção permitida para métricas, deve haver fade de
  borda, item ativo visível e resposta por toque/roda, sem esconder conteúdo.
- Impacto: usuário pode não perceber que existem métricas fora da primeira
  área visível.
- Evidência concreta: inspeção de viewport; não foi verificada visualmente a
  affordance de rolagem.
- Recomendação: validar o trilho em aparelho físico antes de considerar o
  padrão pronto.
- Decisão humana: não. Seguro implementar se a affordance não existir.

### UX-09 — Componentes extensos concentram regras e dificultam consistência

- Categoria / severidade: manutenção de UX / **P2**.
- Evidência: **confirmado no código**.
- Observado: há componentes de 800–2.125 linhas em Estoque, Tarefas, Mercado
  Livre, Orçamentos, Clientes e Dashboard.
- Esperado: tela orquestra; componentes menores cuidam de cada decisão,
  incluindo estados vazios, drawer, filtros e cards.
- Impacto: correções de UX repetem lógica e a identidade visual diverge com o
  tempo.
- Evidência concreta: `EstoqueView.tsx` (1.997), `TasksPreview.tsx` (2.125),
  `MercadoLivreView.tsx` (1.137), `OrcamentosView.tsx` (1.113) e outros.
- Recomendação: extrair primitives visuais antes de reescrever páginas; não
  iniciar uma nova coleção de componentes paralelos.
- Decisão humana: não. Seguro começar pelo Estoque novo.

## 4. Backlog priorizado

1. **Correções imediatas**
   - Criar `OperationalDetailDrawer` e migrar a unidade de estoque para ele.
   - Transformar “itens não agrupados” em fila priorizada de organização.
   - Corrigir linhas `div onClick` que abrem registros.

2. **Melhorias importantes**
   - Reorganizar cartões de família, variante e unidade em três densidades.
   - Padronizar cabeçalho, tabs, chips e navegação do Estoque com Tarefas.
   - Ajustar alvos de toque em Vendas e Caixa.

3. **Funcionalidades recomendadas**
   - Ação em lote “organizar unidades” com destino físico e motivo de
     pendência.
   - Histórico por unidade: cadastro, foto, preço, localização, venda/reserva
     e edição.
   - Uma visualização Bklit de capacidade/pendências somente quando responder
     uma pergunta concreta, como “onde está o gargalo de organização?”.

4. **Refinamentos futuros**
   - Decompor telas extensas em primitives e módulos de domínio.
   - Expandir testes diretos dos componentes operacionais de maior risco.

## 5. Alterações realizadas

Nenhuma tela, dado ou regra de negócio foi modificada.

Foi acrescentado à skill interna `ux-user-audit` o critério generalizável de
**linha operacional acionável**, pois foram confirmadas linhas primárias em
`div onClick`. Ele exige `button`/link, foco visível, nome acessível e suporte
de teclado para qualquer ação de abrir ou executar um registro.

## 6. Pendências e riscos

- Não foram submetidos formulários, excluídas informações, reabertas tarefas,
  alterados filtros persistentes nem executados fluxos com efeito em produção.
- Estados de erro, falta de conexão, permissões e conflito de edição precisam
  de ambiente controlado.
- A migração física das gavetas não deve ser automatizada; o sistema novo deve
  aceitar categorias e endereços vazios até a organização real acontecer.
- Anime.js, Bklit e DotMatrix já existem no projeto. Devem apoiar decisão e
  feedback, não decorar listas: Anime.js para transições coordenadas; Bklit
  para gráficos de pergunta operacional; DotMatrix em um único sinal de
  sincronização/criticidade ou no progresso do desmonte.

## 7. Próximos passos

1. Refatorar visualmente a preview de Estoque usando a identidade light.
2. Implementar primeiro o drawer de detalhe de unidade no padrão de Tarefas.
3. Construir a fila de organização sobre os dados reais já integrados.
4. Validar em desktop e 390 px antes de substituir a rota `/estoque`.
