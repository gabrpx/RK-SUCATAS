# Fontes de componentes UI

Este projeto usa uma estratégia copy-first e modular para componentes visuais. Cada componente incorporado passa a ser código do projeto, deve ser revisado localmente e não deve ser atualizado automaticamente sem análise do diff.

## Fontes e uso recomendado

### Animate UI

- Integração: registry compatível com shadcn, usando o namespace `@animate-ui`.
- Melhor uso: microinterações de controles, tabs, dialogs, sheets, estados de entrada/saída e ícones animados.
- Regra: usar movimento para confirmar ação, orientar navegação ou explicar mudança de estado. Não animar tabelas inteiras ou fluxos críticos a cada atualização.
- Compatibilidade esperada: React 19, Tailwind CSS 4 e Motion 12+, já presentes no projeto.

### Bklit UI

- Integração: registry compatível com shadcn, usando o namespace `@bklit`.
- Melhor uso: gráficos e visualizações analíticas, especialmente capacidade, gargalos, SLA e tendências.
- Regra: escolher o gráfico pela pergunta de negócio. Não usar gráficos decorativos em telas de execução.
- Dependências existentes: Recharts já faz parte do projeto; conferir o código gerado e o bundle antes de adicionar dependência redundante.

### UILora

- Integração: copiar o código-fonte do componente escolhido a partir do Code Explorer.
- Não existe registry oficial configurado neste projeto.
- Melhor uso: uma interação de destaque por fluxo, como entrada de modo foco, transição de painel ou feedback de conclusão.
- Regra: não adicionar backgrounds WebGL, Three.js ou múltiplas animações pesadas sem necessidade comprovada. Priorizar variantes leves em mobile.
- Licença: preservar atribuição e metadados do componente quando aplicável; não redistribuir UILora como uma biblioteca independente.

### Dot Matrix / dot-anime-react

- Integração: pacote npm `dot-anime-react`.
- Melhor uso: sinalização compacta de estado, indicador de sincronização, status de turno ou elemento de identidade visual da Torre de Operações.
- Regra: não usar como decoração constante nem em listas repetitivas. Respeitar `prefers-reduced-motion` e desativar loop em estados inativos.

### Registro de uso — prévia de tarefas

- Bklit UI: os primitivos locais de área, grid, eixo e tooltip são usados no gráfico de ritmo operacional em `src/features/tarefas-preview/TasksPreview.tsx`.
- UILora: o drawer de detalhes usa a convenção de painel/modal com entrada por spring, adaptada localmente a partir do padrão de componentes de modal da UILora, sem importar pacote ou adicionar dependência.
- Dot Matrix: sinaliza a sincronização no cabeçalho, fora de listas repetitivas.
- Anime.js: revela apenas os blocos principais na troca de tela e é suprimido com `prefers-reduced-motion`.

### Anime.js

- Integração: pacote npm `animejs`.
- Melhor uso: timelines coordenadas, contadores, progressões e animações imperativas que envolvam múltiplos elementos.
- Regra: encapsular cada uso em hook ou componente local, limpar instâncias no unmount e preferir transform/opacity a propriedades que causem layout.

## Ordem de decisão

1. Componente estático e acessível: usar o componente existente mais simples.
2. Controle com microinteração: procurar primeiro Animate UI.
3. Gráfico ou visualização: procurar primeiro Bklit UI.
4. Efeito visual de destaque: avaliar UILora, somente com justificativa de produto.
5. Timeline coordenada ou animação procedural: avaliar Anime.js.
6. Indicador visual pontual em matriz de pontos: avaliar Dot Matrix.

## Critérios para incorporar uma fonte

- O componente resolve uma necessidade real de produto.
- O código é compatível com React 19, TypeScript e Tailwind CSS 4.
- Não duplica um componente já incorporado.
- Possui estado de carregamento, erro, vazio e acessibilidade adequados.
- Funciona em viewport mobile antes de receber refinamentos de desktop.
- A animação pode ser desativada ou reduzida.
- O impacto de bundle é compreendido.
- A origem e a versão ficam registradas no diff/documentação.
