# Cabeçalho do estoque em componentes independentes

**Status:** opção 04 (Controle) selecionada provisoriamente  
**Data:** 2026-09-11

## Objetivo

Construir o cabeçalho da área de estoque com componentes separados, para que cada parte possa ser desenhada, testada e aprovada individualmente antes da composição final.

## Motivo

As versões anteriores do seletor de visualização — controle segmentado, dropdown e abas sublinhadas — não foram aprovadas. Em 2026-09-11, a alternativa 04 (Controle) foi escolhida como solução provisória, mantendo as demais alternativas isoladas para avaliação futura.

## Componentes a separar

1. `EstoqueHeader` — título, contexto e hierarquia principal.
2. `EstoquePrimaryAction` — ação principal contextual (`Nova gaveta` ou `Nova peça`).
3. `EstoqueViewSwitcher` — troca entre Gavetas, Lista, Por moto e Organograma.
4. `EstoqueTodaySummary` — peças cadastradas e valor somado hoje.
5. `EstoqueToolbar` — sincronizar, importar, exportar e fundir, quando aplicável.

Os nomes são provisórios e devem respeitar as convenções encontradas no projeto durante a implementação.

## Processo de decisão

Cada componente deve ser apresentado e aprovado isoladamente, nesta ordem:

1. Cabeçalho e ação principal.
2. Seletor de visualização.
3. Resumo do dia.
4. Ações secundárias.
5. Composição completa em mobile.
6. Adaptação para desktop.

Não avançar automaticamente de uma etapa visual para a próxima sem aprovação do usuário.

## Critérios gerais

- Exibir apenas um cabeçalho `Estoque`.
- Não duplicar métricas, ações ou navegação.
- Preservar todas as visualizações existentes.
- Priorizar mobile em 375 px e manter boa adaptação ao desktop.
- Usar tokens e componentes existentes; Animate UI pode ser usado quando a animação melhorar a compreensão.
- Respeitar `prefers-reduced-motion`.
- Não alterar backend, banco, migrations, contratos ou regras de negócio.
- Não misturar esta decisão visual com as correções funcionais já realizadas em gavetas.

## Decisões pendentes

- Formato do seletor de visualização.
- Posição do seletor em relação ao título e à busca.
- Quais ações ficam sempre visíveis no mobile.
- Forma e prioridade visual do resumo do dia.
- Diferenças aceitáveis entre mobile e desktop.

## Validação esperada

- Comparação visual em 375 px e desktop.
- Teste de existência de um único cabeçalho.
- Navegação por teclado e indicação acessível da opção ativa.
- Ausência de overflow horizontal da página.
- Verificação das quatro visualizações e dos estados vazio, carregando e erro.
