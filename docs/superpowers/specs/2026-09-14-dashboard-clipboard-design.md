# Especificação: clipboard de fotos e evolução do dashboard

## Objetivo

Dar ao operador uma forma segura de copiar fotos reais das peças para colar em chats e reorganizar o dashboard para que informação operacional importante seja encontrada rapidamente, sem duplicação de métricas ou perda de contexto.

## Decisões de produto

### Clipboard de fotos

- A ação começa explicitamente pelo usuário em uma variante ou unidade.
- O usuário escolhe entre `Copiar todas` e `Escolher fotos`.
- A seleção mostra miniaturas, origem da foto e estado selecionado.
- A ordem é determinística: fotos próprias da unidade primeiro; fotos legadas da variante depois, quando forem exibidas como referência naquele contexto; URLs repetidas são deduplicadas.
- A ação apenas coloca imagens no clipboard. O envio ao chat continua sendo feito pelo usuário ao colar.
- O sistema informa claramente quando o navegador ou o chat não aceita múltiplas imagens de uma vez e oferece uma alternativa controlada, sem falhar silenciosamente.

### Dashboard

- A primeira tela prioriza operação: valor em estoque, vendas do período, alertas de estoque baixo e pendências financeiras.
- A visão executiva continua disponível, mas não deve duplicar a mesma informação nem empurrar alertas críticos para o fim da página.
- Cada métrica deve ter período, fonte e estado de atualização compreensíveis.
- Desktop e mobile devem preservar nomes, números e ações sem clipping horizontal.
- Falhas de carregamento devem ser visíveis, recuperáveis e diferenciadas de estado vazio.

## Fora de escopo

- Envio automático de mensagens ou integração com WhatsApp/Instagram.
- Alteração de schema, migrações, RLS ou dados reais.
- Exposição da service role do Supabase no navegador.
- Reescrita completa da navegação ou troca de biblioteca de componentes.
