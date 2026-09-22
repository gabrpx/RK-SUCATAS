# Organização do novo estoque — guia da equipe

> Estado em 22/09/2026: este fluxo está preparado em `/estoque-preview`, mas a
> migration `065` ainda não foi aplicada e a rota principal `/estoque` não foi
> substituída. Se a tela mostrar **Dados demonstrativos**, nada é gravado.
> Cadastre peças reais somente após a ativação e a validação do ambiente.

## A ideia em uma frase

**Peça** é o nome no catálogo; **unidade** é cada objeto físico. Três escapamentos
iguais compartilham o cadastro da peça, mas cada escapamento tem ficha, preço,
foto, condição e endereço próprios.

## 1. Prepare o mapa físico

Abra **Mapa físico → Cadastrar local**. Informe depósito, zona, prateleira e
seção/posição conforme existem no galpão. Dê um código curto e único para a
etiqueta, por exemplo `A-P01-S01`. Não crie posições fictícias. Uma posição pode
conter várias unidades; o número de unidades no cartão do mapa mostra a ocupação
atual, não um limite de capacidade.

Use o seletor **Prateleira** para navegar por depósito, zona e prateleira. A
busca aceita código, nome da zona, seção e descrição, útil quando o galpão tem
muitos endereços. Sem posições cadastradas, o operador pode cadastrar a peça
sem endereço e organizá-la depois.

## 2. Indique as categorias recomendadas

Em cada cartão de endereço, clique **Designar categorias**, pesquise pelo nome
e adicione quantas categorias fizerem sentido. A mesma categoria pode ser
recomendada em vários endereços. Remova uma recomendação pelo × no respectivo
marcador. A recomendação ajuda a equipe a encontrar a peça; ela **não bloqueia**
exceções nem move unidades automaticamente. Para mover uma unidade, altere sua
ficha e escolha o novo endereço.

## 3. Cadastre uma peça física

Clique **Nova peça** e siga as quatro etapas:

1. **Peça:** pesquise antes de criar. Se o tipo já existe, escolha **Usar
   existente**; isso evita nomes duplicados. Se não existe, informe nome,
   categoria, procedência e nota de cadastro quando exigida. A referência livre
   de moto é salva como observação; ela ainda **não** cria vínculo estruturado
   com um modelo de moto.
2. **Unidade:** informe preço e grau A/B/C. No modo conectado ao estoque real, o
   preço deve ser maior que zero. A origem pode ficar vazia se for desconhecida;
   não invente uma moto doadora. Selecione as fotos desta unidade, preferindo
   frente, verso e avarias visíveis.
3. **Local:** escolha a seção cadastrada ou deixe em **Para organizar**. A
   escolha é por endereço, não por texto livre.
4. **Conferir:** revise nome, categoria, preço, condição, origem, fotos e local
   antes de salvar. Aguarde a confirmação; não clique novamente para tentar
   corrigir uma falha parcial sem conferir a peça criada.

As fotos são comprimidas no navegador e enviadas ao endpoint de upload antes
do cadastro. A URL resultante fica na ficha da **unidade**; a imagem geral do
catálogo é separada. Se o upload falhar, nenhuma peça é cadastrada. Se uma etapa
posterior falhar, a tela informa que parte do cadastro pode ter sido salva;
confira a ficha antes de repetir, evitando duplicatas. Um upload bem-sucedido
seguido de falha no cadastro pode deixar arquivo órfão no storage — ponto ainda
pendente de limpeza automática.

## 4. Faça a triagem diária

Abra **Organizar** para ver unidades sem endereço. Use **Definir endereço** nas
unidades com ficha individual. Uma quantidade legada ainda sem ficha aparece
como **Individualização pendente** e não pode ser movida como se fosse um objeto
identificado. Unidades sem endereço continuam visíveis no catálogo; o operador
deve conferir a disponibilidade antes de vender.

No **Atendimento**, cada cartão mostra quantidade, preço e estado das unidades;
itens zerados ganham destaque. Cartões e lista têm rolagem interna contínua,
sem barra aparente. Quando há mais resultados, role dentro do painel para
carregá-los. O cartão **Valor em estoque** mostra quantas unidades têm preço;
um preço desconhecido não é um preço zero. O **Ritmo de organização** conta
endereços atribuídos nos últimos sete dias; períodos anteriores à implantação
não têm histórico inventado.

## O que ainda exige liberação técnica

- Aplicar e verificar a migration `supabase/migration_065_estoque_organizacao.sql`
  no ambiente correto, com autorização explícita e plano de rollback.
- Testar cadastro, upload, localização e concorrência de ponta a ponta contra
  API e banco de homologação. Os testes locais não substituem essa validação.
- Reservas e arquivamento/restauração reais **não estão habilitados** no novo
  fluxo. A aba de arquivados reais é somente consulta; não interprete vendas
  como itens restauráveis. O processo de venda continua nas rotas existentes.
- A rota principal `/estoque` ainda é a antiga. A troca depende de aprovação
  expressa e de checagem das funcionalidades que ela já oferece.

Se a conexão com a API falhar, a prévia exibe dados demonstrativos e avisa que
nenhuma alteração será persistida. Não use o modo demonstrativo para registrar
estoque operacional.
