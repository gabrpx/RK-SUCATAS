# Aba Vendas e gestão financeira unificadas — proposta de design

Data: 2026-09-28
Status: proposta de produto em revisão. Existe um preview demonstrativo para auditoria visual; fluxos financeiros reais, contratos técnicos e decisões listadas ao final continuam pendentes.

## Objetivo

Redesenhar a aba Vendas como centro operacional e financeiro do RK Sucatas. A navegação deve reunir vendas, movimentações, contas a receber e contas a pagar; a experiência atual de Caixa e Fiado não deve ficar duplicada em listas separadas. Este documento especifica produto e UI, não autoriza alterações de banco, APIs, RPCs, permissões ou dados reais.

## Referência visual obrigatória para Stitch

No Stitch, usar como referência principal e explícita a tela **“Tarefas Abertas e Tarefas — Tela 1”** do RK Sucatas. Reproduzir sua identidade visual — paleta, superfícies, tipografia, hierarquia, ritmo/espaçamento, tabs, cartões, bordas, densidade e comportamento responsivo — e não o tema preto/laranja da aba Vendas atual. Preservar os padrões visuais que tornam Tarefas e Estoque parte do mesmo sistema. Não copiar a organização por áreas de Estoque nem as áreas de Tarefas: Vendas usa as tabs próprias definidas abaixo. Criar versões desktop e mobile com a mesma importância e os mesmos recursos. Usar dados fictícios no Stitch, nunca dados de clientes ou valores reais.

## Contexto confirmado no código

- Nova Venda atual integra a base de clientes, itens/unidades de Estoque e uma forma de pagamento; a operação usa o fluxo backend que atualiza venda, estoque e caixa.
- Detalhes de venda já incluem comprovantes Pix.
- Caixa registra entradas e saídas e tem telas de pendências; Fiado acompanha recebimentos parciais com método, histórico e saldo restante.
- O app usa permissões granulares; Caixa e Vendas podem ter permissões diferentes.
- O checkout correto foi confirmado como `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`. Alterações locais preexistentes em Estoque e auxiliares foram preservadas.

## Princípios de experiência

1. Uma área única para a operação comercial e financeira.
2. Movimentações concluídas e pendências em aberto são visões distintas.
3. Entradas e saídas ficam juntas no histórico de movimentações.
4. Mostrar valor original, recebido/pago, saldo e histórico.
5. Lembretes chamam atenção da equipe; o sistema nunca envia cobrança ao cliente.
6. Desktop e mobile têm paridade, com composições adequadas a cada tela.
7. Reutilizar a identidade de **“Tarefas Abertas e Tarefas — Tela 1”** sem replicar a taxonomia de outras abas.

## Navegação

A aba principal é **Vendas**, com quatro tabs:

- **Visão geral** (aberta por padrão): KPIs, alertas e análises.
- **Vendas**: registrar e pesquisar vendas.
- **Movimentações**: histórico cronológico único de entradas e saídas.
- **Pendências**: recebíveis de clientes e contas a pagar da empresa.

## Visão geral

Exibir no topo vendas do período, saldo atual de caixa, total a receber e total vencido. Incluir seletor de período, alertas de cobranças e contas a pagar próximas do vencimento e atalhos para Nova venda, registrar movimentação e adicionar conta a pagar, respeitando permissões.

Gráficos propostos:

- Tendência de vendas comparada ao período anterior.
- Um gráfico combinado de entradas, saídas e saldo líquido.
- Envelhecimento das pendências: vence em breve, 1–7 dias, 8–30 dias e mais de 30 dias.

No mobile, gráficos compactos em cartões roláveis. Não mostrar lucro/margem até haver fonte e regra de cálculo confirmadas.

## Vendas

### Registrar

- Escolher cliente cadastrado (preservar o fluxo de venda sem cliente quando permitido pelo comportamento atual).
- Escolher peça e unidade física elegível da base de Estoque.
- Aceitar uma ou várias formas de pagamento na mesma venda, cada qual com seu valor.
- Mostrar total, valor pago e saldo a deixar pendente antes da confirmação.
- Se não houver quitação total, registrar saldo aberto ligado à venda/cliente e refletir pagamentos nas movimentações sem quebrar a atomicidade vigente de estoque e caixa.
- Disponibilizar comprovante Pix no fluxo/detalhe da venda. O momento preciso do anexo (na venda, depois ou ambos) continua em aberto.

### Consulta

Lista pesquisável com período, cliente, peça, canal e pagamento; tabela no desktop e lista/cartões no mobile. Detalhe apresenta pagamentos, saldo pendente, cliente, produto e comprovantes.

## Movimentações

Uma lista cronológica contém todas as entradas e saídas concluídas: vendas, recebimentos de dívidas, pagamentos de contas e lançamentos manuais. Cada linha identifica direção/tipo, origem, data, valor e método; quando aplicável, liga ao registro de origem. Filtros opcionais ajudam a localizar registros, sem dividir a organização principal entre entradas e saídas. Preservar trilhas de reversão e cancelamento atuais.

## Pendências

Fila única ordenada por urgência, com rótulos **A receber** e **A pagar**. Cada item exibe origem/cliente ou fornecedor, valor original, pago/recebido, saldo, idade/vencimento e histórico.

### Recebíveis

- Pagamentos parciais reduzem o saldo; cada recebimento registra a forma usada, podendo pagamentos seguintes usar outro método.
- Antes do primeiro pagamento, não há prazo manual. Mostrar dias em aberto desde a venda e classificar automaticamente como atrasada após 30 dias.
- Após pagamento parcial, a equipe define um novo vencimento do saldo; a dívida fica atrasada quando passa essa data sem quitação.
- Disponibilizar cobrança manual, incluindo WhatsApp com mensagem que a equipe revisa; nunca enviar automaticamente.
- O lembrete interno mantém destaque estático por severidade até **Cobrança tratada**. Entradas/saídas de estado podem usar movimento curto; não usar pulse contínuo. A pendência persiste até quitar. Tooltip usa hover no desktop e toque no mobile.

### Contas a pagar

- Adicionar conta com vencimento e saldo em aberto.
- Aceitar pagamentos parciais, refletidos como saídas em Movimentações.
- Permitir recorrência semanal, mensal e anual, criando cada ocorrência como pendência independente.

## Responsividade e microinterações

- Desktop: navegação horizontal por tabs, maior uso de tabelas e gráficos.
- Mobile: tabs adaptadas à largura, listas em cartões e ações com alvo de toque.
- Estados de carregamento, vazio, erro, sucesso e validação; confirmação explícita para cancelamento/reversão.
- Destaque de cobrança é estático por severidade; movimentos curtos de estado respeitam `prefers-reduced-motion`.

## Critérios de aceite do conceito

1. Vendas tem as quatro visões acordadas e inicia por Visão geral.
2. Vendas integra Clientes e Estoque, aceita pagamentos múltiplos e suporta comprovante Pix.
3. Movimentações mantém entradas e saídas numa lista cronológica única.
4. Pendências reúne recebíveis e contas a pagar, com pagamento parcial e saldo/histórico.
5. Atraso de recebível respeita 30 dias desde a venda antes do primeiro pagamento e o vencimento manual após pagamento parcial.
6. Contas a pagar suportam recorrência semanal, mensal e anual.
7. Lembretes são internos; urgência é identificada sem animação contínua e não há envio automático de mensagem.
8. KPIs e gráficos aprovados aparecem em desktop e mobile.
9. Identidade é da tela “Tarefas Abertas e Tarefas — Tela 1”; organização é própria de Vendas.
10. A interface respeita a matriz atual de permissões e não amplia acesso.

## Questões para resolver antes do plano técnico

- Mapear permissões atuais de Vendas, Caixa, receber fiado e pendências para cada tab/ação, preservando menor privilégio.
- Definir o destino de navegação da aba Caixa após integração e compatibilidade de rotas.
- Verificar RPCs atuais de venda/cancelamento e desenhar suporte a formas múltiplas sem enfraquecer atomicidade.
- Definir contrato e persistência para contas a pagar recorrentes; mudanças de schema requerem migration nova e confirmação da sequência aplicada.
- Definir fontes de verdade para saldo de caixa, recebíveis agregados e gráficos, evitando dupla contagem de venda, recebimento, pendência ou reversão.
- Decidir se contas a pagar também têm lembretes internos.
- Decidir se comprovante Pix é anexado no registro da venda, posteriormente ou em ambos.

## Fora de escopo

- Alterar aplicação, banco real, migrations, RPCs ou permissões nesta etapa.
- Automatizar envio de cobrança ao cliente.
- Introduzir cálculo de lucro ou margem sem confirmação da regra e fonte de custos.

## Padrões visuais confirmados no código — 2026-09-29

Esta seção registra a identidade observada nas previews de Tarefas e Estoque e aplicada à Vendas. Os valores hex abaixo descrevem o tema claro isolado das previews; não substituem os tokens do tema global escuro/laranja do aplicativo. Ao implementar outra tela, confira o tema e os tokens da superfície de destino antes de reutilizá-los.

### Fundamentos compartilhados

- **Superfícies:** fundo `#f8fafc`, cartões brancos, áreas elevadas/inset em `#f8fafc`, bordas padrão `#e2e8f0` e sutis `#f1f5f9`.
- **Texto:** primário `#0f172a`, secundário `#475569`, auxiliar `#64748b` e discreto `#94a3b8`. A tipografia sans já usada pelo projeto (Geist com fallbacks existentes); mono fica para códigos, cifras técnicas e micro-rótulos, não para blocos longos.
- **Acento desta preview:** azul `#2563eb`, hover `#1d4ed8` e superfície suave `#eff6ff`. Vendas precisa sobrescrever o CTA herdado laranja do tema global, sem alterar a marca das telas fora da preview.
- **Cores semânticas:** verde `#047857` para positivo, âmbar `#b45309` para aviso, vermelho `#dc2626` para perigo; laranja e violeta mantêm os significados próprios definidos nos tokens. Cor comunica estado/ação e não serve como decoração.
- **Forma e elevação:** cartões com raio de 8 px, controles com 6 px, bordas leves e sombras discretas. Os tokens globais podem ter outros raios; dentro destas previews, usar `--radius-card` e `--radius-control` locais.
- **Hierarquia:** em cards de métrica, o número é a informação mais forte e o rótulo é secundário. Manter dados tabulares alinhados e legíveis; evitar transformar cada agrupamento em um cartão sem função.
- **Hover de cartões informativos:** usar realce curto de borda/sombra sem deslocar o card. Em Vendas, passar `hoverStyle="subtle"` ao `MetricCard` para manter o padrão operacional de Tarefas/Estoque sem alterar os demais usos do componente.
- **Ações:** no máximo um botão de acento preenchido por tela. Ações de apoio ficam em variantes soft, outline, ghost ou texto. Alertas devem indicar uma ação útil para resolvê-los.

### Tabs, drawers e microinterações

- A navegação principal de Estoque, Tarefas e Vendas usa tabs segmentadas compartilhadas: base cinza-clara com borda, aba ativa branca, texto azul e realce animado discreto. Em telas estreitas, a fileira pode rolar horizontalmente sem quebrar os rótulos.
- Tabs são controles reais de navegação: `tablist`, `tab`, `tabpanel`, `aria-selected`, foco roving e setas/Home/End no teclado. O painel é associado à aba ativa e o realce/transição respeitam `prefers-reduced-motion`.
- Detalhes de uma entidade abrem no drawer lateral compartilhado com Estoque/Tarefas, usando o componente `InventoryDrawer` (Radix Dialog + Motion), em vez de modal central. Preservar fechamento por Escape, foco acessível, scrim e adaptação para telas pequenas.
- Usar movimento curto para indicar troca de estado, abertura ou confirmação, sem animação contínua decorativa. Estados de foco devem ser visíveis; toast de sucesso usa `role=status`; loading, erro, vazio, disabled e validação devem manter a paleta e a hierarquia do sistema.
- Alvos principais de toque seguem no mínimo aproximado de 44 px nas tabs e ações interativas da preview. Não depender só de cor: texto/ícone e rótulo também identificam estado e ação.

### Auditoria comparativa e ajustes aprovados — 2026-09-29

| Superfície | Resultado visual na preview | Limite conhecido |
|---|---|---|
| Navegação | Usa as tabs segmentadas compartilhadas com Tarefas/Estoque, com foco por teclado e movimento reduzido. | Preservar o componente compartilhado como fonte de verdade. |
| Cards e resumo | KPIs sem elevação no hover; borda e sombra discretas consistentes com cartões operacionais. Alertas mostram itens urgentes e CTA. | Métrica percentual e série comparativa ainda são dados demonstrativos fixos. |
| Vendas | Situação em chips; canal e pagamento permitem múltipla seleção; período/cliente/peça ficam em Mais filtros; filtros ativos podem ser removidos ou limpos. | Dados e contratos são fictícios nesta rota. |
| Identificação da venda | Lista e drawer mostram canal, ícones de pagamento, peça, unidade e grau; detalhe destaca saldo em aberto ou valor recebido e traz linha do tempo de pagamentos. Vendas do Mercado Livre têm marca e borda amarela discreta. | Não há foto de produto disponível para as vendas de demonstração; o drawer mostra um espaço reservado identificado como “Sem foto”. |
| Movimentações | Saídas têm sinal negativo, ícone direcional, cor semântica e filete próprio em superfície neutra; entradas permanecem positivas. | Ligações com registros reais e trilha de cancelamento ficam fora da preview. |
| Pendências | Atrasos usam perigo/vermelho, prazos próximos usam aviso/âmbar; datas relativas, histórico demonstrativo expansível e estados vazios filtrados são explícitos. | Persistência, cobranças e integrações ainda não existem nesta rota. |
| Formulários e detalhe | Nova venda, saída, conta, recebimento e revisão de cobrança abrem drawers laterais; ações ficam presas ao rodapé ao rolar. Detalhe da venda também usa o drawer compartilhado. | Validação e erros de API dependem do futuro contrato funcional. |

### Afazer visual ainda registrado — não implementado

- [ ] Após a reformulação da tela Clientes, tornar o nome do cliente na venda acionável para abrir informações gerais; nesse momento, mostrar o tooltip “Abrir detalhes do cliente”. Até lá, manter o nome sem ação.

### Referências de implementação

- Tokens claros e drawer: `src/features/estoque-preview/InventoryDrawer.tsx` (`lightInventoryTokens`, `InventoryDrawer`).
- Tabs compartilhadas: `src/features/tarefas-preview/PreviewTabs.tsx`; usadas por Estoque, Tarefas e Vendas.
- Tema de Vendas: `src/features/vendas-preview/VendasPreview.tsx` reaplica os tokens claros e redefine o CTA para azul localmente.
- Detalhe de venda: `src/features/vendas-preview/components/SaleDetailDrawer.tsx`.
- Ações em drawers: `src/features/vendas-preview/components/ActionDrawer.tsx`.
- Marcas de pagamento e canal: `src/features/vendas-preview/components/PaymentMarks.tsx`.
- Regras gerais do produto para acento, alertas e hierarquia de métricas: `CLAUDE.md`, seção “Design system”.
