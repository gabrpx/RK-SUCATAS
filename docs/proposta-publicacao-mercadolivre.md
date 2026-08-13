# Publicar anúncios no Mercado Livre direto do catálogo — proposta técnica

**Projeto:** RK Sucatas — SISTEMA CLAUDE
**Objetivo:** hoje o sistema já lê o Mercado Livre (conta conectada via OAuth, sincroniza preço/estoque de anúncios já existentes, importa pedidos, responde perguntas). Falta a ponta que cria o anúncio: catalogar a peça e publicá-la no Mercado Livre sem sair do sistema, com suporte a variações (peça-mãe + fichas de unidade) e estatísticas do anúncio aparecendo instantaneamente no modal de detalhes.

Este documento tem duas partes: (1) o que a API do Mercado Livre exige pra publicar um anúncio, pesquisado na documentação oficial; e (2) como isso encaixa no que já existe no seu código — schema do Supabase, `mercadolivreApi.ts`, `mercadolivreSync.ts`, as rotas em `server/routes/`, e o modal de peça em `EstoqueView.tsx`. A Parte 3 é o prompt pronto pra colar no Claude Code.

---

## Parte 1 — Como a API do Mercado Livre funciona pra publicar

### 1.1 O endpoint central: `POST /items`

Criar um anúncio é um único `POST https://api.mercadolibre.com/items` autenticado com o `access_token` do vendedor (o mesmo que `mercadolivreApi.ts` já obtém via `obterAccessTokenValido`). Os campos universais, presentes em qualquer categoria:

- `title` — até 60 caracteres na maioria das categorias (algumas poucas aceitam mais; o limite exato vem de `GET /categories/{id}` como `settings.max_title_length` ou similar — na dúvida, truncar em 60 e avisar o usuário).
- `category_id` — categoria **oficial do Mercado Livre**, não a categoria interna do seu sistema. É uma árvore fixa, publicada pelo próprio ML (ex: `MLB5672`). Só pode ser uma categoria **folha** (sem subcategorias).
- `price` e `currency_id` (`BRL` no site `MLB`).
- `available_quantity` e `buying_mode` (`buy_it_now` — é o modo padrão pra venda direta; `auction` é leilão, fora do escopo aqui).
- `condition` — `new` ou `used`. **Atenção**: isso não é a mesma coisa que `estoque.condicao` (original/paralela) do seu sistema — são dois eixos diferentes (origem da peça × estado de conservação pro comprador). Precisa ser perguntado explicitamente no formulário de publicação, não derivado automaticamente.
- `listing_type_id` — ver 1.3.
- `pictures` — ver 1.5.
- `attributes` — array dinâmico, definido pela categoria escolhida (ver 1.2).
- `variations` — opcional, só quando o anúncio tem variantes (ver 1.4).
- `description` — na prática enviada à parte, com `POST /items/{id}/description` logo depois de criar o item (o campo `description` dentro do `POST /items` é legado e não é mais o caminho recomendado).

A resposta de sucesso traz o `id` do anúncio (formato `MLB1234567890`) e o `permalink` — exatamente o par que `estoque_anuncios_ml` já guarda hoje (`mlb_id` + `url`), só que produzido pelo sistema em vez de colado manualmente.

### 1.2 Categoria e atributos: o motor do formulário

A categoria do Mercado Livre **não é** a árvore de categorias do seu sistema (`categorias`, usada em `CategoriaCascadeSelect`) — são dois vocabulários diferentes que precisam de um mapeamento. Dois mecanismos da API resolvem isso:

- **Preditor de categoria** — dado um título de produto, a API devolve a(s) categoria(s) mais prováveis, já com os atributos que ela exige. É a mesma ideia de "sugestão automática" que seu formulário de peça já faz pra categoria interna e pro modelo de moto (`categoriaAutoDetectada`/`modeloAutoDetectado` em `EstoqueView.tsx`) — aqui é o Mercado Livre fazendo esse trabalho, não o seu sistema.
- **`GET /categories/{category_id}/attributes`** — lista completa dos atributos daquela categoria, cada um com `tags` que dizem como tratá-lo:
  - `required` — tem que ser preenchido, senão o `POST /items` volta com erro `item.attributes.missing_required`.
  - `allow_variations` — esse atributo pode diferenciar variações (cor, voltagem, etc).
  - `variation_attribute` — atributo que vive dentro de cada variação, não no item (ex: `SELLER_SKU`, `GTIN`).
  - `catalog_required` — a categoria exige vincular a um produto de catálogo do ML (comum em eletrônicos novos; não deve aparecer em autopeças usadas, mas o formulário precisa checar).
  - `value_type` — `string`, `number`, `number_unit`, `boolean` ou `list`. Isso decide o componente de input certo: `list` = select com as opções que a própria resposta já traz em `values[]`; `number_unit` = campo numérico + unidade (ex: peso, dimensões — comuns em categoria de autopeças por causa do frete); `boolean` = toggle; `string` = texto livre (aceita `value_name` novo, mesmo fora da lista de sugestões).

**Consequência de design importante**: o formulário de publicação não deve ter campos fixos pensados pra "autopeças" — ele deve ser **gerado dinamicamente** a partir da resposta de `GET /categories/{id}/attributes`, do mesmo jeito que `CategoriaCascadeSelect`/`MotoCascadeSelect` já geram UI a partir de uma árvore vinda do banco. Isso cobre de graça atributos que fogem do óbvio (marca, modelo compatível, peso, garantia — `WARRANTY_TYPE`/`WARRANTY_TIME` aparecem como atributos normais, não como um campo separado) sem precisar prever cada categoria manualmente.

Fontes: [Categorías y Atributos](https://developers.mercadolivre.com.br/pt_br/categorias-y-atributos), [Categorização de produtos](https://developers.mercadolivre.com.br/pt_br/categorizacao-de-produtos), [Check attributes by category](https://global-selling.mercadolibre.com/devsite/atributtes-global-selling), [Category prediction](https://global-selling.mercadolibre.com/devsite/category-predictor).

### 1.3 Tipos de anúncio: só existem dois hoje

O anúncio **Grátis** foi descontinuado — hoje o Mercado Livre Brasil (site `MLB`) oferece só dois tipos:

| `listing_type_id` | Nome comercial | Exposição |
|---|---|---|
| `gold_special` | Clássico | Padrão, taxa menor |
| `gold_pro` | Premium | Mais exposição, parcelamento sem juros pro comprador, taxa maior |

Isso derruba a suposição do pedido original ("gratuito, clássico, premium") — o toggle do formulário deve oferecer só Clássico/Premium, e de preferência **consultar dinamicamente** quais tipos estão disponíveis pra aquela conta/categoria/preço via `GET /users/{user_id}/available_listing_types` (a disponibilidade pode variar por categoria e por faixa de preço), em vez de fixar os dois valores no código — assim, se o Mercado Livre mudar de novo, o sistema não quebra silenciosamente.

Fontes: [Tipos de publicação](https://developers.mercadolivre.com.br/pt_br/tutorial-tipos-de-publicacao-y-atualizacao-de-artigos), [Listing types and exposures](https://global-selling.mercadolibre.com/devsite/listing-types-and-exposures).

### 1.4 Variações: o que "pai/filho, tipo cor de celular" significa tecnicamente

Aqui tem uma nuance que vale a pena entender antes de implementar, porque a API do Mercado Livre tem **dois modelos** pra isso, e eles não são intercambiáveis:

**Modelo clássico (`variations` dentro do próprio `POST /items`)** — é o modelo estável, documentado há anos, e o que a grande maioria das integrações (Bling, Tray, AnyMarket) usa por baixo dos panos:

```json
{
  "variations": [
    {
      "attribute_combinations": [
        { "id": "COLOR", "value_name": "Preta" }
      ],
      "available_quantity": 1,
      "price": 89.90,
      "picture_ids": ["<id da foto já enviada>"],
      "attributes": [
        { "id": "SELLER_SKU", "value_name": "estoque_unidade:uuid-da-ficha" }
      ]
    }
  ]
}
```

Cada variação tem seu próprio `available_quantity` e suas próprias fotos (via `picture_ids`, respeitando a regra de que variações que compartilham o mesmo valor num atributo marcado `defines_picture` têm que usar a mesma foto). O ponto de atenção é o **preço por variação**: historicamente esse recurso era tratado à parte, com liberação gradual por categoria/conta — o Mercado Livre vem expandindo isso desde o fim de 2024 (Argentina/México primeiro, Brasil a partir de janeiro de 2025) sob o nome de **"Preço por Variação"**, hoje já em uso comum. Ainda assim, **nem toda categoria/conta necessariamente tem isso liberado no momento em que você for testar** — por isso o desenho da Parte 3 inclui detecção + fallback, em vez de assumir que sempre vai funcionar.

**Modelo novo (`User Products` / famílias)** — usado pelo programo de venda internacional/fulfillment (Mercado Envios Full com CBT/Global Selling). Nesse modelo cada variação vira uma publicação independente com seu próprio `MLB` id, agrupada por `family_id`. **Isso não se aplica à sua integração** — sua conta usa o fluxo doméstico padrão (`api.mercadolibre.com`, OAuth simples, site `MLB`), não o programa de Global Selling. Vale saber que existe pra não confundir documentação (boa parte do que aparece em buscas sobre "preço por variação" e "User Products" é do programa CBT), mas a implementação aqui deve seguir o modelo clássico de `variations`.

Fontes: [Variações](https://global-selling.mercadolibre.com/devsite/variations-global-selling) (estrutura do JSON), [User Products — preço diferente por variação](https://www.upseller.com/pt/blog-article-204-User-Products-do-Mercado-Livre-Diferente-Preco-por-Variacao), [Bling — preços diferentes por variação](https://ajuda.bling.com.br/hc/pt-br/articles/28281558949655-Como-aplicar-pre%C3%A7os-de-venda-diferentes-para-as-varia%C3%A7%C3%B5es-do-Mercado-Livre) (confirma o rollout gradual desde jan/2025 no Brasil).

### 1.5 Fotos, descrição, frete e garantia

- **Fotos**: o jeito mais simples é mandar `pictures: [{ "source": "https://.../imagem.jpg" }]` com a URL pública — o Mercado Livre baixa e hospeda a imagem sozinho. Como o bucket `estoque` do Supabase Storage já é público (`schema.sql`), as fotos que a peça já tem (`estoque.imagens`, `estoque_unidades.fotos`) podem ser reaproveitadas direto, sem reimplementar upload binário pro ML.
- **Descrição**: `POST /items/{id}/description` com `{ "plain_text": "..." }`, chamado logo após o `POST /items` bem-sucedido. Se falhar, o anúncio já existe mas sem descrição — o fluxo de publicação precisa tratar isso como um passo separado que pode ser reexecutado (não subir tudo numa transação só, porque a API não é transacional entre esses dois passos).
- **Frete**: `shipping.mode` (`me2` = Mercado Envios) e, dependendo da categoria, peso/dimensões viram atributos obrigatórios (comum em autopeças, por causa do cálculo de frete). Isso já cai automaticamente no formulário dinâmico da seção 1.2.
- **Garantia**: também vira atributo comum (`WARRANTY_TYPE`, `WARRANTY_TIME`), não um campo separado na API atual — mesmo motivo acima, não precisa de tratamento especial no código além do formulário dinâmico.

### 1.6 Limites, erros comuns e ambiente de teste

- Rate limit por aplicação existe mas não costuma ser o gargalo pra um catálogo do porte de uma sucata — o cuidado real é não disparar publicação em massa sem revisão (mesmo espírito de "preview antes de aplicar" que a sincronização de preço já usa).
- Erros mais comuns a tratar com mensagem legível: `item.attributes.missing_required` (atributo obrigatório faltando — o formulário dinâmico já deveria ter barrado isso antes de enviar, mas a API é a fonte da verdade), `item.price.invalid` (preço fora da faixa aceita pela categoria), erro de variação com preços diferentes quando a conta/categoria ainda não tem "Preço por Variação" liberado (é o gatilho do fallback da Parte 3).
- **Não existe sandbox pra itens** — toda publicação de teste cria um anúncio real na conta. O Mercado Livre oferece **usuários de teste** (`POST /users/test_user`), que criam contas descartáveis de comprador/vendedor pra testar o fluxo sem usar a conta real da loja. Vale usar isso na fase de testes antes de publicar a primeira peça de verdade, e depois validar com 1 peça real de baixo valor antes de liberar pro catálogo todo.

---

## Parte 2 — O que já existe no seu sistema (achados no código)

Antes de desenhar a solução, vale registrar o que a leitura do projeto confirmou — porque muda a proposta:

**A estrutura "peça-mãe + itens-filho/variantes" já existe, só não tinha esse nome.** O exemplo que você deu (Tampa do magneto 125 → avariada / Cromada / Preta, cada uma com valor próprio) é exatamente `estoque` (a peça) + `estoque_unidades` (a "ficha" de cada unidade física distinguível — `migration_014_unidades_avaria.sql`). Cada `estoque_unidade` já tem `apelido` (nome da variante), `valor` (preço próprio, opcional — herda o da peça quando vazio), `avaria`/`avaria_descricao`, e `fotos` próprias. Não é preciso criar um conceito novo de "variante" no banco — é preciso **mapear o que já existe pro formato de variação do Mercado Livre**.

**A integração com o Mercado Livre já segue um padrão bem definido**, e a publicação deve se encaixar nele, não reinventar:
- `src/services/mercadolivreApi.ts` — cliente puro da API do ML (só fala com `api.mercadolibre.com` e a tabela `mercadolivre_conexao`, sem saber o que é uma "peça").
- `src/services/mercadolivreSync.ts` — a lógica que cruza ML com o domínio (estoque, vendas). É aqui que a lógica de publicação deve entrar, num arquivo companheiro.
- `src/server/routes/mercadolivre.ts` — rotas Express finas, cada uma só chama o serviço e trata erro com `mensagemErro()`.
- `src/features/mercadolivre/` — `api.ts` (chamadas HTTP finas), `types.ts`, telas.
- `src/features/estoque/EstoqueAnunciosMlEditor.tsx` — hoje só cola link manual; é o componente natural pra virar o ponto de entrada da publicação.
- `estoque_anuncios_ml` (`migration_025`) **já suporta N anúncios por peça**, com `mlb_id` único e `on delete cascade` — a base pra guardar o resultado de uma publicação (ou de várias, se o fallback de "anúncio por variação separada" for usado) já está pronta, só falta popular por código em vez de só por link colado.
- `mercadolivre_conexao.margem_sincronizacao_percentual` (`migration_026`) já é o markup aplicado no preço enviado ao ML pela sincronização existente — o preço de publicação deve reaproveisar exatamente essa mesma margem, não inventar um cálculo paralelo.
- O modal de criar/editar peça (`EstoqueView.tsx`, linha ~1085, `tamanho="lg"`) já tem uma `ModalSection` "Anúncios no Mercado Livre" (linha ~1480) — é o lugar natural pro toggle "Publicar no Mercado Livre" nascer, sem criar uma tela nova desconectada do fluxo de cadastro.
- O padrão de degradação graciosa usado em todo o backend (checar `error.code === '42P01' || error.code === 'PGRST205'` pra tabela ausente, `42703`/`PGRST204` pra coluna ausente, com `console.warn` apontando o arquivo de migração) precisa ser seguido nas tabelas novas, senão a aba quebra pra quem ainda não rodou a migração em produção.

---

## Parte 3 — Desenho da solução

### 3.1 Modelo de dados novo

Uma migração nova (confira o número mais alto em `supabase/` no momento da implementação — no momento desta proposta o último era `migration_042_lembretes.sql`, então o próximo é `migration_043`):

```sql
-- migration_043_mercadolivre_publicacao.sql

-- Anúncio criado PELO SISTEMA (não só colado) carrega os dados usados na
-- publicação, pra permitir reabrir o formulário de edição sem reperguntar
-- tudo, e pra permitir republicar/atualizar depois.
alter table estoque_anuncios_ml add column publicado_via_sistema boolean not null default false;
alter table estoque_anuncios_ml add column ml_category_id text;
alter table estoque_anuncios_ml add column listing_type_id text;
alter table estoque_anuncios_ml add column condicao_ml text check (condicao_ml in ('new', 'used'));
alter table estoque_anuncios_ml add column status_ml text;
alter table estoque_anuncios_ml add column atributos_ml jsonb;
alter table estoque_anuncios_ml add column publicado_em timestamptz;

-- Liga cada variação criada no Mercado Livre à ficha de unidade (estoque_unidades)
-- que a originou -- permite atualizar preço/estoque de UMA variação específica
-- depois, e permite reconstruir o payload de PUT sem perder combinações.
create table estoque_anuncios_ml_variacoes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references estoque_anuncios_ml(id) on delete cascade,
  unidade_id uuid references estoque_unidades(id) on delete set null,
  ml_variation_id text not null,
  preco numeric(10,2),
  quantidade integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index idx_estoque_anuncios_ml_variacoes_link on estoque_anuncios_ml_variacoes(link_id);
create unique index idx_estoque_anuncios_ml_variacoes_ml_id on estoque_anuncios_ml_variacoes(ml_variation_id);

-- Snapshot das estatísticas do anúncio, atualizado em background pelo
-- scheduler -- é o que o modal de detalhes lê, pra abrir instantâneo sem
-- chamar o Mercado Livre na hora.
create table estoque_anuncios_ml_estatisticas (
  link_id uuid primary key references estoque_anuncios_ml(id) on delete cascade,
  visitas_total integer,
  visitas_ultimos_15_dias integer,
  perguntas_abertas integer not null default 0,
  vendas_totais integer,
  saude_anuncio numeric(5,2),
  status_ml text,
  atualizado_em timestamptz not null default now()
);

-- Cache local dos atributos/tipos de anúncio de uma categoria do Mercado
-- Livre -- evita ida-e-volta na API a cada tecla digitada no formulário de
-- publicação. TTL controlado na aplicação (reconsultar se atualizado_em
-- estiver velho -- ex: mais de 7 dias).
create table mercadolivre_categorias_cache (
  categoria_ml_id text primary key,
  nome_ml text not null,
  caminho text,
  atributos jsonb not null,
  listing_types jsonb,
  atualizado_em timestamptz not null default now()
);

-- Memoriza qual categoria do Mercado Livre costuma ser usada por categoria
-- INTERNA -- pré-preenche a sugestão nas próximas peças da mesma categoria,
-- reduzindo fricção sem esconder a possibilidade de trocar manualmente.
alter table categorias add column mercadolivre_categoria_id_padrao text;

alter table estoque_anuncios_ml_variacoes enable row level security;
alter table estoque_anuncios_ml_estatisticas enable row level security;
alter table mercadolivre_categorias_cache enable row level security;
-- Sem policy pra anon/authenticated, mesmo padrão do resto do schema.

NOTIFY pgrst, 'reload schema';
```

### 3.2 Backend

**Novo `src/services/mercadolivrePublicacao.ts`** (companheiro de `mercadolivreSync.ts`, mesma separação: lógica de domínio aqui, chamadas cruas de API em `mercadolivreApi.ts`):

- `sugerirCategoria(token, titulo)` — chama o preditor de categoria do ML, devolve as opções ordenadas por confiança.
- `buscarAtributosCategoria(supabase, token, categoriaId)` — olha `mercadolivre_categorias_cache` primeiro; se ausente ou vencido, busca na API e grava no cache.
- `buscarTiposAnuncioDisponiveis(token, mlUserId, categoriaId, preco)` — Clássico/Premium disponíveis pra aquele contexto.
- `montarPayloadPublicacao(item: Estoque, unidades: EstoqueUnidade[], config: ConfiguracaoAnuncioMl)` — função pura que decide: sem unidades cadastradas (ou unidades sem preço próprio) → item simples; com unidades de preço/aparência diferentes → tenta variações.
- `publicarAnuncio(supabase, token, estoqueId, config)` — orquestra o fluxo completo (ver 3.4), grava em `estoque_anuncios_ml` + `estoque_anuncios_ml_variacoes`, reaproveitando `margem_sincronizacao_percentual` já existente pro cálculo de preço.
- `sincronizarEstatisticas(supabase, token, linkIds)` — busca visitas/perguntas/vendas em lote pros anúncios informados e grava em `estoque_anuncios_ml_estatisticas`; é o que o scheduler chama periodicamente.

**`src/services/mercadolivreApi.ts`** ganha as funções puras que faltam: `predizerCategoria`, `buscarAtributosCategoriaML`, `buscarTiposAnuncioML`, `criarItemML`, `atualizarVariacoesML`, `atualizarDescricaoML`, `buscarVisitasItem`, `criarUsuarioTeste` (esta última só usada manualmente durante os testes, não em produção).

**Rotas novas em `src/server/routes/mercadolivre.ts`**:
- `GET /categorias/sugerir?titulo=` — preditor.
- `GET /categorias/:id/atributos` — atributos com cache.
- `GET /tipos-anuncio?categoria_id=&preco=` — Clássico/Premium disponíveis.

**Rotas novas aninhadas em `src/server/routes/estoque.ts`** (mesmo espírito de `/:id/anuncios-ml`, porque publicar é uma ação sobre a peça, não sobre a conta ML):
- `POST /:id/publicar-ml` — recebe a configuração escolhida no formulário, chama `publicarAnuncio`.
- `GET /:id/anuncios-ml/:linkId/estatisticas` — leitura pontual sob demanda (botão "atualizar agora"), além do que o scheduler já mantém fresco.
- `POST /:id/anuncios-ml/:linkId/republicar` — reenvia preço/estoque/atributos quando algo mudou na peça depois de publicada.

### 3.3 Frontend

**Toggle dentro da `ModalSection` "Anúncios no Mercado Livre" já existente** (`EstoqueView.tsx`, ~linha 1480) — não cria uma tela nova desgarrada do cadastro. Acima do editor de links atual, um toggle "Publicar automaticamente no Mercado Livre":

- Desligado (padrão) → comportamento de hoje, cola link manual via `EstoqueAnunciosMlEditor`.
- Ligado → mostra um resumo compacto (categoria sugerida, preço com margem já calculado, tipo de anúncio) + botão "Configurar e publicar", que abre um **modal dedicado** (`EstoquePublicarMlModal.tsx`, novo componente, `tamanho="lg"` ou um tamanho `xl` novo a acrescentar em `Modal.tsx` — o formulário dinâmico de atributos não cabe bem dentro do `max-w-2xl` atual ao lado de todo o resto do formulário de peça). Manter esse formulário num modal secundário, em vez de inchar o modal de peça, é o que garante a sensação "organizada" pedida — o cadastro da peça continua rápido pra quem só quer catalogar, e quem quer publicar entra num fluxo dedicado.

Dentro desse modal dedicado, seções na mesma linguagem visual das já existentes (`ModalSection`):
- **Categoria** — sugestão automática (chamada ao preditor, debounced pelo título) com opção de busca manual; memoriza a escolha em `categorias.mercadolivre_categoria_id_padrao` pra pré-preencher da próxima vez.
- **Condição no anúncio** — novo/usado (não deriva de `estoque.condicao`, pergunta direto).
- **Preço e tipo de anúncio** — preço base já calculado com a margem de sincronização existente, editável; toggle Clássico/Premium com os tipos realmente disponíveis pra aquele contexto (não hardcoded).
- **Atributos da categoria** — formulário gerado dinamicamente a partir de `GET /categories/{id}/attributes` (texto, número, lista, boolean, conforme `value_type`), obrigatórios marcados.
- **Fotos** — reaproveita `estoque.imagens` (e as fotos de cada `estoque_unidade`, quando há variação), com opção de escolher quais entram.
- **Variações** — se a peça tem `estoque_unidades` com apelido/valor/foto distintos, lista automaticamente cada ficha como uma variação candidata, com o preço já vindo do `valor` de cada uma; o usuário confirma ou ajusta antes de publicar.
- **Frete e garantia** — quando a categoria exigir (peso, dimensões, tipo/tempo de garantia), aparecem como parte do mesmo formulário dinâmico de atributos, sem tratamento especial.

**`EstoqueAnunciosMlEditor.tsx`** ganha, pra cada anúncio já publicado pelo sistema (`publicado_via_sistema = true`), um mini-bloco de estatísticas ao lado do link (visitas, perguntas em aberto, status) — lido do `estoque_anuncios_ml_estatisticas` que já vem junto no payload do item, sem chamada adicional.

### 3.4 Fluxo de publicação passo a passo

1. Usuário liga o toggle, o sistema já chama o preditor de categoria com o título da peça (sem esperar o usuário pedir).
2. Ao escolher/confirmar a categoria, busca os atributos dela (do cache local, se disponível) e monta o formulário dinâmico.
3. Usuário preenche o que falta, escolhe tipo de anúncio, revisa preço e variações, confirma.
4. Backend: `POST /items` com o payload montado (sem variações, se a peça não tem unidades diferenciadas; com `variations[]`, se tem).
   - Se a API aceitar variações com preços diferentes → segue o fluxo normal.
   - Se a API recusar (erro de preço divergente entre variações — sinal de que a conta/categoria ainda não tem "Preço por Variação" liberado) → o backend cai automaticamente pro fallback: publica **um anúncio por ficha de unidade com preço próprio**, todos vinculados à mesma peça em `estoque_anuncios_ml` (a tabela já foi desenhada pra N anúncios por peça — é exatamente esse cenário). O modal avisa claramente qual caminho foi usado, sem fingir que os dois são a mesma coisa.
5. `POST /items/{id}/description` com o texto da peça.
6. Grava o resultado em `estoque_anuncios_ml` (+ `estoque_anuncios_ml_variacoes`, se houver).
7. Dispara a primeira leitura de estatísticas (não espera o próximo ciclo do scheduler pra mostrar algo).

### 3.5 Estatísticas instantâneas no modal de detalhes — sem loading

O pedido de "abrir e já ver os dados, rápido, sem loading" só é possível servindo dado que **já está pronto no banco antes do clique** — nunca chamando o Mercado Livre no momento em que o modal abre. Duas peças resolvem isso:

- **Leitura**: `GET /api/estoque/:id` já devolve `links_ml` com as estatísticas embutidas (join com `estoque_anuncios_ml_estatisticas`, mesmo padrão de `anexarAnunciosMl`/`anexarUnidades`) — o modal não faz nenhuma chamada extra ao abrir, só usa o que já veio junto com o item.
- **Escrita**: um scheduler (companheiro de `mercadolivreScheduler.ts`) roda a cada 15–30 minutos e atualiza `estoque_anuncios_ml_estatisticas` em lote pra todos os anúncios ativos. Um rodapé discreto ("atualizado há 12 min") mais um botão manual "Atualizar agora" (que dispara a leitura pontual só daquele anúncio, com seu próprio spinner local, sem travar o resto do modal) cobre o caso de quem quer o número mais recente na hora, sem forçar todo mundo a esperar toda vez.

---

## Roadmap de implementação (fases)

1. **Schema** — `migration_043_mercadolivre_publicacao.sql` (seção 3.1).
2. **Backend puro** — funções novas em `mercadolivreApi.ts` (chamadas cruas ao ML) + `mercadolivrePublicacao.ts` (orquestração), sem UI ainda. Testável via chamadas diretas/Postman antes de qualquer tela.
3. **Rotas Express** — as rotas novas em `mercadolivre.ts` e `estoque.ts`, seguindo o padrão de erro/log já existente.
4. **Frontend — formulário dinâmico** — `EstoquePublicarMlModal.tsx` com o toggle na `ModalSection` existente.
5. **Variações** — mapeamento `estoque_unidades` → `variations[]`, com o fallback automático de anúncios separados.
6. **Estatísticas + scheduler** — cache instantâneo no modal de detalhes.
7. **Teste controlado** — usuário de teste do Mercado Livre primeiro, depois 1 peça real de baixo valor, só então liberar pro catálogo.

## Riscos e cuidados a documentar no código

- "Preço por Variação" é um recurso em expansão gradual — o fallback pra anúncios separados não é gambiarra, é a forma correta de lidar com uma API que ainda não tem o recurso 100% disponível em toda categoria/conta.
- Categoria do Mercado Livre ≠ categoria interna — nunca assumir mapeamento 1:1 automático permanente; a memorização em `categorias.mercadolivre_categoria_id_padrao` é uma sugestão, não uma trava.
- `condition` (novo/usado) do Mercado Livre é um campo à parte de `estoque.condicao` (original/paralela) — não fundir os dois.
- Nenhuma chamada ao Mercado Livre deve acontecer no caminho crítico de abrir o modal de detalhes — só leitura do que o scheduler já deixou pronto.

---

## Fontes consultadas

- [Categorías y Atributos — Mercado Livre Developers](https://developers.mercadolivre.com.br/pt_br/categorias-y-atributos)
- [Categorização de produtos (preditor)](https://developers.mercadolivre.com.br/pt_br/categorizacao-de-produtos)
- [Check attributes by category](https://global-selling.mercadolibre.com/devsite/atributtes-global-selling)
- [Category prediction](https://global-selling.mercadolibre.com/devsite/category-predictor)
- [Tipos de publicação](https://developers.mercadolivre.com.br/pt_br/tutorial-tipos-de-publicacao-y-atualizacao-de-artigos)
- [Listing types and exposures](https://global-selling.mercadolibre.com/devsite/listing-types-and-exposures)
- [Variations (estrutura JSON)](https://global-selling.mercadolibre.com/devsite/variations-global-selling)
- [User Products — Diferente Preço por Variação (UpSeller)](https://www.upseller.com/pt/blog-article-204-User-Products-do-Mercado-Livre-Diferente-Preco-por-Variacao)
- [Bling — preços diferentes por variação (confirma rollout Brasil jan/2025)](https://ajuda.bling.com.br/hc/pt-br/articles/28281558949655-Como-aplicar-pre%C3%A7os-de-venda-diferentes-para-as-varia%C3%A7%C3%B5es-do-Mercado-Livre)
- [User Products — Mercado Livre Developers](https://developers.mercadolivre.com.br/en_us/user-products)

---

## Parte 4 — Prompt pronto para o Claude Code

Copie o bloco abaixo (é um só prompt, para colar inteiro) na sessão do Claude Code que já trabalha neste repositório. Ele assume que o Claude Code vai seguir `PROJECT_RULES.md` (apresentar plano antes de editar, ler antes de escrever, rodar lint depois).

```
Contexto: o sistema RK Sucatas (Supabase + Express + React, ver CLAUDE.md e
PROJECT_RULES.md) já tem integração de LEITURA com o Mercado Livre — conexão
OAuth (mercadolivre_conexao, migration_021), sincronização de preço/estoque de
anúncios já existentes (mercadolivreSync.ts), importação de pedidos, central
de perguntas, e suporte a múltiplos anúncios por peça (estoque_anuncios_ml,
migration_025). Falta a capacidade de CRIAR um anúncio novo direto do
catálogo, com suporte a variações.

A "peça-mãe com itens-filho/variantes" que preciso mapear pro Mercado Livre
JÁ EXISTE no schema: é `estoque` (a peça) + `estoque_unidades` (migration_014
— fichas de unidade física, cada uma com apelido, valor próprio opcional,
avaria e fotos próprias). Não crie um conceito novo de variante — mapeie
estoque_unidades para variações do Mercado Livre.

Implemente em fases, apresentando o plano de cada fase antes de mexer no
código (protocolo do PROJECT_RULES.md), nesta ordem:

FASE 1 — Schema
Crie a migração supabase/migration_0XX_mercadolivre_publicacao.sql (confira
o número mais alto já existente em supabase/ e use o próximo — pode já não
ser 043 quando você rodar isto). Ela deve:
- Adicionar a estoque_anuncios_ml: publicado_via_sistema (boolean, default
  false), ml_category_id (text), listing_type_id (text), condicao_ml (text,
  check 'new'/'used'), status_ml (text), atributos_ml (jsonb), publicado_em
  (timestamptz).
- Criar estoque_anuncios_ml_variacoes: id, link_id (FK estoque_anuncios_ml,
  cascade), unidade_id (FK estoque_unidades, nullable, set null on delete),
  ml_variation_id (text, unique), preco (numeric), quantidade (int, default
  1), criado_em, atualizado_em.
- Criar estoque_anuncios_ml_estatisticas: link_id (FK estoque_anuncios_ml,
  primary key, cascade), visitas_total (int), visitas_ultimos_15_dias (int),
  perguntas_abertas (int, default 0), vendas_totais (int), saude_anuncio
  (numeric 5,2), status_ml (text), atualizado_em (timestamptz).
- Criar mercadolivre_categorias_cache: categoria_ml_id (text, primary key),
  nome_ml (text), caminho (text), atributos (jsonb), listing_types (jsonb),
  atualizado_em (timestamptz).
- Adicionar a categorias: mercadolivre_categoria_id_padrao (text, nullable).
- RLS ligado sem policy nas tabelas novas, seguindo exatamente o padrão do
  resto do schema (só service_role acessa).
Siga o estilo de comentário das migrations existentes (docstring no topo
explicando o problema/solução, mesmo tom das migrations 014/019/025/026).

FASE 2 — Cliente puro da API do Mercado Livre
Em src/services/mercadolivreApi.ts, adicione (sem tocar no que já existe,
só acrescentando funções no mesmo estilo das que já estão lá):
- predizerCategoria(token, titulo) — GET do preditor de categoria.
- buscarAtributosCategoriaML(token, categoriaId) — GET
  /categories/{id}/attributes.
- buscarTiposAnuncioML(token, mlUserId, categoriaId, preco) — tipos de
  anúncio disponíveis (Clássico "gold_special" / Premium "gold_pro" — NÃO
  existe mais o tipo Grátis no Mercado Livre Brasil, não implemente essa
  opção).
- criarItemML(token, payload) — POST /items, devolve { id, permalink,
  ... } cru.
- atualizarDescricaoML(token, itemId, texto) — POST /items/{id}/description.
- buscarVisitasItem(token, itemIds) — visitas de um ou mais itens.
- criarUsuarioTesteML(token) — POST /users/test_user (só será chamado
  manualmente por mim durante testes, não em fluxo de produção — implemente
  mas não invoque automaticamente em lugar nenhum).
Trate erros da mesma forma que as funções existentes (deixe o axios lançar,
quem chama decide a mensagem).

FASE 3 — Orquestração de domínio
Crie src/services/mercadolivrePublicacao.ts (companheiro de
mercadolivreSync.ts, mesma separação de responsabilidade: aqui cruza dados
do catálogo com a API pura de mercadolivreApi.ts). Funções:
- sugerirCategoria(token, titulo)
- buscarAtributosCategoriaComCache(supabase, token, categoriaId) — olha
  mercadolivre_categorias_cache primeiro (considere vencido se
  atualizado_em > 7 dias), senão busca na API e grava no cache (upsert).
- buscarTiposAnuncioDisponiveis(token, mlUserId, categoriaId, preco)
- montarPayloadPublicacao(item, unidades, config) — função pura. Quando
  `unidades` (estoque_unidades) tem 2+ fichas com valor ou apelido próprios,
  monta variations[] com attribute_combinations, price (valor da ficha ou
  o valor base da peça quando null), available_quantity: 1 por ficha,
  picture_ids das fotos da ficha. Quando não há fichas diferenciadas,
  monta um item simples com available_quantity = estoque.quantidade.
  O preço enviado (item simples ou por variação) deve aplicar a MESMA
  margem_sincronizacao_percentual já usada em
  mercadolivreSync.ts/buscarPreviewSincronizacao — não invente um cálculo
  de preço paralelo, reaproveite obterMargemSincronizacao de
  mercadolivreApi.ts.
- publicarAnuncio(supabase, token, estoqueId, config) — orquestra:
  1. monta o payload;
  2. chama criarItemML;
  3. SE a chamada falhar especificamente por preço divergente entre
     variações (a conta/categoria ainda não tem "Preço por Variação"
     liberado): refaça SEM variations[], como item simples com o preço
     BASE da peça, e depois publique cada estoque_unidade com valor
     próprio como um anúncio SEPARADO adicional (reusando a mesma lógica
     de item simples, uma chamada por ficha) — todos vinculados à mesma
     peça via estoque_anuncios_ml (a tabela já suporta N anúncios por
     peça, migration_025). Devolva ao chamador qual caminho foi usado,
     pra UI poder avisar o usuário claramente.
  4. chama atualizarDescricaoML pro(s) item(ns) criado(s);
  5. grava em estoque_anuncios_ml (publicado_via_sistema: true, mais os
     campos novos da FASE 1) e, se houve variações reais (não o fallback
     de anúncios separados), em estoque_anuncios_ml_variacoes;
  6. dispara uma primeira leitura de sincronizarEstatisticas pro(s)
     anúncio(s) recém-criado(s), pra já existir alguma estatística assim
     que o modal for reaberto.
- sincronizarEstatisticas(supabase, token, linkIds) — busca
  visitas/perguntas/vendas em lote e faz upsert em
  estoque_anuncios_ml_estatisticas.

FASE 4 — Rotas Express
Em src/server/routes/mercadolivre.ts, adicione (seguindo exatamente o
padrão das rotas existentes: obterConexaoAtual no início, 409 se não
conectado, mensagemErro() no catch, console.error com contexto):
- GET /categorias/sugerir?titulo=
- GET /categorias/:id/atributos
- GET /tipos-anuncio?categoria_id=&preco=

Em src/server/routes/estoque.ts, adicione (aninhadas no item, mesmo
espírito de /:id/anuncios-ml/:linkId já existente):
- POST /:id/publicar-ml — corpo com a configuração escolhida no
  formulário (categoria, condição, preço, tipo de anúncio, atributos,
  variações confirmadas). Chama publicarAnuncio.
- GET /:id/anuncios-ml/:linkId/estatisticas — leitura pontual sob
  demanda (botão "atualizar agora" na UI).
- POST /:id/anuncios-ml/:linkId/republicar — reenvia preço/estoque atual
  da peça pro anúncio já publicado (reaproveite o que já existe em
  aplicarSincronizacao de mercadolivreSync.ts na medida do possível, em
  vez de duplicar a lógica de cálculo de preço).

FASE 5 — Tipos e API do frontend
Em src/features/estoque/types.ts, adicione os tipos:
ConfiguracaoAnuncioMl, AtributoMl (id, nome, tags, value_type, values,
obrigatorio), CategoriaMlSugerida (id, nome, caminho, confianca),
TipoAnuncioMl (id, nome), EstatisticasAnuncioMl (visitas_total,
visitas_ultimos_15_dias, perguntas_abertas, vendas_totais, saude_anuncio,
status_ml, atualizado_em). Estenda EstoqueAnuncioMl (já existe) com os
campos novos de estoque_anuncios_ml (opcionais, mesmo padrão do resto do
arquivo — ausente em payload antigo em cache = tratar como undefined).

Em src/features/estoque/api.ts, adicione as chamadas HTTP finas
correspondentes às rotas da FASE 4 (mesmo estilo 1:1 rota→função já usado
no arquivo inteiro).

FASE 6 — UI: toggle e modal dedicado
Primeiro me apresente o plano de como o toggle vai se encaixar na
ModalSection "Anúncios no Mercado Livre" (linha ~1480 de EstoqueView.tsx)
antes de mexer — quero revisar a UX antes da implementação, conforme o
protocolo do PROJECT_RULES.md.

Direção esperada (ajuste se encontrar algo melhor durante a implementação,
mas mantenha a peça-mor sem inchar):
- Um toggle "Publicar automaticamente no Mercado Livre" no topo da
  ModalSection existente. Desligado = comportamento de hoje (colar link
  manual, sem mudança). Ligado = mostra resumo compacto (categoria
  sugerida, preço já com margem, tipo de anúncio) + botão "Configurar e
  publicar".
- Esse botão abre um modal SECUNDÁRIO novo (EstoquePublicarMlModal.tsx),
  não incha o modal de peça. Se o tamanho "lg" atual do componente Modal
  (max-w-2xl) ficar apertado pro formulário dinâmico de atributos,
  acrescente um tamanho "xl" em src/components/ui/Modal.tsx (só adicionar
  ao SIZE_CLASSES, sem quebrar os tamanhos existentes).
- Dentro do modal dedicado, use ModalSection pra: Categoria (sugestão +
  busca manual, grava a escolha em categorias.mercadolivre_categoria_id_padrao
  como sugestão pra próxima vez), Condição no anúncio (novo/usado — NÃO
  derive de estoque.condicao, pergunte direto), Preço e tipo de anúncio,
  Atributos da categoria (formulário GERADO DINAMICAMENTE a partir de
  buscarAtributosCategoriaComCache — não hardcode campos de autopeças;
  renderize por value_type: list = select com values[], number/number_unit
  = input numérico, boolean = toggle, string = texto livre), Fotos
  (reaproveita estoque.imagens e as fotos de cada estoque_unidade),
  Variações (lista automática das estoque_unidades da peça, com o valor de
  cada uma já preenchido, editável antes de confirmar).
- Depois de publicar, EstoqueAnunciosMlEditor.tsx deve mostrar, pra cada
  link com publicado_via_sistema true, um mini-bloco de estatísticas
  (visitas, perguntas em aberto, status) ao lado do link — lido do que já
  vier junto no payload do item (sem chamada adicional nessa hora).

FASE 7 — Estatísticas instantâneas (sem loading)
Em src/server/routes/estoque.ts, estenda a função que já anexa
links_ml (anexarAnunciosMl) pra também fazer join com
estoque_anuncios_ml_estatisticas e embutir isso em cada link — siga
exatamente o padrão de degradação graciosa já usado nessa função (tabela
ausente = devolve sem as estatísticas, não quebra a listagem).

Crie um scheduler novo (companheiro de mercadolivreScheduler.ts, mesmo
padrão de setInterval) que roda a cada 15–30 minutos chamando
sincronizarEstatisticas em lote pra todos os links com
publicado_via_sistema true e status ativo.

O modal de detalhes da peça NÃO deve fazer nenhuma chamada ao Mercado
Livre no momento em que abre — só usa o que já veio no payload de
GET /api/estoque/:id. Acrescente, no bloco de estatísticas de cada link,
um texto discreto "atualizado há Xmin" (calculado a partir de
atualizado_em) e um botão "Atualizar agora" que chama
GET /:id/anuncios-ml/:linkId/estatisticas pontualmente, com spinner local
só naquele bloco, sem travar o resto do modal.

FASE 8 — Testes
Antes de considerar pronto: use criarUsuarioTesteML pra criar uma conta de
teste do Mercado Livre e publique ao menos uma peça fictícia com variações
por ela antes de qualquer publicação na conta real. Depois disso, publique
1 peça real de baixo valor no catálogo de verdade, revise o anúncio gerado
manualmente no site do Mercado Livre, e só então considere liberar o
toggle pro uso normal no catálogo inteiro.

Regras gerais pra todas as fases:
- Nunca assuma que "Preço por Variação" está disponível — sempre trate a
  possibilidade de fallback descrita na FASE 3, e nunca deixe o usuário
  sem explicação clara de qual caminho foi usado.
- category_id do Mercado Livre é vocabulário DIFERENTE de categoria_id
  interno (tabela categorias) — nunca confunda os dois nem tente
  sincronizá-los automaticamente sem revisão do usuário.
- Siga PROJECT_RULES.md: leia o arquivo antes de editar, rode lint depois
  de mudança significativa, trate erro com try/catch e feedback visual
  (Loader2 nos botões, mensagem de erro amigável), mantenha o padrão dark
  mode / bottom sheet já usado em todos os modais.
- Ao final de cada fase, resuma o que foi feito e o percentual de
  progresso do recurso como um todo, conforme o protocolo de relatório do
  PROJECT_RULES.md.
```
