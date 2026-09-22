# Alinhamento do Estoque Preview — Peça, Unidade e Origem Desconhecida

## Objetivo

Reconstruir a prévia isolada `/estoque-preview` para espelhar a Tela 1 do Stitch e explicar o método de estoque aprovado: uma Peça canônica contém várias Unidades físicas individuais.

## Modelo de organização

- **Peça** responde “o que é isto?” e não usa a moto doadora no nome. Seu tipo é padronizado para impedir duplicidade.
- **Unidade** é cada objeto físico; possui foto própria, SKU, grau, preço, endereço, estado e origem individual.
- **Origem desconhecida** é válida. A unidade não é bloqueada nem recebe uma moto inventada; o lote/origem fica como “Não identificada”.
- **Categoria da seção física** é diferente do tipo da Peça. É livre, definida pela equipe ao preencher `Pxx-Sxx`, e apenas ajuda a guardar/encontrar no galpão.
- Uma unidade sem foto ou compatibilidade confirmada aparece em triagem e não é oferecida no atendimento. Ausência de origem, sozinha, não a bloqueia.

## Estrutura da interface

1. Cabeçalho, breadcrumb e escala tipográfica iguais à Tela 1 de Tarefas: Geist/Inter, sem mono.
2. Abas: **Atendimento**, **Desmonte e triagem** e **Mapa físico**.
3. Atendimento é a visão inicial: busca por Peça ou moto compatível e cards de Peça agrupados por área.
4. Abrir uma Peça revela suas Unidades comparáveis, com foto, preço, grau, endereço, origem e reserva de 20% por sete dias corridos.
5. Desmonte e triagem concentra itens sem foto/compatibilidade e também deixa explícita a origem desconhecida sem tratá-la como erro.
6. Mapa físico permanece vazio na prévia, exceto pelas interações locais de demonstração; suas 88 seções começam sem categoria.

## Limites

É uma prévia com dados fictícios, sem banco, API, dados reais, migration ou mudança em `/estoque`. Nenhuma categoria pré-definida será persistida nesta etapa.
