# Publicar anúncios na Shopee direto do catálogo — proposta técnica

**Projeto:** RK Sucatas — SISTEMA CLAUDE
**Objetivo:** o sistema já publica peças do estoque no Mercado Livre, com suporte a variações (peça-mãe + fichas de unidade). Esta proposta estuda como levar a mesma capacidade para a Shopee como um **segundo canal de publicação**, reaproveitando ao máximo o que já foi validado no ML — sem tocar no código do ML.

Este documento é só estudo + proposta. **Não é** o prompt de implementação — esse vem depois, num prompt em fases separado, no mesmo formato usado para o Mercado Livre (`docs/proposta-publicacao-mercadolivre.md`, Parte 4).

**Aviso sobre as fontes**: a documentação oficial (`open.shopee.com`) não pôde ser acessada diretamente nesta pesquisa (bloqueada para fetch automatizado). Tudo abaixo vem de fontes secundárias — SDKs open-source (Python, Go), guias de terceiros e artigos técnicos — cruzadas entre si quando possível. Pontos com uma fonte só, ou onde as fontes divergem, estão marcados explicitamente como **a confirmar no sandbox** antes da Fase 1 da implementação. Isso é diferente da proposta do ML, onde a documentação oficial estava acessível e citada diretamente.

---

## Parte 1 — Como a API da Shopee funciona pra publicar

### 1.1 Autenticação: bem diferente do OAuth do Mercado Livre

O Mercado Livre usa OAuth padrão: `access_token` no header, pronto. A Shopee usa **OAuth + assinatura HMAC-SHA256 em toda chamada**, o que muda a forma como o cliente HTTP precisa ser construído:

- **`partner_id`** e **`partner_key`** — credenciais do **aplicativo** (não da loja), obtidas registrando um app no Partner Portal da Shopee. Equivalente ao `MERCADOLIVRE_CLIENT_SECRET` de hoje: variável de ambiente, nunca no banco. Referenciar como `[SHOPEE_PARTNER_ID]` / `[SHOPEE_PARTNER_KEY]`.
- **Assinatura por requisição** — cada chamada precisa de um `sign` (HMAC-SHA256) calculado sobre `partner_id + path + timestamp` (mais `access_token + shop_id` nas chamadas autenticadas de loja), usando `partner_key` como chave. Isso significa que o cliente HTTP da Shopee (equivalente a `mercadolivreApi.ts`) precisa de uma função de assinatura chamada antes de cada request — o ML não tem equivalente a isso.
- **Autorização a nível de loja (`shop_id`)** — depois do fluxo OAuth (redirecionar o vendedor, receber um `code` de callback, trocar em `/api/v2/auth/token/get`), a resposta traz `access_token` + `refresh_token` **atrelados a um `shop_id`** específico. Toda chamada de produto/pedido precisa enviar esse `shop_id` junto — não é "a conta", é "a loja dentro da conta". Pra uma única loja RK Sucatas isso não muda a experiência do usuário, mas muda o schema: onde `mercadolivre_conexao` guarda `ml_user_id`, o equivalente Shopee guarda `shop_id`.
- **Expiração dos tokens** — `access_token` expira em **4 horas** (bem mais curto que o do ML) e `refresh_token` em **30 dias**. Isso exige um refresh mais frequente — o scheduler que já existe pro ML precisa de um companheiro que rode com essa cadência, não pode reaproveitar o mesmo timer sem ajuste.
- **Onboarding do aplicativo é mais pesado** — virar um "Third-party Partner Platform" na Shopee exige documentação de empresa registrada, URL de produto ao vivo com HTTPS/TLS 1.2, e conta de teste pra revisão. Isso é um processo de aprovação da Shopee, fora do controle do código — **vale iniciar esse cadastro cedo**, em paralelo à implementação, porque pode ser o item do cronograma mais lento a resolver.

Fontes: [Shopee API Guide — api2cart.com](https://api2cart.com/api-technology/shopee-api/), [Shopee Open Platform API Integration Guide — InlinexDev](https://developer.inlinex.com.sg/blog/shopee-api-integration-guide-sellers), [Shopee API — publicapis.io](https://publicapis.io/shopee-api).

### 1.2 O endpoint central: `POST /api/v2/product/add_item`

Cria o item base. Campos confirmados por múltiplas fontes: `item_name`, `description`, `category_id`, `price`, `stock`, `weight`, `image` (ver 1.5), `logistics_channel_id`.

Diferença de peso em relação ao ML: **`logistics_channel_id` é exigido já na criação do item**, não é algo que se resolve com um valor neutro como o `shipping.mode: "not_specified"` que a integração do ML usa hoje. Isso implica que a loja precisa ter pelo menos um canal de logística habilitado na conta Shopee (equivalente a "Correios"/"Mercado Envios") **antes** de publicar o primeiro item — provavelmente via `GET /api/v2/logistics/get_channel_list`, chamado uma vez pra listar os canais disponíveis pra loja e deixar o usuário escolher (ou fixar o único disponível), parecido com o padrão de `buscarTiposAnuncioDisponiveis` do ML mas pra frete, não pra tipo de anúncio.

Fontes: [Shopee API Guide — api2cart.com](https://api2cart.com/api-technology/shopee-api/), [python-shopee (pyshopee) — item.py](https://github.com/JimCurryWang/python-shopee/blob/master/pyshopee/item.py).

### 1.3 Categoria e atributos — vocabulário próprio, sem preditor confirmado

Como no Mercado Livre, a categoria da Shopee **não é** a árvore interna do sistema (`categorias`) — é outro vocabulário, resolvido por dois mecanismos:

- **`GET /api/v2/product/get_category`** — árvore de categorias da Shopee (equivalente a `buscarCategoriasRaizML`/`buscarCategoriaML` já implementados pro ML).
- **`GET /api/v2/product/category/attribute/get`** (ou `get_attribute_tree`, o nome exato varia entre fontes secundárias — **a confirmar no sandbox**) — atributos da categoria, com atributos **mandatórios** sinalizados, na mesma lógica do `tags.required` do ML.

**Diferença importante que não pôde ser confirmada**: nenhuma fonte consultada mencionou um equivalente ao **preditor de categoria** do Mercado Livre (que sugere a categoria a partir do título). Se a Shopee realmente não tem isso, a UX de escolha de categoria fica mais parecida com "navegação manual em árvore" (o segundo caminho que o modal do ML já implementa como `abrirNavegacaoCategoria`) do que com a busca com sugestão automática. **Verificar isso é o primeiro passo prático de qualquer fase de implementação** — se existir um endpoint de sugestão, o modal da Shopee pode reaproveitar a mesma UX de busca-com-sugestão; se não existir, o modal nasce só com navegação em árvore (ainda reaproveitável 1:1 do componente que já existe pro ML).

Também há evidência (não uma fonte oficial) de um **`get_brand_list`** — algumas categorias da Shopee exigem selecionar uma marca de uma lista fechada, parecido em espírito com o `catalog_required`/busca de produto de catálogo que o ML exige em algumas categorias — mas é um mecanismo diferente (lista de marcas, não produto de catálogo específico).

Fontes: [Shopee API — publicapis.io](https://publicapis.io/shopee-api), busca geral sem confirmação direta em documentação oficial para `get_brand_list` — **marcado como a confirmar**.

### 1.4 Variações: `tier_variation` / `model_list` — e a boa notícia do preço por variação

A Shopee representa variações num modelo de **até 2 níveis (tier)** — por exemplo Cor × Tamanho — chamado `tier_variation`. Cada combinação concreta vira um **"model"**, com seu próprio preço e estoque.

Limites confirmados por múltiplas fontes: **até 20 variações** em produto de 1 tier, **até 50** em produto de 2 tiers.

**Fluxo em dois passos** (segundo os SDKs de terceiros consultados — não confirmado na documentação oficial):
1. `add_item` cria o item base.
2. `init_tier_variation` inicializa o item como tier-variation e define preço/estoque de cada model — descrito como **não podendo editar** tier_variation/preço/estoque já existentes depois (atualizações usam endpoints separados, tipo `update_tier_variation_list`).

Isso é uma diferença arquitetural real em relação ao ML, onde `variations[]` vai dentro do mesmo `POST /items`. Se confirmado, `montarPayloadPublicacao` equivalente pra Shopee precisa orquestrar **duas chamadas em sequência** (criar item → inicializar variações), com o mesmo cuidado que `mercadolivrePublicacao.ts` já tem hoje para passos não-atômicos (ex: `atualizarDescricaoML` chamado depois do `POST /items`, tratado como best-effort separado). **A confirmar no sandbox antes de fechar o desenho do fluxo de publicação.**

**A parte boa**: ao contrário do Mercado Livre — que historicamente não aceitava preço diferente por variação e só liberou isso aos poucos por conta/categoria (o motivo do fallback "anúncio separado por ficha" que `publicarAnuncio` implementa hoje) —, a Shopee **parece suportar preço nativo por model desde sempre**, sem indício de rollout gradual nas fontes consultadas. Se confirmado, **o fallback de "N anúncios separados por ficha" provavelmente não é necessário pra Shopee** — simplificação real em relação ao desenho do ML. Ainda assim, a tabela de dados deveria deixar espaço pra isso (ver 3.1), por segurança e paridade de padrão, mesmo que a lógica de fallback em si só precise ser escrita se o teste no sandbox mostrar necessidade.

Fontes: [go-shopee — item_2tier_variation.go](https://github.com/passwind/go-shopee/blob/master/item_2tier_variation.go), [shopeego — model.go](https://github.com/teacat/shopeego/blob/master/model.go), [python-shopee — item.py](https://github.com/JimCurryWang/python-shopee/blob/master/pyshopee/item.py).

### 1.5 Fotos: upload binário, não URL por referência

Diferença de implementação relevante: o Mercado Livre aceita `pictures: [{ source: "https://..." }]` — manda a URL pública e o ML baixa sozinho. A Shopee **exige upload binário prévio**:

1. `POST /api/v2/media_space/upload_image` com o arquivo de imagem (multipart), devolve um `image_id`.
2. `add_item` referencia as fotos por `image_id_list`, não por URL.
3. As URLs do CDN da Shopee expiram — o `image_id` é o dado estável a guardar, não a URL.

Isso significa que a integração Shopee **não pode simplesmente reaproveitar `estoque.imagens`/`estoque_unidades.fotos` como estão** (que já são URLs públicas do Supabase Storage, prontas pro caso do ML) — precisa baixar os bytes de cada foto do Supabase Storage e re-subir pra Shopee via multipart antes de publicar. É um passo a mais de I/O, com seu próprio ponto de falha (mesma classe de problema que `detectarFotosNaoAnexadas` já trata pro ML, mas aqui o risco é anterior ao `add_item`, não depois).

Fontes: [IMAGE SPACE USER GUIDE — Shopee CDN](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/cbd4bb96bfdd8bb032f5ac3ba03edb36/Image%20Space%20User%20Guide%20(MY).pdf), [Uploading to Media Space — Shopee Seller Education](https://seller.shopee.com.my/edu/article/7190/upload-to-media-space), [Shopee API Guide — api2cart.com](https://api2cart.com/api-technology/shopee-api/).

### 1.6 Limites, sandbox e ambiente de teste

- **Rate limit**: por loja, ~10 requisições/segundo pra maioria dos endpoints — folgado pro tamanho de catálogo de uma sucata, mesmo diagnóstico que o ML já teve (não é o gargalo prático).
- **Sandbox existe** (`https://partner.test-stable.shopeemobile.com`), diferente do Mercado Livre, que não tem sandbox de itens e usa "usuários de teste" pra simular compra/venda numa conta descartável. A Shopee oferece um host de teste de verdade — mas as fontes avisam que **"muitas funcionalidades só funcionam em produção"**, sem listar exatamente quais. **Tratamento recomendado igual ao do ML**: testar no sandbox primeiro, mas não confiar cegamente nele — publicar 1 peça real de baixo valor na conta de produção antes de liberar o catálogo inteiro é prudente nos dois marketplaces, mesmo a Shopee tendo sandbox.

Fontes: [Shopee API Essential Guide — Rollout](https://rollout.com/integration-guides/shopee/api-essentials), [Shopee API Guide — api2cart.com](https://api2cart.com/api-technology/shopee-api/).

---

## Parte 2 — O que já existe no sistema (reaproveitável, sem tocar no ML)

A leitura de `mercadolivrePublicacao.ts`, `EstoquePublicarMlModal.tsx` e das migrations 014/025/026/043 confirma os padrões que esta proposta assume como base — **nenhum deles precisa ser reinventado pra Shopee**, só espelhado numa trilha de arquivos paralela:

- **Peça-mãe + fichas de unidade já existe e é neutro de marketplace**: `estoque` (a peça) + `estoque_unidades` (migração 014 — apelido, valor próprio opcional, fotos próprias) é exatamente o dado que precisa virar `tier_variation`/`model_list` da Shopee, do mesmo jeito que já virou `variations[]` do ML. Nenhuma mudança nessas duas tabelas é necessária.
- **N anúncios por peça já é o padrão**: `estoque_anuncios_ml` (migração 025) já provou o formato "tabela filha com `estoque_id`, índice único no id do anúncio no marketplace, `on delete cascade`" — a tabela nova da Shopee (ver 3.1) copia esse formato ao pé da letra.
- **Cache local de categoria/atributos com TTL** (`mercadolivre_categorias_cache`, populado por `buscarAtributosCategoriaComCache`) evita ida-e-volta na API a cada tecla — mesmo padrão vale pra Shopee, cujas chamadas de categoria também são raramente voláteis.
- **Estatísticas nunca são buscadas no clique do usuário** — sempre lidas de uma tabela `*_estatisticas` populada por scheduler em background (`sincronizarEstatisticas` + `mercadolivreScheduler.ts`). O modal de detalhes da peça nunca deve ganhar uma chamada síncrona à API da Shopee.
- **Degradação graciosa em migração ausente**: todo o código novo de `mercadolivrePublicacao.ts` trata `42703`/`42P01`/`PGRST205`/`PGRST204` como "tabela/coluna ainda não existe, funciona sem" — o código da Shopee replica exatamente esse padrão (`ehErroDeMigrationAusente`), não inventa um novo.
- **Margem de repasse fica na tabela de conexão** (`mercadolivre_conexao.margem_sincronizacao_percentual`, migração 026) — é um valor singleton por loja/canal, não uma tabela de config genérica. O equivalente Shopee guarda a própria margem na sua própria tabela de conexão (ver 3.1), com o mesmo raciocínio: taxas da Shopee são diferentes das do ML, então a margem também deveria poder ser diferente por canal.
- **`estoque_anuncios_ml_variacoes` liga variação → ficha de origem** (`unidade_id` nullable, `on delete set null`) — pra permitir atualizar/republicar uma variação específica depois. A tabela equivalente da Shopee replica esse vínculo com `model_id` no lugar de `ml_variation_id`.

---

## Parte 3 — Desenho da solução

Decisão de arquitetura confirmada com o usuário: **tabela específica** (`estoque_anuncios_shopee`), espelhando `estoque_anuncios_ml`/migração 043, em vez de generalizar para uma tabela `estoque_anuncios_marketplace` com coluna de canal. Motivo: a tabela genérica exigiria renomear/migrar `estoque_anuncios_ml` (índice único de `mlb_id`, RLS, todo o código que já lê/escreve nela) e mexeria de fato na integração ML que esta tarefa não deve tocar — risco desnecessário numa integração que já teve um incidente real de anúncio duplicado por lógica genérica de retry. Fica registrado como possível evolução futura: se um terceiro canal aparecer algum dia, uma `VIEW` que faz `UNION` entre `estoque_anuncios_ml` e `estoque_anuncios_shopee` resolve consultas cross-canal sem migrar dado nenhum.

### 3.1 Modelo de dados novo

Uma migração nova (o próximo número livre em `supabase/` no momento da implementação — no momento desta proposta o último é `migration_044_mercadolivre_fila_pedidos.sql`, então o próximo seria `migration_045`):

```sql
-- migration_0XX_shopee_publicacao.sql

-- Conexão com a loja Shopee — mesmo espírito de mercadolivre_conexao
-- (migração 021), mas com o vocabulário da Shopee: shop_id no lugar de
-- ml_user_id, access_token expira em 4h (não confundir com o de 30 dias do
-- refresh_token). partner_id/partner_key NÃO ficam aqui -- são credenciais
-- do aplicativo, não da loja, e vivem em variável de ambiente
-- ([SHOPEE_PARTNER_ID]/[SHOPEE_PARTNER_KEY]), mesmo padrão de
-- MERCADOLIVRE_CLIENT_SECRET.
create table shopee_conexao (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null unique,
  access_token text not null,
  refresh_token text not null,
  expira_em timestamptz not null,
  margem_sincronizacao_percentual numeric(5,2) not null default 30
    check (margem_sincronizacao_percentual >= 0),
  atualizado_em timestamptz not null default now()
);
alter table shopee_conexao enable row level security;

-- Anúncio criado na Shopee -- mesmo formato de estoque_anuncios_ml
-- (migração 025), com o vocabulário da Shopee: item_id é numérico e só é
-- único DENTRO de um shop_id (não globalmente único como o mlb_id do ML) --
-- por isso o índice único é composto.
create table estoque_anuncios_shopee (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references estoque(id) on delete cascade,
  shop_id text not null,
  item_id text not null,
  url text,
  category_id text,
  status_shopee text,
  atributos_shopee jsonb,
  publicado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index idx_estoque_anuncios_shopee_estoque on estoque_anuncios_shopee(estoque_id);
create unique index idx_estoque_anuncios_shopee_item on estoque_anuncios_shopee(shop_id, item_id);
alter table estoque_anuncios_shopee enable row level security;

-- Liga cada "model" (variação, Parte 1.4) à ficha de unidade que a
-- originou -- mesmo papel de estoque_anuncios_ml_variacoes.
create table estoque_anuncios_shopee_variacoes (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references estoque_anuncios_shopee(id) on delete cascade,
  unidade_id uuid references estoque_unidades(id) on delete set null,
  model_id text not null,
  preco numeric(10,2),
  quantidade integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index idx_estoque_anuncios_shopee_variacoes_link on estoque_anuncios_shopee_variacoes(link_id);
alter table estoque_anuncios_shopee_variacoes enable row level security;

-- Snapshot de estatísticas -- mesmo papel de estoque_anuncios_ml_estatisticas,
-- populado por scheduler, nunca lido chamando a Shopee no clique do usuário.
-- Campos exatos (visitas/vendas/etc.) a confirmar contra o que a API de
-- estatísticas da Shopee realmente devolve -- não pesquisado nesta proposta
-- em detalhe, mesmo princípio arquitetural do ML se aplica.
create table estoque_anuncios_shopee_estatisticas (
  link_id uuid primary key references estoque_anuncios_shopee(id) on delete cascade,
  visitas_total integer,
  vendas_totais integer,
  status_shopee text,
  atualizado_em timestamptz not null default now()
);
alter table estoque_anuncios_shopee_estatisticas enable row level security;

-- Cache local de categoria/atributos -- mesmo papel de
-- mercadolivre_categorias_cache.
create table shopee_categorias_cache (
  categoria_shopee_id text primary key,
  nome_shopee text not null,
  caminho text,
  atributos jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table shopee_categorias_cache enable row level security;

-- Padronizar categoria por categoria interna -- mesmo papel de
-- categorias.mercadolivre_categoria_id_padrao (migração 043). Coluna
-- separada da do ML: são vocabulários de categoria completamente
-- diferentes, uma peça pode ter padrões diferentes em cada canal.
alter table categorias add column shopee_categoria_id_padrao text;

NOTIFY pgrst, 'reload schema';
```

### 3.2 Backend

Estrutura em arquivos-espelho, sem tocar nos existentes:

- **`src/services/shopeeApi.ts`** (companheiro de `mercadolivreApi.ts`) — cliente puro: assinatura HMAC por requisição (função central chamada por todo o resto do arquivo, diferente do ML onde o `access_token` basta), fluxo OAuth + refresh a cada 4h, `buscarCategoriasShopee`, `buscarAtributosCategoriaShopee`, `buscarCanaisLogistica`, `uploadImagemShopee` (multipart, devolve `image_id`), `criarItemShopee` (`add_item`), `inicializarVariacoesShopee` (`init_tier_variation` — **a confirmar se realmente é uma chamada separada, ver 1.4**), `buscarEstatisticasItem`.
- **`src/services/shopeePublicacao.ts`** (companheiro de `mercadolivrePublicacao.ts`) — orquestração de domínio: cruza `estoque`/`estoque_unidades` com `shopeeApi.ts`, mesma separação de responsabilidade já usada no ML. `montarPayloadPublicacaoShopee` decide item simples vs. com `tier_variation` a partir de `estoque_unidades`, reaproveitando `obterMargemSincronizacao`-equivalente lido de `shopee_conexao.margem_sincronizacao_percentual` (não a coluna do ML — são canais diferentes, margens podem divergir).
- **Rotas novas** em `src/server/routes/shopee.ts` (novo arquivo, não em `mercadolivre.ts`) e rotas aninhadas em `src/server/routes/estoque.ts` no mesmo espírito de `/:id/publicar-ml` (`/:id/publicar-shopee`, `/:id/anuncios-shopee/:linkId/estatisticas`, etc.) — literalmente paralelas às do ML, sem misturar os dois roteadores.
- **Scheduler novo**, companheiro de `mercadolivreScheduler.ts`, com cadência própria compatível com o refresh de token de 4h da Shopee (mais frequente que o do ML).

### 3.3 Frontend

- **`src/features/shopee/`** — novo diretório espelhando `src/features/mercadolivre/` (api.ts, types.ts, tela de conexão OAuth).
- **`EstoquePublicarShopeeModal.tsx`** — novo componente em `src/features/estoque/`, companheiro de `EstoquePublicarMlModal.tsx`. Reaproveita a mesma estrutura de `ModalSection`s (Categoria, Atributos, Preço, Fotos, Variações), mas com as diferenças da Parte 1 refletidas na UI:
  - Sem preditor de categoria confirmado → a seção de categoria nasce só com navegação em árvore (reaproveitando o componente/lógica de `abrirNavegacaoCategoria`/`selecionarNoNavegacao` que já existe no modal do ML, sem duplicar a implementação se o componente puder ser extraído).
  - Seção "Frete" nova, ausente no modal do ML: escolher o canal de logística (`logistics_channel_id`) antes de poder publicar — é um campo obrigatório na Shopee que não existe como decisão do usuário no fluxo atual do ML.
  - Fotos: like o ML, reaproveita `estoque.imagens`/`estoque_unidades.fotos`, mas o botão "Publicar" dispara o upload binário pra Shopee (via `uploadImagemShopee`) antes do `add_item` — um passo de progresso a mais pra mostrar na UI (ex: "Enviando fotos... 2/5"), que o fluxo do ML não tem.
  - Se o fluxo de duas chamadas (`add_item` → `init_tier_variation`) for confirmado no sandbox, o botão "Publicar" cobre as duas chamadas numa única ação do usuário — como já acontece com `POST /items` + `POST /items/{id}/description` no ML hoje.
- **Onde o toggle entra**: mesma `ModalSection` de peça em `EstoqueView.tsx`, ao lado do que já existe pro ML — não decidido nesta proposta se vira uma seção "Canais de venda" unificada (Mercado Livre + Shopee juntos) ou duas seções independentes lado a lado; é uma decisão de UX de baixo risco (não mexe em código existente do ML de nenhuma forma) que pode ficar pra quando a Fase de UI da implementação da Shopee chegar, com uma tela de exemplo pra aprovação — o mesmo protocolo que a Fase 6 do prompt do ML já usa ("apresente o plano antes de mexer").

### 3.4 Fluxo de publicação (esboço, sujeito a ajuste após confirmar 1.4 no sandbox)

1. Usuário liga o toggle "Publicar na Shopee" na peça (seção independente da do ML).
2. Escolhe/navega a categoria; atributos da categoria carregam do cache local ou da API.
3. Escolhe canal de logística (frete) — se a loja só tem um habilitado, pré-selecionado.
4. Confirma fotos, preço, variações (se a peça tem `estoque_unidades` diferenciadas).
5. Backend faz upload das fotos pra Shopee, chama `add_item`, e (se aplicável) `init_tier_variation` com o preço de cada `estoque_unidade`.
6. Grava resultado em `estoque_anuncios_shopee` (+ `estoque_anuncios_shopee_variacoes`).
7. Dispara primeira leitura de estatísticas, mesmo padrão do ML.

---

## Diferenças-chave entre Mercado Livre e Shopee (risco pra UI/fluxo)

| Aspecto | Mercado Livre | Shopee | Impacto |
|---|---|---|---|
| Autenticação | OAuth simples, token no header | OAuth + assinatura HMAC por requisição | Cliente HTTP mais complexo; token expira em 4h (vs. horas mais longas no ML) |
| Fotos | URL por referência | Upload binário prévio (`image_id`) | Passo de I/O extra antes de publicar; progresso visível na UI |
| Variações | 1 chamada (`variations[]` no `POST /items`) | Possivelmente 2 chamadas (`add_item` + `init_tier_variation`) — a confirmar | Fluxo de publicação orquestra 2 passos em vez de 1 |
| Preço por variação | Rollout gradual, exige fallback (já implementado) | Aparenta suporte nativo desde sempre | Fallback de "N anúncios separados" provavelmente dispensável — a confirmar |
| Categoria | Preditor + navegação manual | Só navegação manual confirmada (preditor não encontrado) | UX de escolha de categoria mais lenta, sem sugestão automática |
| Frete | Campo neutro (`not_specified`), resolvido na venda | `logistics_channel_id` obrigatório na criação | Precisa de uma seção nova no modal que o ML não tem |
| Onboarding do app | Registro simples de app | Aprovação como "Partner Platform" com documentos | Pode ser o item mais lento do cronograma — vale iniciar cedo, em paralelo |
| Sandbox | Não existe pra itens (só usuário de teste) | Existe, mas fontes avisam que é limitado | Mesma cautela recomendada nos dois: testar 1 peça real de baixo valor antes de liberar o catálogo |

---

## Fontes consultadas

- [Shopee API Guide (2026) — api2cart.com](https://api2cart.com/api-technology/shopee-api/)
- [Shopee Open Platform API: A Developer's Integration Guide — InlinexDev](https://developer.inlinex.com.sg/blog/shopee-api-integration-guide-sellers)
- [Shopee API — Open Platform Key Setup, Auth & Endpoints Guide — publicapis.io](https://publicapis.io/shopee-api)
- [Shopee API Essential Guide — Rollout](https://rollout.com/integration-guides/shopee/api-essentials)
- [python-shopee (pyshopee) — item.py, GitHub](https://github.com/JimCurryWang/python-shopee/blob/master/pyshopee/item.py)
- [go-shopee — item_2tier_variation.go, GitHub](https://github.com/passwind/go-shopee/blob/master/item_2tier_variation.go)
- [shopeego — model.go, GitHub](https://github.com/teacat/shopeego/blob/master/model.go)
- [IMAGE SPACE USER GUIDE (MY) — Shopee CDN](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/cbd4bb96bfdd8bb032f5ac3ba03edb36/Image%20Space%20User%20Guide%20(MY).pdf)
- [Uploading to Media Space — MY Seller Education, Shopee](https://seller.shopee.com.my/edu/article/7190/upload-to-media-space)
- [Media Space Collection — PH Seller Education Hub, Shopee](https://seller.shopee.ph/edu/article/24772)

**Nota**: não foi possível acessar `open.shopee.com` (documentação oficial) diretamente nesta pesquisa. Os pontos marcados "a confirmar no sandbox" ao longo do documento precisam de verificação contra a documentação oficial ou uma conta de teste real antes da Fase 1 da implementação — são a maior fonte de incerteza desta proposta, bem diferente da proposta do ML, que citou a documentação oficial diretamente.

---

## Resumo: o que está pronto vs. o que ainda precisa de decisão

**Pronto pra virar prompt de implementação em fases:**
- Modelo de dados completo (3.1), já com a decisão de tabela específica confirmada.
- Mapeamento `estoque_unidades` → variações da Shopee (mesmo raciocínio já validado no ML).
- Estrutura de arquivos (backend e frontend) espelhando 1:1 o padrão do ML, sem tocar nele.
- Lista de diferenças-chave que a implementação precisa respeitar (tabela acima).

**Ainda precisa de decisão ou verificação antes ou durante a Fase 1:**
1. **Confirmar contra o sandbox real da Shopee** (ou a documentação oficial, se ficar acessível): se `init_tier_variation` é mesmo uma chamada separada de `add_item`, e o nome exato do endpoint de atributos de categoria (`get_attribute_tree` vs. `category/attribute/get`).
2. **Confirmar se existe preditor de categoria** — muda a UX da seção de categoria do modal (busca com sugestão vs. só navegação em árvore).
3. **Confirmar se preço por variação é mesmo nativo sem rollout gradual** — decide se o fallback de "anúncio separado por ficha" (que o ML precisa) é necessário pra Shopee ou pode ser dispensado.
4. **Iniciar o processo de aprovação como Partner Platform na Shopee** o quanto antes — é um processo externo (documentos, revisão), fora do controle do código, e pode ser o item mais lento do cronograma.
5. **Decisão de UX de baixo risco, não bloqueante**: seção "Canais de venda" unificada (ML + Shopee) vs. duas seções independentes no modal de peça — pode ficar pra ser decidida durante a Fase de UI, com uma tela de exemplo pra aprovação prévia (mesmo protocolo já usado na Fase 6 do prompt do ML).
