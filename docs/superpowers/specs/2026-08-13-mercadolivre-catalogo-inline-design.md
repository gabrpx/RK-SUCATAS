# Vínculo de catálogo do Mercado Livre inline no formulário de publicação

**Projeto:** RK Sucatas — SISTEMA CLAUDE
**Data:** 2026-08-13

## Contexto e problema

`EstoquePublicarMlModal.tsx` publica peças novas no Mercado Livre direto do
catálogo interno (migration_043). Quando a categoria escolhida tem algum
atributo marcado `tags.catalog_required` pela API do ML (`GET
/categories/{id}/attributes`), o formulário hoje **bloqueia** a publicação
inteira: mostra um aviso e manda o usuário publicar manualmente pelo site do
Mercado Livre, depois colar o link em "Anúncios no Mercado Livre".

Essa suposição — documentada em `docs/proposta-publicacao-mercadolivre.md`
linha 38 como "não deve aparecer em autopeças usadas" — se mostrou errada
depois que a Fase A capturou dados reais da API pra categoria MLB46593
("Carenagem", peça de moto): `BRAND` e `PART_NUMBER` vêm com
`catalog_required: true` também nesse domínio. O bloqueio está impedindo
publicações legítimas de autopeças.

Investigação confirmou (developers.mercadolivre.com.br, páginas
"Catalog required listings" e "Catalog listing", pt_br "Buscador de
produtos") que o próprio site do Mercado Livre **não bloqueia** a
publicação nessas categorias — ele busca produtos de catálogo parecidos
pelo título, deixa o vendedor escolher um ou, se nada bater, clicar em
"Não é o que eu vendo" e publicar como anúncio tradicional (que fica sujeito
a uma moderação futura via tag `catalog_forewarning`, não a um bloqueio
imediato).

## Objetivo

Substituir o bloqueio por uma busca inline no mesmo modal, replicando essa
experiência: nunca escolhe sozinho por trás dos panos, sempre mostra o que
achou (ou nada achou) e deixa o usuário decidir — vincular a um produto do
catálogo ou seguir sem vínculo.

## Fora de escopo (YAGNI)

- Fluxo de "pedir inclusão de novo produto no catálogo" via `POST
  /items/catalog_listings` de um item que ainda não existe — caso raro,
  fica pro site oficial do ML por enquanto.
- Reimplementar a sincronização automática de preço/estoque entre o
  anúncio e o produto de catálogo pai — o próprio Mercado Livre já faz isso
  sozinho (`item_relations`, seção "Sales conditions sync" da doc oficial).
- Mensagens de erro específicas por código de catálogo (417, 4402, 4310
  etc.) — cai no tratamento genérico (`aviso.falha`) que já existe.
- Busca por GTIN/código de barras — a peça não tem esse campo no cadastro
  hoje, só busca por título (`q`).
- Qualquer tratamento do prazo de moderação (`catalog_forewarning`) —
  passou a ser possível publicar sem vínculo, mas acompanhar esse prazo é
  melhoria futura, não parte desta.

## Design

### Fluxo do usuário

1. Categoria selecionada → atributos carregam (fluxo já existente). Se
   algum atributo vier com `tags.catalog_required`, o modal dispara
   automaticamente uma busca de produtos de catálogo usando o nome da peça
   (mesmo debounce de 400ms já usado na busca de categoria).
2. Resultados (cada um com nome + foto, quando disponível) aparecem como
   cards clicáveis — mesmo padrão visual da lista de sugestão de categoria
   que já existe no mesmo arquivo.
3. Usuário clica num card → aquele produto de catálogo fica selecionado.
   Se a peça tiver 2+ fichas de unidade elegíveis a variação
   (`variacaoDisponivel`), a seção "Variações" é substituída por um aviso
   explicando que catálogo não aceita variação — cada ficha viraria um
   anúncio catálogo separado, fora de escopo aqui (ver "Fora de escopo").
4. Usuário clica em "Não é o que eu vendo" → segue exatamente o fluxo de
   hoje: anúncio tradicional, seção de Variações disponível normalmente.
5. Botão "Publicar anúncio" fica habilitado assim que uma das duas escolhas
   acima for feita (hoje fica sempre desabilitado quando `exigeCatalogo`).
6. Publicar: se houver produto de catálogo escolhido, o `POST /items`
   ganha `catalog_product_id` e `catalog_listing: true`, e a publicação
   sempre sai como item simples (sem `variations[]`). Sem produto
   escolhido, o payload é idêntico ao que já existe hoje.

### Backend

**`src/services/mercadolivreApi.ts`** — nova função pura, mesmo padrão de
`buscarAtributosCategoriaML`/`predizerCategoria` (usa a constante `SITE_ID
= 'MLB'` já existente no arquivo):

```ts
export interface ProdutoCatalogoML {
  id: string;
  name: string;
  status: string;
  pictures?: { url: string }[];
  attributes: { id: string; name: string; value_name: string | null }[];
}

// GET /products/search — "reconhecimento de produtos" antes de publicar
// numa categoria catalog_required (ver "Catalog required listings" em
// developers.mercadolivre.com.br). status=active exclui produtos que não
// podem receber novo vínculo; listing_strategy=catalog_required filtra só
// os que de fato pedem catálogo (existe também catalog_optional).
export async function buscarProdutosCatalogoML(token: string, titulo: string): Promise<ProdutoCatalogoML[]> {
  const { data } = await axios.get(`${ML_API_URL}/products/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { status: 'active', site_id: SITE_ID, listing_strategy: 'catalog_required', q: titulo },
  });
  return data?.results ?? [];
}
```

**`src/services/mercadolivrePublicacao.ts`**:

- Nova função de domínio `buscarProdutosCatalogo(token, titulo)` que chama
  `buscarProdutosCatalogoML` e mapeia pro tipo simples que a UI consome
  (`{ id, nome, foto }` — mesma convenção de nomes em português dos outros
  mapeamentos deste arquivo).
- `ConfiguracaoAnuncioMl` ganha `catalogoProdutoId?: string`.
- `montarPayloadPublicacao`: quando `config.catalogoProdutoId` está
  presente, o `base` do payload ganha `catalog_product_id` e
  `catalog_listing: true`, e a função **ignora `config.variacoes`**
  mesmo que venha preenchido (sempre retorna `usaVariacoes: false`) — a
  UI já deveria ter impedido essa combinação (passo 3 do fluxo acima),
  isto é defesa em profundidade, não o único lugar que garante a regra.
- `gravarResultadoPublicacao`: quando havia `catalogoProdutoId`, grava
  `{ catalog_product_id: config.catalogoProdutoId }` dentro do jsonb
  `atributos_ml` já existente (mesmo padrão hoje usado pra
  `origem_unidade_id`) — **sem migration nova**.
- `export` em `montarPayloadPublicacao` (hoje é função privada do módulo)
  pra poder testar diretamente, mesmo padrão de `listarFilhosCategoria` e
  `buscarTiposAnuncioDisponiveis`, que já são exportadas e testadas em
  `mercadolivrePublicacao.test.ts`.

**`src/server/routes/mercadolivre.ts`** — nova rota, ao lado de
`/categorias/sugerir`, `/categorias/filhos` e `/categorias/:id/atributos`
(não em `estoque.ts`: é uma consulta sobre catálogo/conta ML, não sobre
uma peça específica — mesmo critério já usado pras outras três rotas de
publicação):

```ts
router.get('/produtos-catalogo', async (req, res) => {
  try {
    const titulo = String(req.query.titulo || '').trim();
    if (!titulo) return res.status(400).json({ success: false, error: 'Informe um título pra buscar produtos de catálogo' });

    const conexao = await obterConexaoAtual(supabase);
    if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

    const produtos = await buscarProdutosCatalogo(conexao.accessToken, titulo);
    res.json({ success: true, data: produtos });
  } catch (error: any) {
    console.error('Erro ao buscar produtos de catálogo do Mercado Livre:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: mensagemErro(error) });
  }
});
```

**`src/server/routes/estoque.ts`** — `montarConfiguracaoPublicacao` passa a
ler `body?.catalogo_produto_id` (opcional) e repassar como
`catalogoProdutoId` no `config` retornado.

### Frontend

**`src/features/estoque/types.ts`**:
- Novo tipo `ProdutoCatalogoMl { id: string; nome: string; foto: string | null }`.
- `ConfiguracaoAnuncioMlInput` ganha `catalogo_produto_id?: string`.

**`src/features/mercadolivre/api.ts`**:
```ts
buscarProdutosCatalogo: (titulo: string) =>
  api.get(`/api/mercadolivre/produtos-catalogo?titulo=${encodeURIComponent(titulo)}`) as Promise<ApiResult<ProdutoCatalogoMl[]>>,
```

**`src/features/estoque/EstoquePublicarMlModal.tsx`**:
- Novo estado: `produtosCatalogo: ProdutoCatalogoMl[]`, `buscandoCatalogo: boolean`,
  `produtoCatalogoSelecionado: ProdutoCatalogoMl | null`, `naoEhCatalogo: boolean`.
- `useEffect` que dispara a busca quando `exigeCatalogo` fica `true` (usa
  `buscaCategoria` — o mesmo campo de título já digitado pra achar a
  categoria — como `titulo`), reseta a seleção quando a categoria muda.
- Bloco que hoje só mostra o aviso (`exigeCatalogo && (...)`) passa a
  renderizar: lista de cards de `produtosCatalogo` (clicável, seleciona),
  estado de carregando, e um botão/link "Não é o que eu vendo" que seta
  `naoEhCatalogo = true`.
- `podePublicar`: troca `!exigeCatalogo` por
  `(!exigeCatalogo || !!produtoCatalogoSelecionado || naoEhCatalogo)`.
- Seção "Variações" (`unidadesElegiveis.length >= 2`): quando
  `produtoCatalogoSelecionado` está setado, mostra aviso substituto em vez
  do conteúdo normal ("Esta peça está vinculada a um produto de catálogo —
  catálogo não aceita variações, o anúncio sai com o preço base único.
  Clique em 'Não é o que eu vendo' se precisar publicar com variações.").
- `publicar()`: inclui `catalogo_produto_id: produtoCatalogoSelecionado?.id`
  no payload quando presente.

### Testes

Unitário (vitest, sem testing-library — convenção já usada neste projeto)
em `mercadolivrePublicacao.test.ts`, cobrindo `montarPayloadPublicacao`:

- Com `catalogoProdutoId` presente → payload tem `catalog_product_id` e
  `catalog_listing: true`, e a função retorna `usaVariacoes: false` mesmo
  passando 2+ variações válidas em `config.variacoes`.
- Sem `catalogoProdutoId` → payload idêntico ao comportamento atual (sem
  os dois campos novos), variações continuam funcionando como hoje.

Verificação manual: usuário de teste do Mercado Livre (`criarUsuarioTesteML`,
já existe no cliente puro), buscar uma peça real de categoria
`catalog_required` (ex: peça de "Carenagem"), confirmar que a busca acha
candidatos, publicar vinculado e depois publicar via "Não é o que eu
vendo" — comparar os dois anúncios criados no ML.
