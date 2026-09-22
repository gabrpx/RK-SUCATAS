# Especificação aprovada — Estoque físico e atendimento

**Status:** aprovada para uma preview isolada. Não autoriza migration, alteração de dados reais, APIs, `App.tsx`, `DataContext`, rotas do servidor ou deploy.

## Decisão central

O novo estoque é organizado por **categoria de peça e endereço físico**, nunca por marca, modelo de moto ou pela moto de origem.

Uma unidade física é cadastrada uma por uma. Ela possui um único endereço, foto própria, condição, preço, lote de origem e estado. A compatibilidade com motos serve para busca e atendimento, mas não cria cópias nem decide em qual prateleira a peça mora.

Exemplo: um estator compatível com CG 125, CG 150 e CG 160 continua sendo uma unidade em `P05-S03`; as três motos a encontram na busca, mas não há três registros nem três locais.

## Planta física confirmada

O vídeo do galpão e a foto enviada pelo usuário confirmam o padrão físico endereçável:

- 11 estantes: `P01` até `P11`;
- cada estante tem quatro níveis e duas colunas;
- cada estante possui oito seções: `S01`–`S08`;
- total: 88 endereços de estoque;
- a numeração é da esquerda para a direita e de cima para baixo.

```text
        P01
┌────────┬────────┐
│ S01    │ S02    │
├────────┼────────┤
│ S03    │ S04    │
├────────┼────────┤
│ S05    │ S06    │
├────────┼────────┤
│ S07    │ S08    │
└────────┴────────┘
```

Não entram nesta primeira planta: rodas, pneus, bancos grandes, escapamentos grandes, carenagens grandes, motos, peças penduradas e áreas de chão. Eles são **locais especiais** de uma fase posterior. O balcão é atendimento e triagem, não endereço vendável. O corredor central é circulação, nunca estoque.

## Categorias configuráveis, sem reorganização forçada

As 88 seções entram no novo estoque somente como endereço físico: `P01-S01` até `P11-S08`. Todas começam com **Categoria não definida**. A distribuição de motor, elétrica, freio e demais grupos que apareceu em propostas anteriores era apenas uma sugestão de trabalho; ela não será aplicada nem exigida.

Quando a equipe decidir começar uma seção, informa com palavras próprias o que ficará nela — por exemplo, “estatores”, “tampas de motor” ou a categoria que vocês já usam. Essa categoria fica associada àquela seção. Assim, a organização acontece prateleira por prateleira, no ritmo da operação, sem tirar todo o estoque do lugar antes.

Uma categoria pode ocupar mais de uma seção. Se uma seção já tiver unidades, qualquer troca de categoria deverá pedir confirmação explícita e nunca mover ou reclassificar peças silenciosamente.

## Regras operacionais

1. **Um cadastro, uma peça física.** Quantidade agrupada não existe no novo método.
2. **Uma unidade, um endereço.** Para estar disponível, a unidade precisa ter `Pxx-Sxx` válido.
3. **Categoria definida por vocês, antes de encher a seção.** O operador dá o nome que a equipe usa à seção escolhida; depois registra motos compatíveis para encontrá-la no atendimento.
4. **Entrada é diferente de estoque.** Uma peça sem categoria, foto, compatibilidade confirmada ou posição fica em `Para organizar` e não é ofertada.
5. **Reserva não move a peça.** Após sinal de 20%, ela aparece como reservada pelo prazo fixo de sete dias corridos, com tempo restante; o endereço físico não muda.
6. **Peça retirada para o cliente olhar não é reserva.** Não há estado "separada" para balcão.
7. **Fotos antigas não viram foto oficial automaticamente.** Cada nova unidade recebe a sua própria foto.
8. **Lote e custo.** Origem por lote é desejada; custo do lote é opcional, nunca bloqueia o cadastro.
9. **Busca híbrida.** Busca por nome, apelido antigo, categoria ou moto compatível; o resultado prioritário mostra a unidade e o endereço físico.
10. **Lista é auxiliar.** A tela abre no mapa físico. A lista existe para poucos casos, com visual novo e agrupada por endereço, não como cópia do sistema antigo.

## Fluxo diário desejado

1. A peça chega ou é retirada de uma moto e entra na fila **Para organizar**.
2. O operador fotografa a unidade, define ou confirma a categoria da seção que está organizando e informa condição e lote quando conhecido.
3. O sistema mostra a seção escolhida da planta. O operador deposita a unidade ali e confirma o endereço.
4. Só então a unidade fica disponível para busca e atendimento.
5. No balcão, a busca encontra pelo nome ou moto e responde com foto, condição, preço e `Pxx-Sxx`.
6. Se houver 20% de sinal, o atendente registra a reserva de sete dias. A peça continua no mesmo endereço, com aviso de prazo.
7. Toda movimentação autorizada atualiza o endereço e deixa histórico; nenhuma peça é duplicada para “caber” em outra moto.

## Migração do estoque atual

O estoque legado será preservado como referência, mas não convertido automaticamente. Ele hoje mistura variante, quantidade, foto herdada e gaveta semântica; por isso não prova que cada unidade existe nem onde ela está.

Migração por unidade física:

1. escolher a categoria de maior saída, começando por CG 125/150/160;
2. pegar uma única peça da prateleira;
3. criar uma nova unidade com foto própria, categoria, condição, compatibilidades, preço e `Pxx-Sxx`;
4. opcionalmente relacionar a referência antiga apenas para auditoria;
5. marcar a referência antiga como organizada somente depois da conferência física.

Não haverá importação automática de quantidade, imagem, preço ou “gaveta” do legado para a nova unidade.

## Preview a construir

A rota isolada `/estoque-preview` deve ser refeita do zero para representar a planta aprovada, com dados fictícios e sem API:

- mapa físico como tela inicial, com 11 estantes e oito seções reais cada;
- cartões da seção: categoria, ocupação demonstrativa, unidades, reservas e pendências;
- busca que destaca localizações no mapa;
- detalhe de uma seção e de uma unidade;
- fluxo demonstrável de adicionar uma unidade e de confirmar sua localização;
- fila de reservas e fila Para organizar;
- alternância discreta para lista auxiliar;
- identidade da tela Stitch/Tarefas: tema claro, contêiner arredondado, breadcrumb microcaps, faixa de métricas, painel de decisão à direita, Geist/Inter, sem fonte mono;
- microinterações contidas com Motion e componentes existentes do projeto; respeitar `prefers-reduced-motion`.

A referência visual obrigatória antes da implementação é o projeto Stitch **Estoque & Atendimento Híbrido — RK Sucatas**: `https://stitch.withgoogle.com/projects/17500618004917399514`. A preview deve transferir sua hierarquia e assinatura visual, não apenas usar uma paleta clara genérica.

## Fora do escopo desta etapa

- banco, migration, Supabase, Storage e dados reais;
- regras de venda/caixa e RPCs;
- importação do estoque legado;
- marcação de locais especiais;
- integração com WhatsApp ou marketplaces;
- implementação na tela de estoque em produção.

## Evidências da auditoria

- Produção atual: 264 itens de catálogo, 14 gavetas semânticas, 608 unidades derivadas e 234 itens aguardando organização. Estes números não substituem uma contagem física.
- O fluxo atual aceita quantidade agrupada e campos herdados; portanto não atende ao novo método um a um.
- O vídeo mostra estantes de parede, corredor central, áreas de peças grandes e balcão; a foto confirma quatro níveis por duas colunas na estante endereçável.
