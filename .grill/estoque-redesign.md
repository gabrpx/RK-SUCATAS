# Grill-me — estoque redesign

Data: 2026-09-21

## Decisões confirmadas

- O novo método é criado do zero e organiza o estoque como Peça, Unidade e Lote; não é uma camada visual sobre Gavetas.
- Compatibilidade pendente deixa a peça visível apenas para a equipe de estoque, em triagem, e nunca pronta para atendimento.
- Apenas equipe treinada de estoque/catálogo confirma compatibilidade; atendimento pode solicitar revisão.
- Cada compatibilidade confirmada registra uma origem simples: catálogo, comparação física ou experiência da equipe. Observação curta é opcional.
- Orçamento ou conversa no WhatsApp não reserva uma unidade. Reserva exige sinal de 20%.
- Reserva com sinal dura sete dias corridos. Um dia antes há alerta; ao vencer, vai para revisão do responsável, sem liberação automática.
- O responsável pode escolher nova data ao estender a reserva e deve registrar o motivo.
- A retirada temporária da prateleira para mostrar ao cliente não cria estado especial.
- Entrada começa em RECEBIMENTO ou TRIAGEM. Somente unidade com endereço físico definitivo pode estar pronta para atendimento.
- Endereço físico é curto e padronizado, como A-03. RECEBIMENTO, TRIAGEM e AVALIAÇÃO não deixam a unidade disponível.
- Qualquer pessoa autorizada pode mudar a localização física, com histórico de quem fez e quando.
- Busca atende pedidos por nome, foto eventualmente e categorias vagas. Será híbrida: ampla inicialmente e orienta o atendente a perguntar a moto.
- Busca mostra nome, motos compatíveis, quantidade pronta e preço inicial sem abrir o item.
- Reserva aparece como Reservada com tempo restante e não pode ser oferecida ou vendida.
- Na abertura da tela, prioridade operacional é reservas próximas do fim e peças que precisam ser organizadas.
- Nomes antigos permanecem como apelidos pesquisáveis, mas a tela exibe o termo novo e padronizado.
- Foto antiga de variante nunca é promovida automaticamente a foto oficial da unidade, mesmo quando existe uma única unidade.
- Custo do lote é o valor pago pela moto no leilão. É desejável, porém opcional; ausência vira pendência e não bloqueia entrada/venda.
- Migração começa por motos de maior saída, como CG 125, CG 150 e CG 160. Itens não migrados ficam internos como "precisa organizar", fora da oferta pronta.
- A prévia será uma view separada, interativa e sem acesso/escrita em dados reais; utilizará dados fictícios coerentes com a operação.

## Próximo passo possível

Criar uma view de prévia interativa do novo estoque, com dados fictícios, isolada do estoque atual. Antes de integrar ao sistema real, definir o modelo técnico final de mídia e executar auditoria do banco/Storage para contar URLs, referências, arquivos ausentes, duplicidades e órfãos.
