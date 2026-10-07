# Grill: Clientes como gerenciamento operacional integrado
Date: 2026-10-02

## Intent
Transformar a aba Clientes em uma área de trabalho operacional para registrar quem procura peças, acompanhar pedidos em busca, avisar quando uma peça compatível entrar, controlar reservas e visitas e consultar o histórico do cliente. A experiência deve ser rápida para o balcão, usar linguagem cotidiana e seguir de perto a identidade visual já consolidada em Vendas, Estoque e Tarefas.

## Constraints
- Cadastro manual nesta etapa. A integração com WhatsApp Business fica preparada conceitualmente, mas não será implementada agora.
- Cadastrar clientes quando houver uma procura concreta por peça; não exigir que já tenham comprado.
- O contato obrigatório é alternativo: WhatsApp ou Instagram. Não exigir telefone de quem usa somente Instagram.
- Usar linguagem operacional curta; evitar termos técnicos como “demandas abertas” e ambíguos como “peças encontradas”.
- Manter o sistema sem custos recorrentes. O mapa deve ser próprio, estilizado e autocontido, sem mapa comercial ou aparência de Google Maps.
- Preservar o preenchimento de CEP já existente, que consulta gratuitamente o ViaCEP e mantém seleção manual de estado/cidade como alternativa.
- Não criar venda nem movimentação financeira antes do pagamento/retirada.
- Não modificar banco, contratos críticos ou fluxos de Estoque/Vendas sem especificação, aprovação e plano próprios.
- Antes da implementação, calibrar visualmente a proposta contra as telas reais de Vendas, Estoque e Tarefas; a direção atual foi aprovada, mas ainda não foi considerada 100% fiel ao conjunto.

## Key decisions

### Direção escolhida
- Decisão: seguir com a opção B — reorganizar Clientes como uma central de trabalho operacional, reaproveitando o que já funciona na tela atual. Não limitar a mudança a remendos visuais e não ampliar agora para um CRM completo com mensagens e campanhas.
- Decisão: a referência visual não será a cópia isolada de uma tela. Clientes deve reutilizar a linguagem comum encontrada em Vendas, Estoque e Tarefas: superfícies claras, bordas discretas, hierarquia compacta, rótulos auxiliares em mono/caixa alta, abas segmentadas, estados semânticos, ação principal azul, controles compartilhados e drawer lateral.

### Estrutura da aba
- Decisão: a aba terá três visões principais: `Painel`, `Todos os clientes` e `Agenda`.
- Decisão: o Painel começa pelo trabalho que exige atenção, não por métricas comerciais gerais.
- Decisão: o desktop divide o conteúdo em aproximadamente 60% para a fila operacional e 40% para o mapa. No celular, o mapa permanece aberto abaixo da operação.
- Decisão: os indicadores operacionais principais são `Pedidos em busca`, `Peças disponíveis`, `Próximas visitas` e `Reservas vencendo`. Métricas como total de clientes e valor comprado são secundárias.
- Decisão: a fila prioriza, nesta ordem, visita vencida ou de hoje, promessa vencida, reserva aguardando retirada, peça disponível aguardando resposta, procura antiga e pedido novo.
- Decisão: a lista completa mostra cliente/contato, cidade, moto principal, situação atual, última compra, total comprado e próxima ação.
- Decisão: ações rápidas da lista são abrir o canal preferido, registrar novo pedido e agendar visita. Edição, desativação, bloqueio e ações administrativas ficam no drawer.

### Linguagem e situação do cliente
- Decisão: usar `Pedidos em busca`, `Peças disponíveis`, `Próximas visitas`, `Reservas vencendo` e `Pendências`.
- Decisão: a situação atual é calculada automaticamente pelos registros do cliente, com textos como `Visita hoje`, `Peça disponível`, `Aguardando retirada`, `Procurando peça` e `Sem pendências`.
- Decisão: se houver mais de uma situação, a lista mostra somente a mais urgente; o drawer mostra todas.

### Cadastro e contato
- Decisão: o CTA principal é `Registrar pedido`; `Novo cliente` é secundário.
- Decisão: o fluxo pesquisa primeiro por nome e contato para reduzir duplicidades. Se o cliente não existir, cria cliente e pedido no mesmo fluxo.
- Decisão: usar Tabs animadas `WhatsApp` e `Instagram`. Na aba WhatsApp, o telefone é obrigatório; na aba Instagram, o `@` é obrigatório. Depois do primeiro contato, o outro pode ser adicionado e um canal preferido é escolhido.
- Decisão: a ação principal acompanha o canal preferido. WhatsApp abre a conversa; Instagram abre o perfil pelo `@`. Abrir o canal não registra automaticamente uma interação.
- Decisão: contato exato já usado gera alerta forte e sugere o cadastro existente, mas atendentes também podem confirmar a criação separada porque familiares podem compartilhar contato.
- Decisão: origem e contato são conceitos separados. Origens disponíveis: WhatsApp, Facebook, Mercado Livre, Instagram, Indicação e Balcão.
- Decisão: a origem registra como o cliente chegou pela primeira vez e é preservada. Somente administrador pode corrigi-la. Ao iniciar por Instagram, o sistema sugere essa origem, mas o usuário confirma ou altera.
- Decisão: cidade e estado são obrigatórios. O endereço completo é opcional e será usado principalmente quando clientes de outras cidades precisarem de envio.
- Decisão: estado e cidade usam uma lista oficial armazenada no sistema para evitar erros e permitir o mapa. Ao informar o CEP, preservar o preenchimento automático já existente; se falhar, permitir seleção manual.
- Decisão: clientes antigos incompletos continuam disponíveis com o aviso `Cadastro incompleto`. Os campos obrigatórios são cobrados ao editar ou registrar um novo pedido para eles.
- Decisão: unir cadastros duplicados fica para uma etapa futura.

### Pedidos, reservas e encomendas
- Decisão: manter três conceitos distintos:
  - `Pedido em busca`: o cliente procura uma peça ainda indisponível.
  - `Reserva`: uma unidade real do estoque foi separada para o cliente.
  - `Encomenda/frete`: uma peça vendida será entregue ao cliente.
- Decisão: cada pedido em busca tem ciclo independente e um responsável. O prazo é opcional enquanto a equipe apenas procura, mas obrigatório para promessa ao cliente, reserva ou visita.
- Decisão: ciclo esperado: novo, em busca, peça disponível, aguardando cliente, reservada, visita/retirada agendada e vendida; saídas possíveis são não encontrada, cliente desistiu e cancelada.
- Decisão: registrar descrição livre da peça, moto/modelo estruturado e, no máximo, ano de compatibilidade opcional. Categoria é auxiliar porque o catálogo ainda não cobre os nomes usados no balcão.
- Decisão: a reserva aponta para uma unidade real e impede dupla venda. A venda só nasce no pagamento/retirada.
- Decisão: a reserva dura dois dias por padrão, ajustável até cinco dias. O sistema avisa antes de vencer. Sem visita futura, libera ao vencer e avisa o responsável; com visita, cria uma pendência para renovar ou liberar, sem prorrogação silenciosa.

### Compatibilidade e aprendizado
- Decisão: quando uma peça entra no estoque, o sistema procura pedidos compatíveis usando palavras normalizadas, moto/modelo e ano.
- Decisão: o sistema alerta; uma pessoa confirma a compatibilidade. Nunca reservar automaticamente.
- Decisão: se uma unidade atender vários clientes, ordenar pelo pedido mais antigo e destacar quem tem visita ou promessa próxima, mostrando todos os interessados.
- Decisão: confirmações podem ensinar sinônimos, por exemplo “aranha” associado ao nome de catálogo. Esse aprendizado deve ser explicável e reversível.
- Decisão: atendentes confirmam a correspondência para um pedido específico. Somente administradores aprovam, corrigem ou removem sinônimos globais.
- Decisão: o aviso de peça disponível é persistente para o responsável e aparece no Painel. Só é encerrado por `Cliente avisado`, `Não é compatível` ou `Cliente desistiu`.
- Decisão: após `Cliente avisado`, escolher apenas `Aguardando resposta`, `Vai buscar` ou `Não quer mais`. `Vai buscar` conduz à visita/reserva. Sem resposta por dois dias, o item volta às pendências.

### Visitas e notificações
- Decisão: visita é um registro próprio com data, horário opcional, peças relacionadas e responsável.
- Decisão: estados da visita: agendada, confirmada, compareceu, não compareceu, reagendada e cancelada.
- Decisão: Clientes e Tarefas exibem o mesmo registro; não criar cópias independentes.
- Decisão: o responsável padrão pela visita é o responsável pelo pedido, mas pode ser alterado.
- Decisão: avisar um dia antes, uma hora antes quando houver horário e quando estiver atrasada. Não gerar aviso adicional no início do dia quando já houver horário definido.
- Decisão: reagendar cancela lembretes antigos; concluir ou cancelar encerra os alertas.
- Decisão: nesta versão, alertas ficam dentro do sistema — sino, contadores e destaques — sem mensagens automáticas, e-mail ou notificações externas.

### Drawer do cliente
- Decisão: os detalhes abrem em drawer largo à direita no desktop, inspirado no inspetor de Tarefas, e ocupam a tela toda no celular.
- Decisão: o drawer é uma página única rolável, sem tabs internas.
- Decisão: antes da rolagem mostrar nome, canal preferido, cidade, moto principal, situação atual, próxima ação e atalhos.
- Decisão: os botões de ação ficam em uma barra fixa na base do drawer e não se movem com a rolagem do conteúdo, tanto no desktop quanto no celular. A barra deve respeitar a área segura do aparelho e não encobrir o último conteúdo.
- Decisão: ordem do conteúdo: atenção atual, pedidos em busca, próxima visita, reserva, informações do cliente e histórico.
- Decisão: manter visíveis as seções ativas e as informações do cliente; esconder blocos vazios e deixar o histórico detalhado mais abaixo.
- Decisão: cada cliente tem uma moto principal e pode ter motos adicionais. Cada pedido é ligado à moto correspondente.
- Decisão: atendentes veem compras, pedidos, visitas e reservas. Bloquear/desativar, corrigir origem, administrar sinônimos globais e mudanças históricas sensíveis são ações administrativas.

### Histórico comercial
- Decisão: `Já comprou`, `Total comprado`, `Última compra` e tempo de relacionamento são calculados pelas vendas existentes, nunca digitados manualmente.
- Decisão: vendas canceladas não entram nesses números.
- Decisão: histórico e gasto aparecem como contexto, mas não aumentam automaticamente a prioridade operacional.

### Mapa
- Decisão: usar mapa vetorial estilizado do Brasil, coerente com Tarefas/Estoque, sem tiles ou identidade de mapas comerciais.
- Decisão: cada cidade usa coordenadas oficiais do município. Clientes da mesma cidade são agrupados em um marcador.
- Decisão: o tamanho do marcador representa a quantidade de clientes; a cor representa a situação mais urgente: vermelho para atraso, âmbar para visita/retirada próxima, azul para pedido ativo e neutro sem pendência.
- Decisão: clicar no marcador abre resumo da cidade e sua lista de clientes. Filtros da fila e do mapa permanecem sincronizados.
- Decisão: a loja aparece com destaque próprio.
- Decisão: uma futura encomenda poderá ser representada por trajeto tracejado e carrinho entre loja e cidade do cliente, respeitando a geografia. Roteamento real por estradas não entra nesta versão por exigir base/serviço adicional.

## Surfaced assumptions
- “Localização precisa” no mapa significa município correto usando coordenadas oficiais; não significa colocar residência exata do cliente no mapa.
- O endereço completo pode existir para entrega mesmo que o mapa continue agregando clientes por cidade.
- O ViaCEP é uma dependência externa já existente e tolerada somente como conveniência de cadastro; a entrada manual continua sendo a alternativa quando estiver indisponível.
- A nova tela poderá reaproveitar dados e comportamentos atuais, mas a situação operacional não deve depender de preenchimento manual redundante.
- Nenhuma abertura de WhatsApp ou Instagram equivale a contato realizado sem confirmação explícita do atendente.

## Out of scope
- Integração com WhatsApp Business, leitura automática de mensagens, atendimento dentro do sistema e criação automática de pedido/visita pela conversa.
- Promoções e campanhas.
- Devoluções.
- União de clientes duplicados.
- Registro manual de cada tentativa de contato e campo de “último contato”.
- Mensagens automáticas, e-mail, push ou notificações no celular.
- Conquistas geográficas; apenas preservar espaço conceitual para uma etapa futura.
- Rastreamento de frete e rota real por ruas/estradas.
- Plataforma paga de mapas ou dependência obrigatória de mapa externo.
- Alterações de banco, APIs críticas, estoque, vendas ou tarefas antes de uma especificação técnica aprovada.

## Open questions for the specification
- Confirmar no código os contratos atuais de Clientes, Estoque, Vendas e Tarefas antes de definir qualquer mudança de dados.
- Resolver explicitamente a divergência entre a regra aprovada de reserva (dois dias por padrão, máximo de cinco) e a regra atualmente implementada em Estoque, que possui prazo e exigência de sinal próprios. Clientes não pode manter uma segunda regra independente.
- Definir tecnicamente como os alertas compartilhados aparecerão no sino global sem duplicar a fonte de verdade.
- Definir a fonte e o formato da base local de municípios/coordenadas, incluindo atualização e licença.
- Validar a matriz completa de prioridade quando o mesmo cliente tiver múltiplos pedidos, visita e reserva simultâneos.
