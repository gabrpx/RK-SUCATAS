# Grill: galeria de fotos e unidades no estoque novo
Date: 2026-09-24

## Intent
Exibir corretamente todas as fotos disponíveis no detalhe da unidade e deixar acessíveis todas as unidades agrupadas por peça no estoque novo, com interação horizontal clara e sem barras de rolagem.

## Constraints
- A unidade usa primeiro as fotos próprias; se não tiver, o drawer pode recorrer às fotos gerais do produto e deve identificá-las como “Fotos do produto”.
- A miniatura do card usa somente foto própria; sem ela, mostra “Sem foto”.
- A galeria usa foto principal com a próxima parcialmente visível, fade horizontal e indicadores animados em pontos, sem números.
- Proporção responsiva 4:3 e `object-contain`, com fundo neutro, para preservar o quadro inteiro.
- Fileira de unidades sem barra, com fade, gesto horizontal e roda vertical do mouse movendo para os lados; teclado também navega.
- Unidades não arquivadas, inclusive reservadas e para organizar, ficam em ordem Grau A, B, C; empates preservam a ordem atual.

## Key decisions
- Decisão: mostrar primeira foto própria como miniatura e o carrossel completo no drawer. Razão: cards continuam compactos e os detalhes dão acesso à galeria. Alternativa considerada: várias fotos no card.
- Decisão: usar fotos gerais do produto apenas como fallback no drawer. Razão: manter detalhes úteis sem sugerir que o exemplar foi fotografado. Alternativa considerada: exibir “Sem foto”.
- Decisão: foto geral não preenche a miniatura do card. Razão: não confundir identidade visual do produto com registro fotográfico da unidade.
- Decisão: ordenação por grau A → B → C para todas as unidades não arquivadas. Razão: priorizar condição e manter estados operacionais visíveis.
- Decisão: usar pontos apenas na galeria de fotos, sem contadores numéricos. Razão: indicar posição sem adicionar texto visual.

## Surfaced assumptions
- Notas de condição atuais são convertidas em graus: 8–10=A, 5–7=B, abaixo de 5=C.
- O usuário confirmou que as fotos em questão foram anexadas às fichas individuais no sistema anterior.
- A API do estoque inclui as fotos próprias de cada ficha; a adaptação da tela antes reduzia a lista a uma URL. O modelo agora preserva todas para a galeria.

## Open questions
- Uma validação com uma unidade real identificada ainda pode confirmar se os URLs existentes carregam no navegador; os testes locais validam o transporte e a renderização do modelo.

## Out of scope
- Alterar armazenamento, contratos de API ou banco de dados sem necessidade confirmada.
