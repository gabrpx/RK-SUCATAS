# Clientes — recuperação operacional e alinhamento visual

## Objetivo

Manter a lista e a ficha de Clientes utilizáveis quando o resumo operacional não responder, transformar Agenda em uma leitura das tarefas de visita existentes e alinhar o cabeçalho às referências de Estoque e Tarefas.

## Escopo

- Separar a carga do resumo e da lista operacional de Clientes.
- Quando a capability operacional ainda não existir, usar a listagem cadastral já contratada pela API, sem criar métricas artificiais.
- Reutilizar `Tarefa.tipo === 'visita'` para uma Agenda de leitura; não criar um segundo registro de visita.
- Ajustar `ClientesHeader` para tabs com largura de conteúdo e ações sem largura forçada.

## Fora do escopo

- Schema, migrations, RLS, RPCs, reservas, matching, criação/edição de visita e mudanças em Tarefas.
- Resolver a indisponibilidade local da API Express ou alterar `node_modules/.vite`.

## Critérios de aceite

- Falha do resumo não bloqueia a lista operacional quando ela responde.
- A indisponibilidade da capability operacional mantém a listagem cadastral acessível.
- Agenda mostra tarefas de tipo `visita`, com vazio e erro recuperáveis.
- Tabs e CTAs seguem a largura de conteúdo, preservando toque, teclado e rolagem horizontal contida.
- Testes focados, build e revisão de diff registram evidências.

## Riscos e parada

- O fallback não pode fabricar métricas, status ou visitas inexistentes.
- Parar antes de qualquer alteração de contrato da API, banco ou regras de reservas.
