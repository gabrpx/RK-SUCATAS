# Endereços agrupados e sugestão de localização no estoque

**Status:** aguardando revisão do usuário  
**Projeto:** RK Sucatas — novo sistema  
**Data:** 2026-09-25

## Objetivo

Permitir agrupar quaisquer endereços físicos cadastrados (prateleiras e seções) sob um endereço lógico, como `P4-01 + P4-02`, e sugerir endereços adequados durante o cadastro de uma unidade usando as categorias vinculadas aos locais e o texto do nome da peça. A edição no novo estoque também deve permitir alterar o nome compartilhado do cadastro da peça.

## Estado atual confirmado

- `estoque_locais` representa um endereço físico por linha; cada local tem um código e seus componentes de depósito, zona, prateleira e seção.
- `estoque_unidades.endereco_id` guarda no máximo um local físico.
- `estoque_local_categorias` vincula categorias e prioridades a cada endereço físico (1 principal, 2 secundária, 3 eventual).
- O mapa e o seletor de endereço do cadastro trabalham com locais individuais.
- O formulário de edição do novo estoque altera os campos da unidade física. O nome exibido vem de `estoque.nome` e é compartilhado por todas as unidades do mesmo cadastro.
- O endpoint existente de edição do estoque aceita atualizações parciais do cadastro; a feature não requer mudança de autenticação ou de regra de venda.

## Desenho proposto

### Grupos de endereços

Adicionar uma entidade de grupo com nome/código e uma relação de membros para locais físicos existentes. Um local poderá pertencer a no máximo um grupo; grupos não poderão se sobrepor ou conter outros grupos. Cada grupo terá dois ou mais membros e poderá combinar qualquer prateleira ou seção.

No mapa, o grupo aparece como um único endereço lógico e agrega as unidades que continuam apontando para os locais físicos originais. O mapa deve indicar os códigos membros para que a composição do grupo seja visível. Locais agrupados deixam de aparecer como opções avulsas enquanto fizerem parte do grupo, mas permanecem identificáveis na administração do grupo.

Unidades novas poderão receber o endereço lógico do grupo. Uma unidade atribuída diretamente a um local membro preservará o endereço físico específico. Assim, os registros existentes em P4-01 não precisam ser regravados ao criar o grupo P4-01 + P4-02; eles aparecem reunidos no grupo sem perder a posição registrada.

O grupo não será criado automaticamente ao abrir o sistema. Uma pessoa com permissão de edição criará o grupo no mapa, escolherá seus endereços membros e confirmará a operação. Os endereços físicos e os vínculos de estoque existentes não serão apagados.

Ao editar/remover um grupo que já recebeu unidades diretamente no endereço lógico, o sistema exigirá que essas unidades sejam transferidas para outro grupo ou para um endereço físico antes da remoção.

### Categorias e sugestões no cadastro

As categorias recomendadas para um grupo serão agregadas a partir das categorias vinculadas a seus endereços membros. Em caso de conflito, prevalece a melhor prioridade existente (1 antes de 2, 2 antes de 3). Categorias e prioridades já cadastradas nos locais físicos permanecem preservadas.

Durante o cadastro da peça, o sistema usará a categoria selecionada como sinal principal e comparará o nome digitado com os nomes das categorias vinculadas a locais. A comparação será determinística, com normalização de caixa e acentos e correspondência de palavras relevantes; não dependerá de um serviço externo ou modelo de IA. Se a categoria escolhida não tiver local associado, a correspondência textual entre nome e categoria poderá indicar outras opções compatíveis. Locais e grupos compatíveis serão ordenados por prioridade, força da correspondência e código.

As sugestões aparecem no passo de localização do cadastro. O usuário escolhe a opção sugerida, outra localização disponível ou deixa a unidade em “Para organizar”. A sugestão nunca é gravada sem uma escolha explícita. Se mais de um local/grupo combinar, todos os resultados relevantes ficam disponíveis, com o melhor classificado em primeiro lugar.

### Alteração do nome da peça

O formulário de edição da unidade incluirá uma área separada para alterar o nome do cadastro da peça. A interface deixará explícito que o novo nome será aplicado a todas as unidades ligadas à peça. O nome será salvo pela API já existente de atualização parcial do cadastro; preço, fotos, condição e endereço continuarão sendo atributos da unidade.

Como nome do cadastro e dados da unidade são recursos persistidos separadamente, a edição do nome terá ação de salvamento própria. Isso evita apresentar duas gravações independentes como uma única operação atômica. Falhas em um salvamento não descartarão o resultado do outro.

## Modelo de dados e API

- Criar migration nova, sem editar migrations aplicadas.
- Adicionar tabela de grupos de locais e tabela de membros, com unicidade que impeça um local de pertencer a dois grupos.
- Adicionar referência opcional a grupo em `estoque_unidades`, mantendo `endereco_id` para as posições físicas existentes; impor que uma unidade não tenha simultaneamente endereço físico e lógico.
- Atualizar a rota de organização para listar, criar, editar composição e remover grupos, validando permissões e impedindo referências inválidas; gravações de grupo e membros devem ser atômicas.
- Atualizar as respostas do mapa para incluir composição do grupo, unidades agregadas, categorias e prioridades efetivas.
- Atualizar criação/edição de unidade para aceitar endereço físico ou grupo, validando que ambos existem e estejam ativos.
- Não aplicar migration nem modificar dados reais durante esta etapa de implementação local. A aplicação da migration em produção será uma etapa operacional separada.

## Interface

- No mapa, oferecer criação de grupo por seleção de dois ou mais locais cadastrados, identificação do grupo (iniciada pelos códigos membros), edição dos membros e desfazer agrupamento com validação de unidades vinculadas.
- Exibir o grupo como uma opção no cadastro e na edição; preservar consulta dos endereços individuais no detalhe do grupo.
- Mostrar categorias agregadas e prioridades que originaram as sugestões.
- No cadastro, apresentar recomendações de localização junto ao campo atual; permitir troca manual e manter “Para organizar”.
- Na edição, separar visualmente “Nome da peça (compartilhado)” dos atributos físicos da unidade.

## Alternativas consideradas

1. **Grupo lógico com associação persistida (recomendado):** mantém locais físicos, agrupa-os sem apagar nem reescrever as posições existentes e permite atribuir futuras unidades ao conjunto.
2. **Substituir os dois códigos por um texto composto:** simples na tela, mas perde integridade referencial e dificulta histórico, busca e desagrupamento.
3. **Permitir múltiplos `endereco_id` diretamente por unidade:** mistura o conceito de grupo físico com a localização da peça e impede distinguir uma unidade que está em uma posição específica.

Foi escolhido o grupo lógico. O usuário confirmou essa direção e pediu que o mecanismo se aplique a qualquer prateleira e seção.

## Critérios de aceite

1. Um usuário com permissão pode agrupar quaisquer dois ou mais locais ativos; o mapa e o seletor mostram o grupo como endereço lógico.
2. Grupos não apagam locais membros nem reescrevem os endereços já registrados nas unidades.
3. O mapa do grupo reúne unidades de seus membros e também unidades atribuídas ao próprio grupo.
4. Grupos não podem se sobrepor nem conter locais inativos/inexistentes.
5. Cadastro aceita grupo, endereço físico não agrupado ou nenhum endereço.
6. Com correspondência de categoria/nome, sugestões aparecem ordenadas por prioridade e podem ser substituídas pelo usuário; sem correspondência, nenhuma localização é preenchida automaticamente.
7. Remover grupo com unidades diretamente atribuídas exige realocação prévia; desagrupar preserva os endereços físicos membros.
8. Editar o nome da peça afeta o cadastro compartilhado e todas as unidades relacionadas, com ação de salvamento explícita.
9. API continua respeitando permissões existentes, e nenhum segredo ou chamada direta ao Supabase é adicionado ao frontend.

## Validação planejada

- Testes unitários do agrupamento, validações de sobreposição, agregação de categorias/prioridades e classificação das sugestões.
- Testes das rotas para autorização, criação de grupo, resolução de unidades por membros e proteção ao remover grupo usado.
- Testes de interface para criar/editar grupo, sugestões no cadastro, troca manual de endereço e edição do nome compartilhado.
- Type-check, suíte de testes pertinente e build. Revisão de migration e endpoints antes de qualquer aplicação no banco real.

## Riscos e decisões de produto

- Unidades já atribuídas a P4-01 ou P4-02 continuam com o vínculo específico salvo e serão apresentadas dentro do grupo. Unidades novas podem ser atribuídas ao grupo sem escolher qual membro ocupa.
- Categorias de um grupo vêm dos locais membros; prioridades duplicadas usam o menor número, isto é, a maior prioridade.
- A correspondência pelo nome é textual e explicável. Sinônimos que não aparecem no nome da categoria não serão inferidos automaticamente; a seleção manual de categoria/local continua disponível.
- A remoção de um grupo pode ser bloqueada até as unidades atribuídas diretamente a ele serem realocadas.
- A migration e o novo comportamento não serão implantados nem aplicados ao banco de produção sem solicitação operacional explícita.
