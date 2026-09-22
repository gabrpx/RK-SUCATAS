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
balcão. A reserva só existe quando o cliente deixa o sinal combinado: 20% por
sete dias corridos. A ficha mostra que ela está reservada e quanto tempo falta.

### Quando chega uma peça nova ou uma peça solta

Clique em **Nova peça**. O drawer pergunta em uma sequência curta:

1. **Qual é a Peça?** Crie uma Peça nova ou escolha uma que já existe. Escolha
   a categoria. Moto compatível é útil, mas pode ficar em branco.
2. **Primeira unidade.** Informe o preço se souber, escolha o grau e diga a
   origem se ela for conhecida. Origem desconhecida é normal e não bloqueia o
   cadastro.
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
- histórico e próxima ação;
- edição e arquivamento.

Use **Editar unidade** quando mudou alguma informação daquela peça física. Use
**Arquivar** somente quando ela realmente não faz mais parte do estoque ativo:
o histórico continua disponível e a unidade pode ser restaurada se necessário.

## O que os cartões do topo mostram

- **Estoque ativo:** todas as unidades físicas que ainda fazem parte do
  estoque.
- **Disponíveis:** unidades que podem ser oferecidas agora.
- **Reservadas:** unidades com sinal de 20%; veja o prazo restante na ficha.
- **Para organizar:** unidades sem localização definitiva. Esta é a fila de
  trabalho para arrumar o galpão aos poucos.

## Regra mais importante

Comece pelo que você sabe e complete o resto depois. O sistema foi desenhado
para receber o estoque antigo sem exigir que toda peça tenha moto doadora,
preço, foto ou localização logo no primeiro dia.

## Sobre a preview atual

A tela `/estoque-preview` é um ambiente de validação. Quando ela mostra dados
reais, qualquer cadastro, edição ou arquivamento feito ali vale apenas durante
a sessão da preview; nada é gravado no sistema oficial. A rota oficial só deve
receber esse fluxo depois da aprovação final e da integração persistente.
