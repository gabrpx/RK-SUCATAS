# Clientes — central de gerenciamento operacional integrado

**Data:** 2026-10-02

**Status:** produto e experiência aprovados em conversa; plano técnico pronto para aprovação
**Direção escolhida:** reorganizar Clientes como central de trabalho operacional, reaproveitando o que já funciona

## 1. Resumo

A aba Clientes deixa de ser principalmente um cadastro e passa a organizar o trabalho gerado por cada cliente: peças procuradas, compatibilidade com itens que entram no estoque, avisos, reservas, visitas, encomendas e histórico de compras.

O foco da primeira abertura é responder “o que precisa de atenção agora?”. A experiência usa três visões — `Painel`, `Todos os clientes` e `Agenda` — e um drawer lateral como ficha operacional do cliente. O design deve pertencer ao mesmo sistema visual de Vendas, Estoque e Tarefas.

Esta especificação define o produto e a experiência. Ela não autoriza alteração de banco, rotas críticas ou regras atuais de reserva. Essas mudanças exigem um plano técnico próprio, revisão dos contratos existentes e aprovação antes da execução.

## 2. Problema

O atendimento começa principalmente por WhatsApp e redes sociais. Um cliente costuma procurar uma peça para uma moto específica, a loja pode não ter essa peça naquele momento e o acompanhamento passa a depender da memória da equipe.

É necessário saber:

- quem é o cliente e por qual canal deve ser contatado;
- de onde ele veio;
- qual moto possui;
- qual peça procura;
- há quanto tempo espera e quem é o responsável;
- se uma peça compatível entrou no estoque;
- se existe reserva, promessa ou visita marcada;
- se já comprou, quanto comprou e quando foi a última compra;
- onde os clientes estão distribuídos geograficamente.

A solução não deve exigir registro manual excessivo, criar uma cópia desconectada de Tarefas ou Estoque nem depender, para o mapa, de uma plataforma comercial paga.

## 3. Evidência confirmada no sistema atual

O código existente já oferece uma base que deve ser preservada:

- cadastro, busca, filtros e ordenação de clientes;
- cidade e estado separados, com lista estruturada;
- telefone, documento, origem, preferência de contato, notas e situação ativa/bloqueada;
- motos do cliente em `clientes_motos`;
- peças procuradas em `pecas_procuradas`;
- histórico de vendas e comprovantes Pix vinculados ao cliente;
- métricas comerciais calculadas a partir das vendas;
- preenchimento de CEP pelo ViaCEP com seleção manual de estado/cidade como alternativa;
- tarefas do tipo `visita` e vínculo opcional com cliente;
- reservas reais de unidades do estoque vinculáveis a cliente.

Lacunas confirmadas que o plano técnico terá de resolver:

- o cadastro atual não possui Instagram como contato próprio;
- os valores atuais de origem não representam separadamente todos os canais aprovados;
- `pecas_procuradas` possui apenas estados simples (`aguardando`, `atendida`, `cancelada`), insuficientes para o novo ciclo;
- peças procuradas não possuem hoje todos os dados operacionais aprovados, como responsável, promessa e vínculo com a moto física do cliente;
- visita existe como tarefa, mas ainda não cobre todo o ciclo operacional definido aqui;
- não existe o mecanismo aprovado de correspondência, confirmação e aprendizado de sinônimos;
- não existe mapa de clientes por município;
- a ficha atual abre em modal; o novo padrão exige drawer largo com ações fixas;
- a reserva atual de Estoque tem regras próprias, incluindo prazo padrão e sinal. A regra aprovada nesta conversa — dois dias por padrão e máximo de cinco — diverge do comportamento atual e só poderá ser aplicada depois de uma decisão transversal explícita.

## 4. Objetivos

1. Tornar visível o trabalho que precisa de atenção hoje.
2. Registrar cliente e pedido em busca em um fluxo curto.
3. Avisar quando uma peça potencialmente compatível entrar no estoque, mantendo confirmação humana.
4. Controlar visitas e reservas sem duplicar registros entre Clientes, Tarefas e Estoque.
5. Dar contexto comercial sem deixar gasto histórico definir prioridade operacional.
6. Mostrar a distribuição dos clientes por cidade em um mapa próprio do Brasil.
7. Manter a operação útil no desktop, celular/PWA e Android.
8. Preparar pontos de extensão para WhatsApp Business, frete e conquistas sem implementar essas integrações agora.

## 5. Fora de escopo

- integração com WhatsApp Business;
- leitura automática de mensagens;
- atendimento de WhatsApp dentro da aba;
- criação automática de pedidos ou visitas a partir de conversa;
- promoções e campanhas;
- devoluções;
- união de cadastros duplicados;
- registro manual de cada tentativa de contato;
- campo de “último contato” mantido manualmente;
- envio automático de WhatsApp, Instagram, e-mail ou push;
- conquistas geográficas;
- rastreio de frete;
- rota real por ruas e estradas;
- mapa comercial ou dependência paga de mapas;
- mudança de contratos de Vendas, Estoque, Caixa ou Tarefas sem plano e revisão próprios.

## 5.1 Indicadores de sucesso

Antes de definir metas numéricas, registrar uma linha de base. A primeira versão deve permitir medir:

- pedidos em busca sem responsável ou sem próxima ação;
- tempo entre a entrada de uma peça compatível e a decisão do atendente;
- quantidade de pedidos antigos ainda abertos;
- visitas atrasadas, reagendadas e não comparecidas;
- reservas vencidas sem decisão;
- clientes avisados que permanecem sem resposta por mais de dois dias;
- cadastros novos barrados ou revisados por possível duplicidade;
- clientes com cadastro incompleto.

Sucesso significa reduzir trabalho esquecido e tornar a próxima ação explícita. Volume de clientes ou valor vendido não deve ser usado sozinho como prova de que o fluxo melhorou.

## 6. Usuários e permissões

### Atendente

Pode:

- localizar e consultar clientes;
- cadastrar cliente;
- registrar e atualizar pedidos em busca;
- abrir WhatsApp ou Instagram;
- confirmar uma correspondência para um pedido específico;
- agendar e atualizar visitas;
- iniciar uma reserva de unidade conforme as permissões já existentes;
- ver histórico de compras, pedidos, visitas e reservas.

### Administrador

Além das ações do atendente, pode:

- bloquear, desbloquear, desativar e reativar cliente;
- corrigir a origem histórica;
- aprovar, corrigir ou remover sinônimos globais aprendidos;
- realizar mudanças históricas sensíveis permitidas pelo contrato técnico.

A implementação deve usar permissões granulares existentes e não depender somente do nome do cargo. Ações sensíveis devem ficar separadas das ações rotineiras.

## 7. Arquitetura da informação

### 7.1 Navegação principal

- `Painel`
- `Todos os clientes`
- `Agenda`

CTA principal: `Registrar pedido`.

CTA secundário: `Novo cliente`.

Não haverá uma aba superior separada para pedidos em busca. Eles aparecem no Painel e na ficha do cliente.

### 7.2 Situação calculada

A situação exibida na lista não é um campo manual. Ela é calculada a partir dos registros ativos.

Exemplos:

- `Visita atrasada`
- `Visita hoje`
- `Reserva vencendo`
- `Aguardando retirada`
- `Peça disponível`
- `Aguardando resposta`
- `Procurando peça`
- `Sem pendências`

Quando houver mais de uma situação, a lista mostra a mais urgente e o drawer mostra todas.

Ordem inicial de prioridade:

1. visita atrasada ou de hoje;
2. promessa ao cliente vencida;
3. reserva aguardando retirada ou vencendo;
4. peça disponível aguardando ação/resposta;
5. pedido em busca antigo;
6. pedido novo;
7. sem pendências.

A matriz completa, inclusive empates e múltiplos pedidos do mesmo cliente, deve ser fixada em testes de domínio no plano técnico.

## 8. Identidade visual

Clientes deve reutilizar a linguagem comum das telas novas de Vendas, Estoque e Tarefas, e não copiar isoladamente a composição de apenas uma delas.

Padrões obrigatórios:

- superfícies claras e neutras;
- painéis brancos com bordas discretas;
- hierarquia compacta e legível;
- tokens semânticos compartilhados, sem cores locais inventadas;
- rótulos auxiliares pequenos em fonte mono e caixa alta;
- abas segmentadas compartilhadas;
- controles, botões, campos e drawers já usados pelo sistema;
- azul como destaque principal;
- vermelho somente para atraso/erro/perigo real;
- âmbar para atenção próxima;
- verde para conclusão ou estado saudável;
- uma ação preenchida de maior destaque por área;
- animações curtas e discretas, respeitando movimento reduzido;
- foco visível e tamanho de toque confortável.

Evitar:

- gradientes decorativos;
- cartões grandes sem necessidade;
- múltiplos botões preenchidos competindo;
- excesso de etiquetas coloridas;
- estética de CRM genérico;
- copiar cores ou controles de Google Maps.

Antes de implementar, realizar uma calibração visual lado a lado com as rotas reais de Vendas, Estoque e Tarefas em desktop e 375 px. O aceite exige coerência de tipografia, espaçamento, raio, borda, densidade, abas, indicadores e drawer — não apenas paleta semelhante.

## 9. Painel

### 9.1 Indicadores

Faixa compacta com:

- `Pedidos em busca`
- `Peças disponíveis`
- `Próximas visitas`
- `Reservas vencendo`

No celular, a faixa pode rolar horizontalmente seguindo o padrão já adotado nas telas novas.

### 9.2 Fila operacional

Título: `Precisa de atenção`.

Ocupa aproximadamente 60% da largura no desktop. Cada linha deve mostrar:

- cliente;
- situação;
- peça e moto;
- prazo ou tempo de espera;
- responsável;
- próxima ação;
- atalhos compatíveis com o estado.

A lista é ordenada pela prioridade definida, não pelo valor comprado.

### 9.3 Mapa lateral

Ocupa aproximadamente 40% da largura. Permanece visível durante a consulta no desktop quando houver altura disponível, sem criar uma segunda rolagem confusa. No celular aparece aberto abaixo da fila.

### 9.4 Conteúdo secundário

Resumo comercial e distribuição por origem podem aparecer abaixo da área operacional. Eles não competem com as pendências do dia.

## 10. Todos os clientes

A visão principal é uma lista, não uma grade de cartões.

Colunas/conteúdo:

- cliente e contato preferido;
- cidade;
- moto principal;
- situação mais urgente;
- última compra;
- total comprado;
- próxima ação ou prazo;
- ações rápidas.

Busca:

- nome;
- telefone;
- `@` do Instagram;
- moto;
- cidade.

Filtros visíveis:

- situação;
- origem;
- cidade.

Em `Mais filtros`:

- responsável;
- cadastro incompleto;
- período da última compra;
- clientes sem pendências.

Filtros ativos devem aparecer como etiquetas removíveis e oferecer `Limpar filtros`. O vazio filtrado deve explicar que nenhum resultado corresponde aos filtros.

A linha inteira abre o drawer. Ações rápidas disponíveis sem abrir:

- abrir canal preferido;
- registrar pedido;
- agendar visita.

No celular, a linha se reorganiza como bloco compacto, mantendo situação e próxima ação visíveis. Informações comerciais secundárias podem perder destaque, mas não desaparecer do drawer.

## 11. Drawer do cliente

Drawer largo à direita no desktop e tela cheia no celular. Deve reutilizar o padrão estrutural dos drawers novos do sistema.

### 11.1 Cabeçalho

Exibe:

- nome;
- cidade/UF;
- situação atual;
- contato preferido;
- moto principal;
- próxima ação.

### 11.2 Conteúdo rolável

Ordem:

1. `Precisa de atenção`
2. `Pedidos em busca`
3. `Próxima visita`
4. `Reserva atual`
5. `Dados do cliente`
6. `Motos`
7. `Compras e histórico`

Seções vazias não aparecem. O histórico detalhado fica abaixo da operação atual.

Cada pedido mostra peça, moto, tempo de espera, responsável, estado e próximo passo.

O cliente possui uma moto principal e pode possuir motos adicionais. Cada pedido deve apontar para a moto relevante quando essa informação existir.

### 11.3 Barra fixa de ações

Os botões ficam fixos na base e não acompanham a rolagem do conteúdo.

A barra deve:

- funcionar no desktop e no celular;
- respeitar a área segura do aparelho;
- não cobrir o último conteúdo;
- manter no máximo uma ação preenchida como principal;
- adaptar as ações ao contexto.

Ações usuais:

- `Abrir WhatsApp` ou `Abrir Instagram`;
- `Registrar pedido`;
- `Agendar visita`.

Editar cadastro e adicionar moto permanecem acessíveis. Ações administrativas ficam em menu separado.

## 12. Cadastro e contatos

### 12.1 Regra mínima

Todo cliente novo precisa de:

- nome;
- pelo menos um contato: WhatsApp ou Instagram;
- cidade;
- estado;
- origem confirmada.

Endereço completo é opcional e destinado principalmente a clientes de outras cidades que receberão uma compra.

### 12.2 Contato alternativo

Usar Tabs animadas:

- `WhatsApp`: telefone obrigatório dentro desta opção;
- `Instagram`: `@` obrigatório dentro desta opção.

Depois do primeiro salvamento, permitir adicionar o outro canal e definir o preferido.

A ação principal acompanha o contato preferido. Se houver ambos, o outro canal fica nas ações secundárias.

Abrir WhatsApp ou Instagram não cria automaticamente um registro de contato realizado.

### 12.3 Origem

Valores aprovados:

- WhatsApp;
- Facebook;
- Mercado Livre;
- Instagram;
- Indicação;
- Balcão.

Origem significa primeiro canal de aquisição e deve ser preservada. Quando o cadastro começa na aba Instagram, sugerir Instagram como origem, sem salvar antes da confirmação do atendente.

### 12.4 Localidade e CEP

- estado e cidade vêm de lista oficial estruturada;
- CEP continua opcional;
- ao completar um CEP válido, preservar o preenchimento automático existente;
- se o ViaCEP falhar, manter seleção manual sem bloquear o cadastro;
- o formulário não deve apagar uma cidade escolhida manualmente por causa de uma falha posterior de consulta.

### 12.5 Duplicidade

Antes de criar, pesquisar nome e contato normalizado.

Contato exato já usado:

- mostrar alerta forte;
- apresentar o cadastro existente;
- permitir que atendente confirme um cadastro separado, pois familiares podem compartilhar contato;
- nunca unir históricos automaticamente.

Para a comparação, normalizar WhatsApp para dígitos e Instagram sem `@`, ignorando diferença entre maiúsculas e minúsculas.

Unir cadastros existentes fica para fase futura.

### 12.6 Legado incompleto

Clientes antigos sem contato, cidade ou moto permanecem consultáveis com o aviso `Cadastro incompleto`.

Não bloquear a abertura do registro. Exigir os dados mínimos ao editar ou registrar um novo pedido para esse cliente, com mensagens que indiquem exatamente o que falta.

## 13. Fluxo Registrar pedido

Abre em drawer com conteúdo rolável e barra fixa `Cancelar` / `Registrar pedido`.

### Etapa 1 — Quem está procurando

- buscar por nome, WhatsApp ou Instagram;
- selecionar cliente existente;
- ou cadastrar dados mínimos sem abandonar o fluxo;
- confirmar origem;
- usar cidade/estado e CEP conforme as regras anteriores.

### Etapa 2 — O que está procurando

- descrição livre da peça, obrigatória;
- moto/modelo estruturado;
- vínculo com a moto do cliente quando possível;
- ano de compatibilidade, opcional;
- categoria, opcional;
- responsável, obrigatório;
- data prometida, obrigatória somente quando uma data foi combinada;
- observação, opcional.

Ao confirmar:

- criar cliente se necessário;
- criar pedido em busca;
- não criar venda;
- não reservar unidade;
- mostrar confirmação e refletir o novo item no Painel.

Cliente e pedido devem ser tratados como uma operação coerente. O plano técnico deve definir atomicidade/compensação para evitar cliente órfão quando o segundo salvamento falhar.

## 14. Pedido em busca

### 14.1 Conceitos distintos

- `Pedido em busca`: peça ainda indisponível.
- `Reserva`: unidade real existente foi separada.
- `Encomenda/frete`: peça vendida será enviada.

Esses termos não são intercambiáveis na interface ou nos dados.

### 14.2 Ciclo

Fluxo esperado:

- novo;
- em busca;
- peça disponível;
- aguardando cliente;
- reservada;
- visita/retirada agendada;
- vendida.

Saídas:

- não encontrada;
- cliente desistiu;
- cancelada.

Cada pedido tem ciclo independente. Um cliente pode ter vários pedidos em estados diferentes.

### 14.3 Responsável e prazo

Todo pedido ativo possui responsável.

Prazo:

- opcional durante busca sem promessa;
- obrigatório quando houve promessa ao cliente;
- não deve ser inventado pelo sistema.

## 15. Correspondência com Estoque

Ao cadastrar uma peça/unidade no Estoque, o sistema procura pedidos possivelmente compatíveis usando:

- palavras normalizadas da descrição;
- sinônimos aprovados;
- moto/modelo;
- ano de compatibilidade quando informado.

O resultado é uma sugestão, nunca uma decisão automática.

Regras:

- não reservar automaticamente;
- não encerrar pedido automaticamente;
- exigir confirmação humana para a correspondência específica;
- exibir todos os clientes compatíveis;
- ordenar pelo pedido mais antigo;
- destacar visita ou promessa próxima;
- não usar total comprado para furar a ordem.

### 15.1 Aprendizado de sinônimos

Uma confirmação pode gerar uma sugestão de sinônimo, por exemplo um nome usado no balcão associado ao nome do catálogo.

- atendente confirma correspondência somente naquele pedido;
- administrador aprova alteração global;
- toda associação global deve mostrar origem/evidência;
- administrador pode corrigir ou remover;
- desfazer uma associação não altera silenciosamente históricos encerrados.

O plano técnico deve separar normalização determinística, sugestões pendentes e sinônimos aprovados.

## 16. Aviso de peça disponível

Quando houver possível correspondência:

- criar aviso interno para o responsável;
- incluir o item em `Peças disponíveis`;
- manter o aviso até decisão explícita.

Ações:

- `Cliente avisado`;
- `Não é compatível`;
- `Cliente desistiu`.

Depois de `Cliente avisado`:

- `Aguardando resposta`;
- `Vai buscar`;
- `Não quer mais`.

`Vai buscar` conduz a visita/reserva. `Aguardando resposta` volta às pendências depois de dois dias sem decisão.

O clique para abrir WhatsApp/Instagram não equivale a `Cliente avisado`; a confirmação continua manual.

## 17. Visitas e Agenda

Visita é um único registro compartilhado entre Clientes e Tarefas.

Campos conceituais:

- cliente;
- pedido(s)/peça(s) relacionados;
- data;
- horário opcional;
- responsável;
- observação;
- situação.

Situações:

- agendada;
- confirmada;
- compareceu;
- não compareceu;
- reagendada;
- cancelada.

Responsável padrão: responsável do pedido, com possibilidade de alteração.

### 17.1 Agenda

- faixa de dias com `Hoje` acessível;
- alternância `Dia` / `Semana`;
- lista cronológica da data selecionada;
- calendário mensal somente como seletor de data;
- filtros por responsável, situação e cidade;
- atrasadas primeiro;
- cada item mostra horário, cliente, peça, moto, responsável e reserva.

Ações na lista:

- `Confirmar`;
- `Reagendar`;
- `Compareceu`;
- `Não compareceu`;
- `Cancelar`.

Selecionar a visita abre o drawer do cliente focado naquele registro.

### 17.2 Lembretes

- um dia antes;
- uma hora antes, se houver horário;
- quando estiver atrasada;
- sem aviso adicional no início do dia quando já existe horário definido;
- reagendamento invalida lembretes antigos;
- conclusão ou cancelamento encerra lembretes.

## 18. Reservas

Reserva sempre aponta para uma unidade real de estoque e deve impedir dupla venda.

Não criar venda no momento da reserva. A venda permanece vinculada ao pagamento/retirada e aos fluxos atômicos já existentes.

Regra de produto aprovada para a experiência:

- dois dias por padrão;
- ajustável até cinco dias;
- aviso antes do vencimento;
- sem visita futura: liberar no vencimento e avisar responsável;
- com visita futura: manter temporariamente e criar pendência para renovar ou liberar;
- nunca prorrogar silenciosamente.

### Gate obrigatório de compatibilidade

O Estoque atual possui regra de reserva diferente, inclusive prazo padrão maior e exigência de sinal. Não implementar a regra acima apenas em Clientes.

Antes de qualquer mudança:

1. mapear o contrato real de reservas e consumidores;
2. decidir se prazo/sinal são regras globais ou configuráveis;
3. avaliar impacto em Estoque, Vendas, Caixa e dados existentes;
4. definir migração/compatibilidade e rollback;
5. obter aprovação explícita para a alteração transversal.

Até esse gate ser resolvido, Clientes deve refletir a reserva real de Estoque sem manter uma cópia independente.

## 19. Mapa

### 19.1 Fonte e privacidade

- mapa vetorial próprio do Brasil;
- divisas estaduais discretas;
- coordenadas oficiais do município;
- nenhum endereço residencial exato no mapa;
- clientes da mesma cidade agrupados;
- loja com marcador próprio em destaque.

“Localização precisa” significa município correto nas coordenadas oficiais, não geocodificação da residência.

### 19.2 Marcadores

- tamanho: quantidade de clientes;
- vermelho: atraso;
- âmbar: visita ou retirada próxima;
- azul: pedido ativo;
- neutro: sem pendência.

Cor sempre acompanha texto/legenda; não pode ser o único indicador.

Ao selecionar uma cidade:

- destacar discretamente o estado;
- mostrar total de clientes e situações;
- listar clientes;
- permitir abrir o drawer.

Filtros do Painel atualizam mapa e fila juntos.

### 19.3 Dependências

A base de municípios/coordenadas deve ser local, versionada e licenciada para uso no projeto. O plano técnico deve registrar fonte, versão, tamanho e estratégia de atualização.

Não usar tiles comerciais, chave paga ou rota obrigatória de terceiros.

### 19.4 Extensão futura

Quando frete/rastreio for reformulado, uma encomenda poderá mostrar linha tracejada e carrinho entre a loja e a cidade do cliente. A primeira versão não inclui rota rodoviária nem animação de entrega.

## 20. Métricas comerciais

Calculadas automaticamente a partir das vendas vinculadas:

- já comprou;
- total comprado;
- quantidade de compras;
- última compra;
- tempo desde a primeira compra.

Vendas canceladas não entram. Esses dados são contexto e não alteram automaticamente a prioridade operacional.

## 21. Notificações

Nesta versão, notificações são internas:

- sino do sistema;
- contadores do Painel;
- destaques em listas.

Não há envio automático para WhatsApp, Instagram, e-mail ou celular.

Notificações devem apontar para o registro que exige ação, evitar duplicidade e desaparecer somente quando a condição for resolvida ou explicitamente tratada.

O plano técnico deve definir como integrar os alertas ao sino existente sem criar uma segunda fonte de verdade.

## 22. Estados de interface

Todas as três visões, drawers e formulários devem cobrir:

- carregamento;
- vazio inicial;
- vazio por filtros;
- erro recuperável;
- permissão insuficiente;
- sucesso;
- conflito/registro alterado;
- operação em andamento;
- tentativa duplicada.

Regras:

- erro não apaga formulário ou filtros;
- recarregar não duplica criação;
- ação desabilitada explica o motivo quando necessário;
- textos usam linguagem operacional curta;
- nenhum estado depende apenas de cor;
- leitores de tela recebem anúncios para sucesso e erro;
- foco retorna ao acionador ao fechar drawer/diálogo;
- barra fixa não esconde conteúdo nem teclado virtual.

## 23. Responsividade

### Desktop

- Painel em proporção aproximada 60/40;
- drawer largo à direita;
- mapa visível ao lado da fila;
- lista com colunas essenciais e densidade compatível com Vendas/Estoque.

### Mobile, referência 375 px

- navegação superior utilizável sem corte;
- indicadores em faixa horizontal;
- fila antes do mapa;
- mapa aberto abaixo da fila;
- lista reorganizada em blocos compactos;
- drawer em tela cheia;
- ações fixas acima da área segura;
- nenhum scroll horizontal na página, exceto faixas explicitamente roláveis;
- teclado não cobre os botões de confirmação.

## 24. Critérios de aceite

### Estrutura e visual

- [ ] Existem `Painel`, `Todos os clientes` e `Agenda`.
- [ ] `Registrar pedido` é a ação principal e `Novo cliente` é secundária.
- [ ] A tela usa componentes/tokens compartilhados e passa por comparação visual com Vendas, Estoque e Tarefas.
- [ ] Desktop e 375 px apresentam os mesmos recursos essenciais.
- [ ] Drawer possui conteúdo rolável e barra de ações fixa na base.

### Cadastro

- [ ] Novo cliente exige nome, cidade/UF, origem e pelo menos WhatsApp ou Instagram.
- [ ] Tabs alternam corretamente a validação entre telefone e `@`.
- [ ] É possível manter ambos e escolher o preferido.
- [ ] CEP preserva autopreenchimento e fallback manual.
- [ ] Duplicidade exata alerta e oferece cadastro existente antes de permitir confirmação separada.
- [ ] Cliente legado incompleto continua consultável.

### Operação

- [ ] Situação é calculada e mostra a condição mais urgente na lista.
- [ ] Drawer mostra todas as situações ativas.
- [ ] Pedido em busca tem descrição, moto/modelo, responsável e prazo condicional.
- [ ] Correspondência de estoque nunca reserva automaticamente.
- [ ] Aviso de peça disponível persiste até decisão explícita.
- [ ] Aguardando resposta volta às pendências após dois dias.
- [ ] Visita é o mesmo registro em Clientes e Tarefas.
- [ ] Reserva exibida em Clientes é a mesma reserva real de Estoque.
- [ ] Nenhuma venda é criada antes do fluxo real de pagamento/retirada.

### Mapa

- [ ] Mapa funciona sem serviço comercial pago.
- [ ] Municípios usam base oficial local.
- [ ] Clientes da mesma cidade são agrupados.
- [ ] Loja aparece destacada.
- [ ] Cor, tamanho, legenda e texto comunicam situação e quantidade.
- [ ] Filtros atualizam mapa e fila juntos.

### Qualidade

- [ ] Loading, vazio, erro, sucesso e permissão insuficiente foram testados.
- [ ] Fluxos principais funcionam por teclado.
- [ ] Foco, leitor de tela, contraste e movimento reduzido foram verificados.
- [ ] Testes de domínio cobrem prioridade, ciclo de pedido, lembretes e correspondência.
- [ ] Testes de integração cobrem criação cliente+pedido sem registros órfãos.
- [ ] Testes de navegador cobrem desktop e 375 px na aplicação nova.

## 25. Riscos e gates

### Banco e contratos — nível 3

O produto exige novos dados e ciclos. Qualquer mudança em `supabase/` ou `src/server/routes/` requer:

- levantamento das migrations aplicadas;
- migration nova, nunca edição de migration aplicada;
- revisão de RLS/índices/constraints;
- compatibilidade com registros atuais;
- caminho de rollback/mitigação;
- aprovação explícita antes de afetar dados reais.

### Reserva transversal

A regra aprovada conflita com o comportamento atual de Estoque. Resolver antes de implementar expiração automática.

### Fonte única de visitas

Não criar tabela/registro paralelo sem primeiro avaliar a extensão do modelo de Tarefas. Clientes e Tarefas devem operar sobre a mesma identidade de visita.

### Correspondência falsa

Sinônimos e texto livre podem sugerir peças incorretas. Confirmação humana, explicação e reversibilidade são obrigatórias.

### Base geográfica

Uma base local reduz dependência externa, mas exige licença clara, versionamento e atualização controlada.

### Desempenho

Fila, mapa e lista não devem carregar detalhes completos de todos os clientes individualmente. O plano técnico deve prever consultas resumidas, agregações e carregamento do detalhe sob demanda.

### Privacidade

Mapa agrega por município e não expõe endereço residencial. Dados de contato aparecem somente para usuários autorizados.

## 26. Sequência recomendada para o plano técnico

1. Auditar contratos e migrations atuais de Clientes, Tarefas, Estoque, notificações e Vendas.
2. Fechar as decisões transversais de reserva e fonte única de visita.
3. Definir modelo de dados, endpoints, permissões e compatibilidade.
4. Fixar regras de domínio com testes antes da UI.
5. Implementar shell visual, navegação, lista e drawer usando dados atuais.
6. Implementar contato alternativo e fluxo cliente+pedido.
7. Implementar ciclo operacional e Agenda compartilhada.
8. Implementar correspondência assistida e avisos.
9. Integrar reservas reais após o gate transversal.
10. Adicionar mapa e base municipal.
11. Validar acessibilidade, mobile, desempenho e regressões.

Essa ordem pode ser dividida em entregas menores, mas não pode criar fontes de verdade duplicadas como atalho.

## 27. Decisões futuras preservadas

A arquitetura deve deixar pontos de extensão, sem implementar antecipadamente:

- WhatsApp Business e atendimento dentro da aba;
- reconhecimento de mensagens para sugerir pedidos e visitas;
- frete/rastreio e trajeto visual;
- promoções/campanhas;
- conquistas por cidades e estados;
- união administrativa de cadastros duplicados.

## 28. Condição de parada antes da implementação

Não iniciar alterações de produto até:

1. o usuário revisar e aprovar esta especificação;
2. o plano técnico investigar o código real e listar arquivos/contratos/migrations;
3. a regra transversal de reserva ser decidida;
4. qualquer mudança de banco ou contrato crítico receber aprovação específica;
5. os critérios de aceite e validações serem transformados em tarefas executáveis.
