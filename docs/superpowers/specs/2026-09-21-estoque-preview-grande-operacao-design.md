# Especificação — Estoque Preview: grande operação

## Objetivo

Transformar `/estoque-preview` em uma simulação navegável do novo estoque, alinhada visualmente à Tela 1 de Tarefas e capaz de demonstrar como todo item legado será convertido em Peça canônica + Unidades físicas individuais.

## Decisões confirmadas

- Cada unidade física tem SKU, estado, preço, foto, origem e endereço próprios.
- Um cadastro legado com quantidade maior que 1 vira várias unidades, uma por uma.
- Origem desconhecida é válida e esperada para a maior parte do estoque atual.
- Foto ausente é exibida como `Sem foto`; nenhuma imagem deve ser inventada.
- Organização física é por categoria/seção, não por marca ou moto.
- Existem 11 prateleiras com 8 seções cada.
- As categorias são personalizáveis e já aparecem prontas para receber peças.
- Endereços usados na preview são fictícios e devem ser identificados como demonstração.
- Reserva exige 20% de sinal e dura 7 dias corridos; a unidade continua no endereço e mostra o tempo restante.
- Retirar uma peça da prateleira apenas para mostrar no balcão não muda seu estado.
- “Excluir” significa arquivar a unidade: ela sai do estoque ativo e do mapa, mas mantém histórico e pode ser restaurada na demonstração.
- A visualização principal é em cartões; a lista é uma alternativa secundária.
- A preview não persiste dados e não altera API, banco, Supabase ou rota real `/estoque`.

## Dados reais de demonstração

Usar nomes, preços, quantidades e códigos observados no estoque atual, sem copiar seu design:

- RABETA: RK-810, RK-792 (3 unidades), RK-791.
- ESCAPAMENTOS: RK-315, RK-803.
- EMBREAGEM: RK-798, RK-790, RK-789.

Cada quantidade legada deve ser desdobrada em unidades (`RK-792-01`, `RK-792-02`, `RK-792-03`). Como não havia fotos visíveis nos registros auditados, todas começam com `Sem foto`. Endereços da demonstração: RABETA em P01-S01, ESCAPAMENTOS em P02-S01 e EMBREAGEM em P03-S01.

## Arquitetura de informação

Uma única store local demonstrativa alimenta:

1. Peças canônicas e suas Unidades.
2. Busca e filtros.
3. Contadores e indicadores.
4. Fila de organização.
5. Mapa físico.
6. Arquivo e restauração.

O mapa nunca possui sua própria cópia de unidade. Uma seção apenas deriva as unidades ativas cujo endereço corresponde ao seu código.

## Estrutura visual

- Casca plana, largura e densidade próximas da Tela 1 de Tarefas.
- Fonte Geist/Inter e nenhuma fonte monoespaçada.
- CTA primário azul `Adicionar item`.
- Cabeçalho com título, explicação curta, busca e alternância cartões/lista.
- Quatro indicadores derivados da store.
- Abas: Atendimento, Organizar, Mapa físico e Arquivados.
- Atendimento em grade principal + coluna lateral curta de alertas.
- Organizar como fila acionável, sem esconder itens incompletos.
- Mapa mostra uma prateleira por vez e suas 8 seções, evitando 88 cartões simultâneos.
- Composer modal em quatro etapas, inspirado na estrutura do criador de tarefas.
- Painel lateral para editar a unidade, preservando o contexto da lista.

## Fluxos obrigatórios

### Adicionar

1. Escolher uma Peça existente ou criar uma Peça canônica.
2. Cadastrar exatamente uma Unidade.
3. Informar preço, grau, origem e foto opcional.
4. Escolher endereço agora ou enviar para organização.
5. Revisar e salvar localmente.

### Editar

- Editar dados da Peça canônica separadamente dos dados da Unidade.
- Alterar preço, grau, origem, endereço e compatibilidade sem gerar duplicata.

### Arquivar

- Pedir confirmação clara.
- Remover a Unidade das contagens ativas e do mapa.
- Preservar histórico em Arquivados.
- Oferecer desfazer/restaurar.

## Critérios de aceitação

- Busca encontra por nome, categoria, compatibilidade, código legado, SKU e endereço.
- Todos os números visíveis são derivados da mesma store.
- As três categorias reais e suas unidades aparecem na demonstração.
- Cadastro, edição, arquivamento e restauração funcionam em memória.
- O mapa reflete imediatamente qualquer mudança de endereço/estado.
- Há visualização em cartões e lista.
- O fluxo continua entendível em 375 px e utilizável por teclado.
- Testes cobrem desdobramento de quantidades, busca, métricas, CRUD, arquivo e mapa.

## Fora do escopo

- Persistência real, upload de imagem, migrations, APIs, autenticação, permissões, venda e implantação.

