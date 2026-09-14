# Vínculo de catálogo do Mercado Livre inline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o bloqueio de "esta categoria exige catálogo" no formulário de publicação do Mercado Livre por uma busca inline de produtos de catálogo, com opção de vincular ou seguir sem vínculo ("Não é o que eu vendo"), igual ao fluxo real do site do ML.

**Architecture:** Nova função pura em `mercadolivreApi.ts` chama `GET /products/search`; uma função de domínio em `mercadolivrePublicacao.ts` expõe isso pro formulário e ajusta `montarPayloadPublicacao` pra incluir `catalog_product_id`/`catalog_listing` e desativar variações quando um produto é escolhido; uma rota nova em `mercadolivre.ts` expõe a busca; o modal `EstoquePublicarMlModal.tsx` troca o aviso de bloqueio por uma lista de resultados clicável + escape hatch. Sem migration — o vínculo escolhido é gravado no jsonb `atributos_ml` que já existe.

**Tech Stack:** TypeScript, Express, React, Supabase, axios, Vitest (sem testing-library).

## Global Constraints

- Nunca usar cor decorativa — toda cor carrega significado (ver `CLAUDE.md`, design system em `src/styles/theme.css`). Usar classes existentes (`bg-surface-inset`, `text-text-muted`, `border-warning`, `bg-accent-soft-bg`, etc.), nunca hex direto.
- No máximo 1 botão de acento preenchido por tela — o botão "Publicar anúncio" já ocupa esse lugar no rodapé do modal; os novos elementos (cards de produto, "Não é o que eu vendo") usam estilos outline/ghost/texto, nunca `bg-accent` sólido.
- Sem migration nova — vínculo de catálogo grava em `estoque_anuncios_ml.atributos_ml` (jsonb já existente).
- Site fixo `MLB` (constante `SITE_ID` já existente em `mercadolivreApi.ts`) — esta integração nunca é Global Selling/CBT.
- Testes automatizados só para lógica pura (funções em `mercadolivrePublicacao.ts`), seguindo o padrão já existente no repo — sem testing-library, sem renderizar o componente React em teste.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/services/mercadolivreApi.ts` | Modify — nova função pura `buscarProdutosCatalogoML` (`GET /products/search`). |
| `src/services/mercadolivrePublicacao.ts` | Modify — função de domínio `buscarProdutosCatalogo`; `ConfiguracaoAnuncioMl.catalogoProdutoId`; `montarPayloadPublicacao` exportada e ajustada; `gravarResultadoPublicacao` grava o vínculo. |
| `src/services/mercadolivrePublicacao.test.ts` | Modify — testes novos para `buscarProdutosCatalogo` e `montarPayloadPublicacao`. |
| `src/server/routes/mercadolivre.ts` | Modify — rota `GET /produtos-catalogo`. |
| `src/server/routes/estoque.ts` | Modify — `montarConfiguracaoPublicacao` lê `catalogo_produto_id`. |
| `src/features/estoque/types.ts` | Modify — tipo `ProdutoCatalogoMl`; `ConfiguracaoAnuncioMlInput.catalogo_produto_id`. |
| `src/features/mercadolivre/api.ts` | Modify — client `buscarProdutosCatalogo`. |
| `src/features/estoque/EstoquePublicarMlModal.tsx` | Modify — busca inline, seleção, escape hatch, bloqueio de variações, payload. |

---

### Task 1: Buscar produtos de catálogo — API pura + função de domínio testada

**Files:**
- Modify: `src/services/mercadolivreApi.ts`
- Modify: `src/services/mercadolivrePublicacao.ts`
- Test: `src/services/mercadolivrePublicacao.test.ts`

**Interfaces:**
- Produces: `buscarProdutosCatalogoML(token: string, titulo: string): Promise<ProdutoCatalogoML[]>` em `mercadolivreApi.ts`, onde `ProdutoCatalogoML = { id: string; name: string; status: string; pictures?: { url: string }[]; attributes: { id: string; name: string; value_name: string | null }[] }`.
- Produces: `buscarProdutosCatalogo(token: string, titulo: string): Promise<ProdutoCatalogoMl[]>` em `mercadolivrePublicacao.ts`, onde `ProdutoCatalogoMl = { id: string; nome: string; foto: string | null }` (exportada — Task 4 e 5 importam esse tipo).

- [ ] **Step 1: Escrever o teste que falha**

Abra `src/services/mercadolivrePublicacao.test.ts` e adicione `buscarProdutosCatalogoML` ao mock existente e um novo `describe`:

```ts
vi.mock('./mercadolivreApi.js', () => ({
  buscarCategoriasRaizML: vi.fn(),
  buscarCategoriaML: vi.fn(),
  buscarTiposAnuncioML: vi.fn(),
  buscarProdutosCatalogoML: vi.fn(),
}));

import { buscarCategoriasRaizML, buscarCategoriaML, buscarTiposAnuncioML, buscarProdutosCatalogoML } from './mercadolivreApi.js';
import { listarFilhosCategoria, buscarTiposAnuncioDisponiveis, buscarProdutosCatalogo } from './mercadolivrePublicacao.js';
```

(As duas primeiras linhas substituem o `vi.mock`/`import` existentes no topo do arquivo — só adicionam a entrada nova, mantendo as três já presentes.)

Depois, no final do arquivo, adicione:

```ts
describe('buscarProdutosCatalogo', () => {
  it('mapeia resultados da API pra {id, nome, foto}, usando a primeira foto quando existir', async () => {
    vi.mocked(buscarProdutosCatalogoML).mockResolvedValue([
      {
        id: 'MLB123456',
        name: 'Carenagem CB 300R Vermelha',
        status: 'active',
        pictures: [{ url: 'https://http2.mlstatic.com/foto1.jpg' }],
        attributes: [],
      },
      {
        id: 'MLB123457',
        name: 'Carenagem CB 300R Preta',
        status: 'active',
        attributes: [],
      },
    ]);

    const produtos = await buscarProdutosCatalogo('token-fake', 'Carenagem CB 300R');

    expect(buscarProdutosCatalogoML).toHaveBeenCalledWith('token-fake', 'Carenagem CB 300R');
    expect(produtos).toEqual([
      { id: 'MLB123456', nome: 'Carenagem CB 300R Vermelha', foto: 'https://http2.mlstatic.com/foto1.jpg' },
      { id: 'MLB123457', nome: 'Carenagem CB 300R Preta', foto: null },
    ]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/services/mercadolivrePublicacao.test.ts`
Expected: FAIL — `buscarProdutosCatalogoML`/`buscarProdutosCatalogo` não existem ainda (erro de import/undefined).

- [ ] **Step 3: Implementar a função pura em `mercadolivreApi.ts`**

Adicione logo depois de `buscarAtributosCategoriaML` (por volta da linha 304, antes de `export interface TipoAnuncioPrecoML`):

```ts
export interface ProdutoCatalogoML {
  id: string;
  name: string;
  status: string;
  pictures?: { url: string }[];
  attributes: { id: string; name: string; value_name: string | null }[];
}

// GET /products/search — "reconhecimento de produtos" antes de publicar numa
// categoria catalog_required (ver "Catalog required listings" em
// developers.mercadolivre.com.br). status=active exclui produtos que não
// podem receber novo vínculo; listing_strategy=catalog_required filtra só os
// que de fato pedem catálogo (existe também catalog_optional, que não nos
// interessa aqui).
export async function buscarProdutosCatalogoML(token: string, titulo: string): Promise<ProdutoCatalogoML[]> {
  const { data } = await axios.get(`${ML_API_URL}/products/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { status: 'active', site_id: SITE_ID, listing_strategy: 'catalog_required', q: titulo },
  });
  return data?.results ?? [];
}
```

- [ ] **Step 4: Implementar a função de domínio em `mercadolivrePublicacao.ts`**

Adicione `buscarProdutosCatalogoML` ao import de `./mercadolivreApi.js` no topo do arquivo (junto dos outros já importados), e adicione, logo depois de `buscarAtributosCategoriaComCache` (antes da seção "Tipos de anúncio disponíveis"):

```ts
export interface ProdutoCatalogoMl {
  id: string;
  nome: string;
  foto: string | null;
}

// "Reconhecer produtos" antes de publicar — busca por título, mesma
// experiência do site oficial do ML (não filtra por categoria: o próprio
// listing_strategy=catalog_required já restringe a busca ao que interessa).
export async function buscarProdutosCatalogo(token: string, titulo: string): Promise<ProdutoCatalogoMl[]> {
  const produtos = await buscarProdutosCatalogoML(token, titulo);
  return produtos.map((p) => ({ id: p.id, nome: p.name, foto: p.pictures?.[0]?.url ?? null }));
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/services/mercadolivrePublicacao.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os já existentes).

- [ ] **Step 6: Typecheck**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add src/services/mercadolivreApi.ts src/services/mercadolivrePublicacao.ts src/services/mercadolivrePublicacao.test.ts
git commit -m "feat: busca produtos de catálogo do Mercado Livre por título"
```

---

### Task 2: `montarPayloadPublicacao` ganha vínculo de catálogo e desativa variações

**Files:**
- Modify: `src/services/mercadolivrePublicacao.ts:167-278` (interface `ConfiguracaoAnuncioMl` e `montarPayloadPublicacao`), e `gravarResultadoPublicacao` (~linha 296-333)
- Test: `src/services/mercadolivrePublicacao.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores diretamente (independente de Task 1, mas ambas tocam o mesmo arquivo — aplicar depois de Task 1 pra evitar conflito de merge).
- Produces: `ConfiguracaoAnuncioMl.catalogoProdutoId?: string`; `montarPayloadPublicacao` agora `export`ada (deixa de ser função privada do módulo) com a mesma assinatura de hoje: `(item: ItemParaPublicar, unidades: UnidadeParaPublicar[], config: ConfiguracaoAnuncioMl, margemPercentual: number): PayloadPublicacao`.

- [ ] **Step 1: Escrever o teste que falha**

No topo do arquivo de teste, adicione `montarPayloadPublicacao` ao import que já existe de `'./mercadolivrePublicacao.js'` (o mesmo import ajustado no Task 1, Step 1 — mantenha `buscarProdutosCatalogo` que já está lá):

```ts
import { listarFilhosCategoria, buscarTiposAnuncioDisponiveis, buscarProdutosCatalogo, montarPayloadPublicacao } from './mercadolivrePublicacao.js';
```

No final do arquivo, adicione:

```ts
describe('montarPayloadPublicacao', () => {
  const item = { nome: 'Carenagem CB 300R', valor: 100, quantidade: 1 };
  const unidades = [
    { id: 'u1', valor: 90, fotos: ['foto1.jpg'] },
    { id: 'u2', valor: 95, fotos: ['foto2.jpg'] },
  ];
  const variacoes = [
    { unidadeId: 'u1', atributos: [{ id: 'COLOR', value_name: 'Preta' }] },
    { unidadeId: 'u2', atributos: [{ id: 'COLOR', value_name: 'Vermelha' }] },
  ];

  it('com catalogoProdutoId, payload leva catalog_product_id/catalog_listing e NUNCA variations, mesmo com 2+ variações válidas', () => {
    const config = {
      categoriaMlId: 'MLB46593',
      condicaoMl: 'used' as const,
      listingTypeId: 'gold_special',
      atributos: [],
      fotos: ['capa.jpg'],
      catalogoProdutoId: 'MLB123456',
      variacoes,
    };

    const resultado = montarPayloadPublicacao(item, unidades, config, 30);

    expect(resultado.usaVariacoes).toBe(false);
    expect(resultado.payload.catalog_product_id).toBe('MLB123456');
    expect(resultado.payload.catalog_listing).toBe(true);
    expect(resultado.payload.variations).toBeUndefined();
  });

  it('sem catalogoProdutoId, payload não leva campos de catálogo e variações continuam funcionando', () => {
    const config = {
      categoriaMlId: 'MLB46593',
      condicaoMl: 'used' as const,
      listingTypeId: 'gold_special',
      atributos: [],
      fotos: ['capa.jpg'],
      variacoes,
    };

    const resultado = montarPayloadPublicacao(item, unidades, config, 30);

    expect(resultado.usaVariacoes).toBe(true);
    expect(resultado.payload.catalog_product_id).toBeUndefined();
    expect(resultado.payload.catalog_listing).toBeUndefined();
    expect(resultado.payload.variations).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/services/mercadolivrePublicacao.test.ts`
Expected: FAIL — `montarPayloadPublicacao` não é exportada ainda / `catalogoProdutoId` não existe no tipo.

- [ ] **Step 3: Ajustar `ConfiguracaoAnuncioMl`**

Em `src/services/mercadolivrePublicacao.ts`, na interface `ConfiguracaoAnuncioMl` (por volta da linha 167-181), adicione o campo novo depois de `variacoes`:

```ts
export interface ConfiguracaoAnuncioMl {
  categoriaMlId: string;
  condicaoMl: 'new' | 'used';
  listingTypeId: string;
  atributos: AtributoValorConfig[];
  fotos: string[];
  precoEfetivoSistema?: number;
  variacoes?: VariacaoConfig[];
  // Produto de catálogo escolhido na busca inline (categorias
  // catalog_required) — presente força item simples (o Mercado Livre não
  // aceita variations[] em anúncio catalog_listing:true), ver
  // montarPayloadPublicacao abaixo.
  catalogoProdutoId?: string;
}
```

- [ ] **Step 4: Exportar e ajustar `montarPayloadPublicacao`**

Troque a assinatura `function montarPayloadPublicacao(` por `export function montarPayloadPublicacao(`.

Dentro da função, logo depois de onde `base` é montado (depois do fechamento do objeto `base`, antes do cálculo de `variacoesValidas`), adicione:

```ts
  if (config.catalogoProdutoId) {
    base.catalog_product_id = config.catalogoProdutoId;
    base.catalog_listing = true;
  }
```

E troque a linha de `variacoesValidas` (hoje `const variacoesValidas = (config.variacoes ?? []).filter(...)`) por:

```ts
  // Produto de catálogo escolhido = nunca variations[] (o Mercado Livre não
  // aceita variação em item catalog_listing:true — cada ficha viraria um
  // anúncio catálogo separado, fora de escopo). A UI já evita chegar aqui
  // com variações preenchidas; isto é defesa em profundidade.
  const variacoesValidas = config.catalogoProdutoId ? [] : (config.variacoes ?? []).filter((v) => v.atributos.length > 0 && unidadesPorId.has(v.unidadeId));
```

- [ ] **Step 5: Gravar o vínculo em `gravarResultadoPublicacao`**

Na função `gravarResultadoPublicacao` (~linha 296-333), troque a linha:

```ts
      atributos_ml: origemUnidadeId ? { origem_unidade_id: origemUnidadeId } : null,
```

por:

```ts
      atributos_ml: origemUnidadeId
        ? { origem_unidade_id: origemUnidadeId }
        : config.catalogoProdutoId
          ? { catalog_product_id: config.catalogoProdutoId }
          : null,
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/services/mercadolivrePublicacao.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 7: Typecheck**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 8: Commit**

```bash
git add src/services/mercadolivrePublicacao.ts src/services/mercadolivrePublicacao.test.ts
git commit -m "feat: publicação vinculada a catálogo força item simples e grava o vínculo"
```

---

### Task 3: Rota de busca e recebimento do vínculo escolhido

**Files:**
- Modify: `src/server/routes/mercadolivre.ts`
- Modify: `src/server/routes/estoque.ts:226-256` (`montarConfiguracaoPublicacao`)

**Interfaces:**
- Consumes: `buscarProdutosCatalogo(token, titulo)` do Task 1; `ConfiguracaoAnuncioMl.catalogoProdutoId` do Task 2.
- Produces: rota `GET /api/mercadolivre/produtos-catalogo?titulo=X` → `{ success: true, data: ProdutoCatalogoMl[] }`; `montarConfiguracaoPublicacao` passa a preencher `config.catalogoProdutoId` a partir de `body.catalogo_produto_id`.

Sem teste automatizado nesta task — rotas Express não têm arquivo de teste neste repo (confirmado: não existe nenhum `*.test.ts` em `src/server/routes/`); a verificação é o typecheck + teste manual do Task 5.

- [ ] **Step 1: Importar a função de domínio em `mercadolivre.ts`**

No topo de `src/server/routes/mercadolivre.ts`, na linha do import de `../../services/mercadolivrePublicacao.js` (linha 24), adicione `buscarProdutosCatalogo` à lista:

```ts
import { sugerirCategoria, buscarAtributosCategoriaComCache, buscarTiposAnuncioDisponiveis, listarFilhosCategoria, buscarProdutosCatalogo } from '../../services/mercadolivrePublicacao.js';
```

- [ ] **Step 2: Adicionar a rota**

Logo depois da rota `/categorias/:id/atributos` (antes de `/tipos-anuncio`, por volta da linha 390), adicione:

```ts
  // Busca produtos de catálogo parecidos com o título — "reconhecer
  // produtos" antes de publicar numa categoria catalog_required (Parte do
  // fluxo de EstoquePublicarMlModal.tsx: escolhe um produto ou segue sem
  // vínculo, "Não é o que eu vendo").
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

- [ ] **Step 3: Aceitar `catalogo_produto_id` em `montarConfiguracaoPublicacao`**

Em `src/server/routes/estoque.ts`, dentro de `montarConfiguracaoPublicacao` (linha 226-256), adicione o campo no objeto `config` retornado, depois de `variacoes`:

```ts
  return {
    config: {
      categoriaMlId,
      condicaoMl: body.condicao_ml,
      listingTypeId,
      atributos: Array.isArray(body?.atributos) ? body.atributos.map(montarAtributoConfig) : [],
      fotos,
      precoEfetivoSistema: body?.preco_efetivo_sistema != null ? Number(body.preco_efetivo_sistema) : undefined,
      variacoes,
      catalogoProdutoId: body?.catalogo_produto_id ? String(body.catalogo_produto_id) : undefined,
    },
  };
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add src/server/routes/mercadolivre.ts src/server/routes/estoque.ts
git commit -m "feat: rota de busca de produtos de catálogo e recebimento do vínculo escolhido"
```

---

### Task 4: Tipos e client HTTP do frontend

**Files:**
- Modify: `src/features/estoque/types.ts`
- Modify: `src/features/mercadolivre/api.ts`

**Interfaces:**
- Consumes: rota `GET /api/mercadolivre/produtos-catalogo` do Task 3.
- Produces: tipo `ProdutoCatalogoMl` (exportado de `src/features/estoque/types.ts`); `mercadolivreApi.buscarProdutosCatalogo(titulo: string): Promise<ApiResult<ProdutoCatalogoMl[]>>`; `ConfiguracaoAnuncioMlInput.catalogo_produto_id?: string`.

Sem teste automatizado — são apenas tipos e uma função de wiring HTTP, mesmo padrão das funções vizinhas (`sugerirCategoria`, `buscarAtributosCategoria`) que também não têm teste direto.

- [ ] **Step 1: Adicionar o tipo em `types.ts`**

Em `src/features/estoque/types.ts`, logo depois da interface `AtributoMl` (linha 118-125), adicione:

```ts
// Um produto de catálogo do Mercado Livre encontrado na busca por título —
// ver GET /api/mercadolivre/produtos-catalogo. `foto` é null quando o
// produto não tem nenhuma imagem cadastrada no catálogo.
export interface ProdutoCatalogoMl {
  id: string;
  nome: string;
  foto: string | null;
}
```

E em `ConfiguracaoAnuncioMlInput` (linha 155-163), adicione o campo depois de `variacoes`:

```ts
export interface ConfiguracaoAnuncioMlInput {
  categoria_ml_id: string;
  condicao_ml: 'new' | 'used';
  listing_type_id: string;
  atributos: AtributoValorInput[];
  fotos: string[];
  preco_efetivo_sistema?: number;
  variacoes?: VariacaoMlInput[];
  // Produto de catálogo escolhido na busca inline — ausente = publica sem
  // vínculo (fluxo "Não é o que eu vendo" ou categoria que não exige catálogo).
  catalogo_produto_id?: string;
}
```

- [ ] **Step 2: Adicionar o client em `api.ts`**

Em `src/features/mercadolivre/api.ts`, adicione `ProdutoCatalogoMl` ao import de tipos de `../estoque/types` (linha 20):

```ts
import type { CategoriaMlSugerida, CategoriaMlNo, AtributoMl, TipoAnuncioMl, ProdutoCatalogoMl } from '../estoque/types';
```

E adicione a função ao objeto `mercadolivreApi`, logo depois de `buscarAtributosCategoria` (linha 117):

```ts
  buscarProdutosCatalogo: (titulo: string) =>
    api.get(`/api/mercadolivre/produtos-catalogo?titulo=${encodeURIComponent(titulo)}`) as Promise<ApiResult<ProdutoCatalogoMl[]>>,
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/features/estoque/types.ts src/features/mercadolivre/api.ts
git commit -m "feat: tipos e client HTTP pra busca de produtos de catálogo"
```

---

### Task 5: Busca inline e seleção no modal de publicação

**Files:**
- Modify: `src/features/estoque/EstoquePublicarMlModal.tsx`

**Interfaces:**
- Consumes: `mercadolivreApi.buscarProdutosCatalogo` (Task 4); tipo `ProdutoCatalogoMl` (Task 4); `exigeCatalogo` (já existe no arquivo, linha 302); `categoriaSelecionada`, `buscaCategoria` (já existem).
- Produces: estado `produtoCatalogoSelecionado: ProdutoCatalogoMl | null` — Task 6 usa isso pra desativar variações e montar o payload.

Sem teste automatizado — é estado/JSX de componente React, e o repo não usa testing-library (só `classificarAtributos`, uma função pura extraída, tem teste). Verificação é manual, no dev server (Step final desta task).

- [ ] **Step 1: Importar o tipo novo**

No topo de `src/features/estoque/EstoquePublicarMlModal.tsx`, na linha do import de tipos (linha 18), adicione `ProdutoCatalogoMl`:

```ts
import type { AtributoMl, AtributoValorInput, CategoriaMlNo, CategoriaMlSugerida, ConfiguracaoAnuncioMlInput, Estoque, EstoqueAnuncioMl, ProdutoCatalogoMl, TipoAnuncioMl, VariacaoMlInput } from './types';
```

- [ ] **Step 2: Adicionar estado e efeito de busca**

Logo depois da linha `const exigeCatalogo = useMemo(...)` (linha 302), adicione:

```ts
  // --- Vínculo com produto de catálogo (categorias catalog_required) --------
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoCatalogoMl[]>([]);
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false);
  const [produtoCatalogoSelecionado, setProdutoCatalogoSelecionado] = useState<ProdutoCatalogoMl | null>(null);
  const [naoEhCatalogo, setNaoEhCatalogo] = useState(false);

  useEffect(() => {
    setProdutoCatalogoSelecionado(null);
    setNaoEhCatalogo(false);
    setProdutosCatalogo([]);
    if (!categoriaSelecionada || !exigeCatalogo) return;
    let cancelado = false;
    setBuscandoCatalogo(true);
    mercadolivreApi
      .buscarProdutosCatalogo(buscaCategoria.trim())
      .then((res) => {
        if (!cancelado && res.success && res.data) setProdutosCatalogo(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setBuscandoCatalogo(false);
      });
    return () => {
      cancelado = true;
    };
  }, [categoriaSelecionada, exigeCatalogo]);
```

- [ ] **Step 3: Trocar o aviso de bloqueio pela busca inline**

Substitua o bloco (linhas 617-625):

```tsx
            {exigeCatalogo && (
              <div className="rounded-control border border-warning/30 bg-warning-bg/40 p-3 flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Esta categoria exige vincular a um produto do catálogo do Mercado Livre — este formulário ainda não suporta isso. Publique pelo site do
                  Mercado Livre e cole o link abaixo em "Anúncios no Mercado Livre".
                </p>
              </div>
            )}
```

por:

```tsx
            {exigeCatalogo && !naoEhCatalogo && (
              <div className="rounded-control border border-border-default bg-surface-inset p-3 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-text-muted">
                    Esta categoria pede um produto do catálogo do Mercado Livre. Escolha o que mais parece com a peça, ou avise que não é nenhum deles.
                  </p>
                </div>

                {buscandoCatalogo && (
                  <p className="text-xs text-text-faint flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Buscando produtos parecidos...
                  </p>
                )}

                {!buscandoCatalogo && produtosCatalogo.length > 0 && (
                  <div className="space-y-1.5">
                    {produtosCatalogo.map((p) => {
                      const ativo = produtoCatalogoSelecionado?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setProdutoCatalogoSelecionado(p)}
                          className={cn(
                            'w-full text-left flex items-center gap-2.5 rounded-control border px-3.5 py-2.5 transition-colors',
                            ativo ? 'border-accent bg-accent-soft-bg' : 'border-border-default hover:bg-surface-raised'
                          )}
                        >
                          {p.foto ? (
                            <img src={p.foto} alt="" className="size-9 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="size-9 rounded bg-surface-raised shrink-0" />
                          )}
                          <span className={cn('text-sm truncate', ativo ? 'text-accent-soft-fg font-medium' : 'text-text-primary')}>{p.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!buscandoCatalogo && produtosCatalogo.length === 0 && (
                  <p className="text-xs text-text-faint">Nenhum produto parecido encontrado no catálogo.</p>
                )}

                <button type="button" onClick={() => setNaoEhCatalogo(true)} className="text-xs font-medium text-accent-soft-fg hover:underline">
                  Não é o que eu vendo — publicar sem vincular ao catálogo
                </button>
              </div>
            )}

            {exigeCatalogo && naoEhCatalogo && (
              <div className="rounded-control border border-border-default bg-surface-inset p-3 flex items-center justify-between gap-2.5">
                <p className="text-xs text-text-muted">Publicando sem vínculo ao catálogo — igual a qualquer outro anúncio.</p>
                <button type="button" onClick={() => setNaoEhCatalogo(false)} className="text-xs font-medium text-accent-soft-fg hover:underline shrink-0">
                  Desfazer
                </button>
              </div>
            )}
```

- [ ] **Step 4: Atualizar `podePublicar`**

Substitua (linha 378-379):

```ts
  const podePublicar =
    !!categoriaSelecionada && !!listingTypeId && fotosSelecionadas.length > 0 && atributosObrigatoriosFaltando.length === 0 && !exigeCatalogo && precoBase > 0;
```

por:

```ts
  const catalogoResolvido = !exigeCatalogo || !!produtoCatalogoSelecionado || naoEhCatalogo;
  const podePublicar =
    !!categoriaSelecionada && !!listingTypeId && fotosSelecionadas.length > 0 && atributosObrigatoriosFaltando.length === 0 && catalogoResolvido && precoBase > 0;
```

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 6: Verificação manual no dev server**

Suba o servidor (`npm run dev` já roda `tsx server.ts` — lembrar que esta stack **não recarrega o backend sozinha**, reiniciar manualmente depois de qualquer mudança nas rotas). No navegador:
1. Abra uma peça, ligue "Publicar automaticamente no Mercado Livre".
2. Digite um título que caia numa categoria `catalog_required` (ex.: peça de carenagem/moto — a mesma usada nos testes, "Carenagem CB 300R").
3. Confirme que aparece a lista de produtos de catálogo (ou "Nenhum produto parecido encontrado") em vez do aviso de bloqueio antigo.
4. Clique num resultado — confirme que ele fica destacado e que o botão "Publicar anúncio" habilita (assumindo os outros campos preenchidos).
5. Clique em "Não é o que eu vendo" — confirme que o aviso de bloqueio some e o botão também habilita.

- [ ] **Step 7: Commit**

```bash
git add src/features/estoque/EstoquePublicarMlModal.tsx
git commit -m "feat: busca e seleção inline de produto de catálogo no modal de publicação"
```

---

### Task 6: Conflito com variações e payload de publicação

**Files:**
- Modify: `src/features/estoque/EstoquePublicarMlModal.tsx`

**Interfaces:**
- Consumes: `produtoCatalogoSelecionado` (Task 5); `unidadesElegiveis`, `variacaoDisponivel`, `usarVariacoes`, `atributoVariacaoEscolhido`, `unidadesComValor` (já existem no arquivo).
- Produces: payload de `publicar()` inclui `catalogo_produto_id`.

Sem teste automatizado, mesmo motivo do Task 5. Verificação manual no Step final.

- [ ] **Step 1: Bloquear a seção de Variações quando há produto de catálogo**

Localize o bloco `{unidadesElegiveis.length >= 2 && (<ModalSection titulo="Variações" ...` (linha 714-779). Troque a prop `descricao` e o conteúdo condicional:

```tsx
          {unidadesElegiveis.length >= 2 && (
            <ModalSection
              titulo="Variações"
              descricao={
                produtoCatalogoSelecionado
                  ? 'Produto de catálogo não aceita variações — o anúncio sai com o preço base único.'
                  : variacaoDisponivel
                  ? 'Cada ficha de unidade com preço próprio vira uma variação do anúncio.'
                  : 'Esta categoria não tem um atributo de variação no Mercado Livre — o anúncio sai com o preço base único.'
              }
            >
              {produtoCatalogoSelecionado ? (
                <p className="text-xs text-text-faint">
                  Clique em "Não é o que eu vendo" acima se precisar publicar esta peça com variações por ficha.
                </p>
              ) : variacaoDisponivel ? (
```

(o restante do JSX do ramo `variacaoDisponivel` e do `else` final permanece exatamente como já está hoje — só a linha de abertura `{variacaoDisponivel ? (` deixa de ser a primeira condição do ternário, vira a segunda, encaixada depois da nova checagem de `produtoCatalogoSelecionado`).

- [ ] **Step 2: Incluir o vínculo no payload de publicação**

Em `publicar()` (linha 390-398), adicione o campo ao objeto `payload`:

```ts
      const payload: ConfiguracaoAnuncioMlInput = {
        categoria_ml_id: categoriaSelecionada.id,
        condicao_ml: condicaoMl,
        listing_type_id: listingTypeId,
        atributos: Object.values(valoresAtributos),
        fotos: fotosSelecionadas,
        preco_efetivo_sistema: precoBase,
        variacoes: variacoes.length > 0 ? variacoes : undefined,
        catalogo_produto_id: produtoCatalogoSelecionado?.id,
      };
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Verificação manual no dev server**

Repita o cenário do Task 5 numa peça com 2+ fichas de unidade com valor próprio (elegível a variação):
1. Escolha uma categoria `catalog_required` e selecione um produto de catálogo — confirme que a seção "Variações" mostra o aviso substituto, não o seletor de fichas.
2. Clique em "Não é o que eu vendo" em vez disso — confirme que a seção "Variações" volta a mostrar o fluxo normal (toggle "Publicar como variações", campos por ficha).
3. Publique nos dois cenários (produto de catálogo vinculado / sem vínculo) usando `criarUsuarioTesteML` (conta de teste do Mercado Livre — já existe no cliente puro, `mercadolivreApi.ts:415`) antes de testar com a conta real, e confira no anúncio criado (permalink devolvido) que o primeiro tem "Este produto pertence ao catálogo" na página do ML e o segundo não.

- [ ] **Step 5: Atualizar patch notes**

Adicione uma entrada nova em `src/features/patchnotes/data.ts` descrevendo a mudança pro usuário final (peça publicada em categoria que antes bloqueava agora busca e vincula produto de catálogo automaticamente, ou publica sem vínculo com 1 clique).

- [ ] **Step 6: Commit**

```bash
git add src/features/estoque/EstoquePublicarMlModal.tsx src/features/patchnotes/data.ts
git commit -m "feat: catálogo desativa variações e vai junto no payload de publicação"
```

---

## Self-Review

**Cobertura da spec:**
- Busca automática ao entrar em categoria `catalog_required` → Task 5, Step 2.
- Lista de cards clicáveis com foto+nome → Task 5, Step 3.
- "Não é o que eu vendo" → Task 5, Step 3 e 4.
- Catálogo desativa variações (decisão do usuário) → Task 6, Step 1.
- `POST /items` ganha `catalog_product_id`/`catalog_listing`, nunca variations → Task 2.
- Gravação sem migration nova (jsonb `atributos_ml`) → Task 2, Step 5.
- Rota nova em `mercadolivre.ts` (não `estoque.ts`) → Task 3.
- Teste unitário de `montarPayloadPublicacao` → Task 2.
- Patch notes → Task 6, Step 5 (regra do projeto, não estava na spec original mas é constraint permanente do repo).

**Placeholders:** nenhum "TBD"/"implementar depois" — toda task tem código completo.

**Consistência de tipos:** `ProdutoCatalogoMl { id, nome, foto }` é o mesmo formato em `mercadolivrePublicacao.ts` (Task 1), `types.ts` (Task 4) e usado em `EstoquePublicarMlModal.tsx` (Task 5) — conferido nos três lugares. `catalogoProdutoId` (domínio/backend) vs `catalogo_produto_id` (JSON na borda HTTP) segue a mesma convenção camelCase/snake_case já usada em todo o resto do arquivo (`categoriaMlId`/`categoria_ml_id`, `listingTypeId`/`listing_type_id`).
