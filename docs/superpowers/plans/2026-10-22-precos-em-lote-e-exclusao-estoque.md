# Preços em lote e exclusão integral no estoque

## Objetivo

No resumo de uma peça, permitir definir de uma vez os preços das unidades sem valor, agrupados pelo grau realmente existente, e remover definitivamente cadastros de estoque com confirmação explícita.

## Escopo e arquitetura

- `InventoryPieceSummaryDrawer`: ação progressiva de preços, formulário dinâmico por grau e ação destrutiva separada.
- `EstoquePreview`: persistência usando os endpoints existentes, atualização imediata do estado e diálogo de confirmação.
- `inventoryPreviewModel`: remoção imutável da peça e de suas unidades no modo demonstrativo.
- Testes do drawer e do fluxo real para preços, seleção dinâmica de graus e exclusão.

## Critérios de aceite

- O botão de preço geral aparece somente com duas ou mais unidades editáveis sem preço.
- O formulário mostra somente A, B e/ou C quando houver unidade sem preço daquele grau.
- Um valor concluído é aplicado somente às unidades sem preço do grau correspondente; preços existentes são preservados.
- A lista mostra imediatamente o novo valor ao lado do grau correto.
- É possível excluir definitivamente uma peça, inclusive um cadastro com zero unidades, mediante permissão e confirmação.
- Loading, erro, teclado, foco, mobile e `prefers-reduced-motion` permanecem tratados.

## Riscos e mitigação

- Atualizações de várias fichas usam chamadas independentes já existentes; em falha parcial, recarregar o estoque para refletir o servidor e manter o formulário aberto.
- Exclusão é irreversível; exigir confirmação contextual e a permissão `estoque.deletar` já validada também pelo backend.
- Não alterar schema, RLS, autenticação ou dependências.

## Validação

- Testes direcionados do drawer e de `EstoquePreview`.
- `npm run lint`, `npm run build`, `git diff --check`.
- Inspeção em navegador nos viewports desktop e 375 px e verificação do console; revisão do caminho de movimento reduzido no código.
