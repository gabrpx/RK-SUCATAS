# Grill: vendas e gestão financeira unificadas
Date: 2026-09-28

## Intent
Criar uma aba Vendas como centro operacional e financeiro da empresa, reunindo vendas, Caixa, recebimentos e pendências numa experiência única e profissional. A identidade visual de referência é especificamente **“Tarefas Abertas e Tarefas — Tela 1”**.

## Constraints
- Desktop e mobile recebem a mesma atenção.
- Entradas e saídas aparecem juntas em Movimentações; Pendências tem visão própria.
- Vendas ligam clientes, peças/unidades de estoque, várias formas de pagamento e comprovante Pix.
- Pendências incluem valores a receber e contas a pagar da empresa, pagamentos parciais e contas recorrentes semanais, mensais ou anuais.
- Venda sem primeiro pagamento não recebe vencimento manual; envelhece desde a venda e passa a atrasada automaticamente em 30 dias. Depois de pagamento parcial, equipe define novo prazo e o atraso segue esse vencimento.
- Lembretes são para a equipe, nunca enviam cobrança ao cliente. Destaque animado contínuo termina ao marcar “Cobrança tratada”.
- Unificar a tela não deve ampliar permissões financeiras nem quebrar atomicidade dos fluxos existentes de vendas, estoque e caixa.

## Key decisions
- Decisão: tabs Visão geral, Vendas, Movimentações e Pendências, iniciando em Visão geral. Motivo: dar visão própria a cada trabalho e manter finanças num centro unificado. Alternativas: painéis expansíveis ou workspace dividido.
- Decisão: visão geral mostra vendas do período, saldo atual de caixa, total a receber e total vencido; alerta cobranças e contas a pagar próximas do vencimento.
- Decisão: gráficos iniciais mostram tendência das vendas com comparação, entradas/saídas/saldo líquido juntos e idade das pendências por vence em breve, 1–7, 8–30 e 30+ dias.
- Decisão: vendas usam cadastros existentes de Clientes e Estoque, aceitam múltiplas formas de pagamento por venda e suportam comprovante Pix.
- Decisão: cada recebimento parcial reduz o saldo; recebimentos subsequentes podem usar outros métodos. Após pagamento parcial, equipe define o novo vencimento.
- Decisão: a lista de Movimentações é cronológica e conjunta para todas as entradas e saídas concluídas.
- Decisão: contas a pagar são adicionadas com vencimento, aceitam pagamentos parciais e recorrência semanal, mensal ou anual.
- Decisão: seguir a identidade visual de “Tarefas Abertas e Tarefas — Tela 1”, mantendo a organização própria de Vendas.
- Decisão: não incluir lucro/margem sem fonte e regra de cálculo confirmadas.

## Surfaced assumptions
- Saldo de caixa e gráficos terão de usar fontes atuais consistentes, sem dupla contagem entre vendas, recebimentos, pendências e reversões.
- “Cobrança tratada” encerra apenas o destaque do lembrete, não a dívida.

## Open questions
- Mapear permissões separadas de Vendas, Caixa e recebimentos sem ampliar acesso financeiro.
- Definir compatibilidade/navegação da atual aba Caixa após integração.
- Avaliar contrato/persistência de pagamento dividido e contas recorrentes sem substituir atomicidade das RPCs atuais.
- Confirmar origem do saldo atual de caixa e se contas a pagar também recebem lembretes internos.
- Confirmar momento do comprovante Pix (na venda, depois ou ambos).

## Out of scope
- Implementação de código, migration, mudança em RPC/permissões ou alteração de dados nesta etapa.
- Envio automático de cobranças ao cliente.
- Cálculo de lucro/margem sem regra e fonte de custo confirmadas.
