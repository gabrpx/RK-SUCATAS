# Grill: refinamento visual da preview de Vendas
Date: 2026-09-29

## Intent
Deixar a preview de Vendas mais clara, bonita e funcional, seguindo a identidade visual já estabelecida em Estoque e Tarefas.

## Constraints
- Usar a paleta, os tokens, os componentes e os padrões de interação existentes em Estoque/Tarefas; manter o tratamento claro restrito à preview.
- A preview continua demonstrativa. Datas, pagamentos e produtos adicionados para ilustrar a interface são fictícios; não ligar os fluxos a dados financeiros reais nesta rodada.
- Não reformular a tela Clientes agora. Nome de cliente na venda fica sem ação; a abertura de informações gerais com tooltip é proposta para depois da reformulação dessa tela.
- Preservar Movimento reduzido, foco visível, comportamento responsivo e apenas uma ação preenchida de acento por view.

## Key decisions
- Decisão: os cards informativos de Vendas adotam o mesmo hover sutil de Estoque/Tarefas, sem animação de elevação diferente. Razão: coerência entre as telas.
- Decisão: Pix e débito/crédito usam ícones descritivos. Mercado Livre é origem/canal, não meio de pagamento; vendas desse canal usam seu símbolo e contorno amarelo estático com animação discreta ao interagir.
- Decisão: remover o efeito magnético que segue o ponteiro do CTA Nova venda e manter feedback simples de hover/press.
- Decisão: Nova venda, saída, conta, recebimento e cobrança manual abrem drawers laterais; formulários longos mantêm ações no rodapé durante a rolagem. Diálogos continuam adequados a confirmações rápidas.
- Decisão: detalhes da venda priorizam estado e resumo financeiro. Em saldo parcial, saldo em aberto é o valor principal; quitada destaca o total recebido. Incluir data relativa do vencimento e dias de atraso, histórico demonstrativo de pagamentos (meio/valor/data), miniatura da peça, código e condição da unidade.
- Limite de dados da preview: como as vendas fictícias não correspondem às unidades/fotos de Estoque, não inventar imagens de produto; manter um espaço de miniatura honesto com o estado “Sem foto”.
- Decisão: busca permanece visível; situação, canal e meio de pagamento usam chips visíveis; canal e meio admitem seleção múltipla. Período, cliente e peça ficam em “Mais filtros”. Filtros ativos têm remoção individual e “Limpar filtros”; vazio filtrado explica o motivo e oferece limpeza.
- Decisão: saídas usam sinal negativo, ícone direcional, cor semântica negativa e borda discreta em superfície neutra; entradas mantêm tratamento positivo.
- Decisão: vencidas usam perigo/vermelho, vencimento próximo usa aviso/âmbar e pendências sem urgência ficam neutras, sempre com rótulo textual. Vencimento hoje é “Vence hoje”; os demais prazos usam texto relativo.
- Decisão: substituir o aviso “Uma pendência pede atenção” por um cartão de ação na identidade de Estoque/Tarefas, com quantidade, itens mais urgentes e CTA. Mostrar recebíveis vencidos e contas vencidas ou com vencimento em até sete dias, em ordem de urgência e até dois itens.
- Decisão: ícones de pagamento e selo/canal do Mercado Livre aparecem na lista e no detalhe da venda.

## Surfaced assumptions
- A preview pode representar eventos de pagamento e imagens com dados explicitamente demonstrativos; o fluxo real precisará de contratos/fontes de dados definidos separadamente.
- Reutilizar o drawer claro compartilhado de Estoque não altera o comportamento ou os tokens globais das telas reais.

## Out of scope
- Reformular a tela Clientes ou abrir agora detalhes de cliente a partir de Vendas.
- Alterar APIs, RPCs, permissões, banco, caixa real ou integrar gravações nesta preview.
- Instalar bibliotecas de ícones ou novas dependências para alcançar o visual descrito.
