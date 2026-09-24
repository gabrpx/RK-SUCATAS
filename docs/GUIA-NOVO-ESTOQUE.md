# Guia simples — novo estoque RK Sucatas

Este guia explica o novo jeito de trabalhar com o estoque. A ideia é simples:
o sistema deixa de tratar uma quantidade como se fossem peças iguais. Cada peça
física passa a ter a própria ficha.

## Antes de começar: três palavras importantes

**Peça** é o nome pelo qual você procura algo. Exemplo: “Tampa do cubo CG
160”. Uma Peça pode ter várias unidades.

**Unidade** é uma peça física que está na sua mão. Duas tampas iguais podem ter
preço, foto, grau e local diferentes. Por isso cada uma recebe sua própria
ficha.

**Localização** é onde a Unidade está no galpão, por exemplo `P04-S02`:
prateleira 4, seção 2. A categoria da seção é escolhida pela equipe; não é
necessário preencher todas as prateleiras antes de começar.

## Como será o dia a dia

### Quando o cliente pergunta por uma peça

1. Pesquise pelo nome da Peça, moto compatível, SKU ou localização.
2. Abra a Unidade que você está vendo ou pegou na prateleira.
3. Confira foto, grau, preço e localização na ficha lateral.
4. Se ela servir para o cliente, siga o atendimento ou a reserva.

Não é preciso marcar uma peça como “separada” só porque ela foi mostrada no
balcão. A reserva só existe quando o cliente deixa o sinal combinado.

### Quando o cliente quer reservar

1. Abra a ficha da unidade e clique em **Reservar**.
2. Escolha o cliente cadastrado (ou digite o nome de quem está no balcão).
3. Informe o **sinal pago**: o campo já vem com 20% do preço da unidade. Pode
   ser mais que isso, nunca menos, e nunca acima do preço.
4. Escolha a **forma de pagamento** do sinal (PIX, dinheiro etc.). Formas de
   fiado não são aceitas: o sinal precisa ter sido pago.
5. Confirme o prazo: 7 dias corridos por padrão, no máximo 30. O prazo conta
   em blocos de 24 horas a partir do momento da reserva (a ficha mostra a data
   e a hora exatas do vencimento).

A unidade continua no mesmo endereço físico, mas fica bloqueada para venda
até alguém clicar em **Liberar reserva** ou o prazo vencer. Unidade sem preço
não pode ser reservada: defina o preço primeiro (a ficha mostra o atalho
**Definir preço**). O sinal **não** é lançado no Caixa por esta tela.

### Quando chega uma peça nova ou uma peça solta

Clique em **Nova peça**. O drawer pergunta em uma sequência curta:

1. **Qual é a Peça?** Crie uma Peça nova ou escolha uma que já existe. Escolha
   a categoria. Moto compatível é útil, mas pode ficar em branco.
2. **Primeira unidade.** Informe o preço se souber; se ainda não souber, deixe
   em branco e defina depois. Escolha o grau e informe a origem, se conhecida.
   Origem desconhecida é normal e não bloqueia o cadastro.
3. **Onde guardar?** Informe a localização quando a peça for guardada. Se ainda
   não souber, deixe vazio.
4. **Revisão.** Confira e salve. A unidade ganha uma ficha própria e pode ser
   completada depois.

Se houver mais de uma peça física igual, adicione uma Unidade por vez à mesma
Peça. Assim cada unidade pode ter foto, preço e condição próprios.

### Quando ainda não sabe onde guardar

Deixe a localização vazia. A Unidade aparece na aba **Organizar**, em vez de
sumir ou receber um endereço inventado. Quando alguém decidir onde ela fica,
abra a ficha, clique em **Editar unidade** e informe o endereço.

### Quando faltar informação

Não invente informação para conseguir salvar.

- Não sabe de qual moto veio? Deixe **Origem** como “Não identificada”.
- Não sabe o preço? Deixe para definir depois.
- Ainda não tirou foto? Salve e complete quando conferir a peça.
- Não sabe em qual prateleira vai ficar? Deixe sem localização e organize pela
  fila.

O que não pode mudar é a realidade: uma unidade física é sempre uma ficha; ela
não deve ser juntada por engano a outra unidade só porque tem o mesmo nome.

## Como ler a ficha lateral da unidade

Ao abrir uma unidade, a ficha mostra:

- identificação e compatibilidade;
- preço, grau, origem e localização;
- foto própria;
- detalhes registrados;
- histórico: a linha do tempo gravada no banco (cadastro, endereços, reservas
  com sinal, liberações, arquivamentos, restaurações e venda), com data e,
  quando registrado, quem fez;
- edição e arquivamento.

Use **Editar unidade** quando mudou alguma informação daquela peça física. Use
**Arquivar** somente quando ela realmente não faz mais parte do estoque ativo:
informe o motivo (obrigatório), o histórico continua disponível e a unidade
pode ser restaurada na aba **Arquivados** / **Fora do ativo**. Unidade vendida
ou arquivada é somente consulta: a ficha não oferece edição. Unidade reservada
precisa ter a reserva liberada antes de ser arquivada.

Quem não tem permissão de edição do estoque vê a mesma tela em modo consulta,
sem os botões de cadastrar, editar, reservar ou arquivar.

## O que os cartões do topo mostram

- **Valor em estoque:** soma dos preços das unidades ativas (inclusive
  reservadas); mostra quantas têm preço definido.
- **Disponíveis:** unidades que podem ser vendidas agora (têm endereço e não
  estão reservadas). O cartão também informa quantas estão reservadas com sinal.
- **Localizadas:** unidades com endereço físico. Reservar **não** reduz esse
  número, porque a peça continua no mesmo lugar.
- **Para organizar:** unidades sem localização definitiva. Esta é a fila de
  trabalho para arrumar o galpão aos poucos.

## Mapa físico

No **Mapa físico** você cadastra os locais reais (depósito, zona, prateleira,
seção), edita o código curto e a descrição, e designa as categorias
recomendadas de cada local com prioridade (**Principal**, **Secundária** ou
**Eventual**). Um local só pode ser **desativado** quando não houver nenhuma
unidade guardada nele; desativados podem ser reativados depois.

## Regra mais importante

Comece pelo que você sabe e complete o resto depois. O sistema foi desenhado
para receber o estoque antigo sem exigir que toda peça tenha moto doadora,
preço, foto ou localização logo no primeiro dia.

## Conferências pendentes (vendas sem unidade escolhida)

Quando uma venda é registrada **sem escolher a unidade** (balcão, orçamento ou
Mercado Livre), o sistema baixa sozinho a unidade livre mais antiga daquela
peça — nunca uma reservada — e mostra o aviso amarelo **“Conferências
pendentes”** no topo do Atendimento.

1. Toque em **Conferir agora**.
2. Se foi aquela unidade mesmo, toque em **Foi esta**.
3. Se saiu outra, toque em **Foi outra**, escolha a unidade certa e confirme.
   A que o sistema tinha baixado volta para o estoque.

Se a venda for cancelada, a unidade volta sozinha para o estoque.

**Fichas sobrando:** vendas antigas (antes desta mudança) baixaram a
quantidade sem dizer qual unidade saiu. Essas peças aparecem na mesma
conferência com “ficha sobrando”. Marque **Já saiu** na unidade que não está
mais no galpão. Até lá, ela não conta como disponível.

## Onde fica cada coisa

- **Estoque** (dock): o novo estoque do dia a dia, com o mesmo visual da tela
  Tarefas.
- **Tela antiga** (botão no topo do Estoque): anúncios do Mercado Livre e
  Shopee, famílias, gavetas e a edição completa da peça. O botão **Voltar ao
  novo Estoque** traz de volta.
- **Buscar** (ou ⌘K / Ctrl+K): vai direto para o campo de busca do catálogo.
- O alerta de **estoque baixo** do Dashboard abre o catálogo já filtrado
  (peças com 1 ou 2 unidades).

## Se a conexão cair

Todo cadastro, edição, endereço, reserva, arquivamento, restauração e mudança
no mapa é **gravado no sistema** pela API.

- Se o servidor não responder, a tela mostra o erro e **não exibe peças**
  (para ninguém vender com dado errado). Use **Tentar novamente**.
- Se os dados não puderem ser atualizados, a tela fica em **somente leitura**
  até reconectar.
- Reserva com sinal depende das migrations 067 e 068; conferência de vendas,
  edição de uma vez só e limpeza de fotos dependem da migration 069.

A rota `/estoque-preview` continua existindo para demonstração: sem login e,
se o servidor não responder, com peças fictícias (nada é gravado).
