# Sincronização de vendas Mercado Livre ↔ estoque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir três atritos do formulário de publicação no Mercado Livre e fechar o ciclo de estoque nos dois sentidos — pedido pago no ML dá baixa sozinho, venda no balcão avisa que o anúncio precisa de ajuste.

**Architecture:** Bloco A é local ao formulário (uma coluna faltando num `select`, uma constante de texto, e a extração da máquina de remoção de fundo para um hook que sobe um nível). Bloco B transforma `mercadolivre_notificacoes` — hoje um log morto que webhook e polling já alimentam — numa fila com um consumidor no scheduler existente, e adiciona um gatilho pós-venda que dispara push apontando pro fluxo de revisão de sincronização que já existe.

**Tech Stack:** TypeScript, Express, Supabase (postgres via `supabase-js`), React 19, Tailwind v4, Vitest + @testing-library/react (jsdom), Web Push + FCM.

**Spec:** [docs/superpowers/specs/2026-08-14-mercadolivre-sincronizacao-vendas-design.md](../specs/2026-08-14-mercadolivre-sincronizacao-vendas-design.md)

## Global Constraints

- **Nunca escrever hex direto nos componentes.** Só classes do design system (`bg-surface-card`, `text-text-primary`, `rounded-card`, `text-positive`). Tokens em `src/styles/theme.css`.
- **No máximo UM botão de acento preenchido (`accent`) por tela.** No modal de publicação esse botão já é "Publicar anúncio" — todo botão novo é `outline` ou `ghost`.
- **Todo alerta precisa ter uma ação associada.** Notificação sem nada a fazer não é alerta e não deve ser criada.
- **Mutação de anúncio no Mercado Livre nunca é automática.** Nada neste plano pode chamar `atualizarItemML` fora do fluxo de revisão com checkbox que já existe (`aplicarSincronizacao`, disparado por clique humano).
- **Migração ausente nunca derruba o sistema.** Todo acesso a coluna/tabela nova checa `error.code` `42703` / `42P01` / `PGRST204` / `PGRST205` e degrada em silêncio, como o resto do módulo (`ehErroDeMigrationAusente` em `src/services/mercadolivreSync.ts:24`).
- **Testes rodam com `npm test`** (Vitest). Arquivos `*.test.ts` / `*.test.tsx` ao lado do arquivo testado. Testes de componente precisam da diretiva `// @vitest-environment jsdom` na primeira linha.
- **O servidor dev não recarrega o backend sozinho** (`tsx server.ts`, sem `--watch`). Qualquer mudança em `server.ts`, `src/server/**` ou `src/services/**` exige restart manual pra ser exercitada à mão.
- **Toda entrega termina com uma entrada nova no topo de `PATCH_NOTES`** em `src/features/patchnotes/data.ts` (Task 9).

---

### Task 1: Predefinição de categoria volta do backend

O toggle "Padronizar categoria" grava certo (`PUT /api/categorias/:id`), mas o valor nunca volta: o join do estoque lista colunas explícitas e não inclui a coluna nova da migração 043. Com isso `item.categoria.mercadolivre_categoria_id_padrao` chega `undefined` e o `useEffect` de pré-seleção ([EstoquePublicarMlModal.tsx:493](../../../src/features/estoque/EstoquePublicarMlModal.tsx)) nunca dispara — pra Lanterna e pra qualquer outra categoria.

**Files:**
- Modify: `src/server/routes/estoque.ts:24` (constante `SELECT_COM_JOINS`)
- Test: `src/server/routes/estoque.test.ts` (criar)

**Interfaces:**
- Consumes: nada.
- Produces: `export const SELECT_COM_JOINS: string` em `src/server/routes/estoque.ts` (hoje é `const` privado; passa a ser exportado pro teste).

- [ ] **Step 1: Write the failing test**

Criar `src/server/routes/estoque.test.ts`:

```ts
// O join do estoque lista colunas explícitas da categoria. Toda coluna nova
// de `categorias` que o frontend precisa tem que ser adicionada aqui à mão —
// esquecer disso foi exatamente o bug da predefinição de categoria do
// Mercado Livre (o toggle salvava, mas o valor nunca voltava pro formulário).
import { describe, it, expect } from 'vitest';
import { SELECT_COM_JOINS } from './estoque.js';

describe('SELECT_COM_JOINS', () => {
  it('traz a categoria padrão do Mercado Livre junto da categoria da peça', () => {
    expect(SELECT_COM_JOINS).toContain('mercadolivre_categoria_id_padrao');
  });

  it('continua trazendo id e nome da categoria', () => {
    expect(SELECT_COM_JOINS).toMatch(/categoria:categorias\([^)]*id[^)]*nome[^)]*\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/routes/estoque.test.ts`
Expected: FAIL — o import de `SELECT_COM_JOINS` não resolve (constante ainda não é exportada).

- [ ] **Step 3: Write minimal implementation**

Em `src/server/routes/estoque.ts:24`, exportar a constante e adicionar a coluna:

```ts
// Colunas da categoria são explícitas (não `*`) pra não trafegar campo
// desnecessário — mas isso significa que coluna nova de `categorias` usada
// pelo frontend precisa entrar aqui à mão. Ver estoque.test.ts.
export const SELECT_COM_JOINS =
  '*, categoria:categorias(id, nome, mercadolivre_categoria_id_padrao), modelo_moto:modelos_moto!estoque_modelo_moto_id_fkey(id, nome, ano)';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/routes/estoque.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar a suíte de componente que já cobre a pré-seleção**

Run: `npx vitest run src/features/estoque/EstoquePublicarMlModal.render.test.tsx`
Expected: PASS — o teste "padronizar categoria (Fase 4)" já existente continua verde (ele injeta a coluna direto no fake, então cobre o lado do componente; o teste da Task 1 cobre o lado do backend que faltava).

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/estoque.ts src/server/routes/estoque.test.ts
git commit -m "fix: predefinição de categoria do ML não voltava do backend"
```

---

### Task 2: Descrição padrão do anúncio com botão de limpar

O campo de descrição abre hoje com `item.descricao || item.nome` — texto interno de catalogação, não texto de venda. Passa a abrir sempre com o texto institucional da RK Sucatas, com um botão que limpa (e, quando o campo está diferente do padrão, restaura).

**Files:**
- Create: `src/features/estoque/descricaoPadraoMl.ts`
- Modify: `src/features/estoque/EstoquePublicarMlModal.tsx` (estado inicial ~linha 421, reset por peça ~linha 468, JSX da seção "Título e descrição do anúncio" ~linha 1036)
- Test: `src/features/estoque/EstoquePublicarMlModal.render.test.tsx` (adicionar describe)

**Interfaces:**
- Consumes: nada.
- Produces: `export const DESCRICAO_PADRAO_ANUNCIO: string` em `src/features/estoque/descricaoPadraoMl.ts`.

- [ ] **Step 1: Criar o arquivo da constante**

Criar `src/features/estoque/descricaoPadraoMl.ts` com o texto exato aprovado pelo usuário:

```ts
// Texto institucional que abre TODO anúncio novo no Mercado Livre. Fica em
// constante (não em banco) de propósito: muda raramente e sempre com
// revisão — virar campo editável exigiria migration + rota + tela pra um
// texto que a loja inteira compartilha. O formulário permite limpar e
// escrever outro texto pra um anúncio específico, sem alterar este padrão.
export const DESCRICAO_PADRAO_ANUNCIO = `Na RK SUCATAS, você compra com a certeza de ter a melhor peça, com preço justo e procedência legal garantida!


- Peça revisada e Funcional: Peça testada e pronta para uso na sua moto.
- Fotos Reais e Procedência Total: As imagens são do produto.
- A Melhor do Estoque: Garantimos o envio da peça com a melhor condição estética e funcional disponível em nosso estoque.
- Compra 100% Segura: Transação protegida pelo Mercado Livre e Mercado Envios.

AVISO IMPORTANTE (LEIA ANTES DE COMPRAR)
Transparência é a nossa regra!

Compatibilidade: Por favor, confirme se esta peça é compatível com o ano e modelo exato da sua Yamaha antes de finalizar a compra.

Condição Estética: Por ser uma peça usada original, o foco principal é na funcionalidade e segurança. Pequenos detalhes ou variações estéticas são normais e podem diferir das fotos.

Dúvidas? Use o campo de perguntas. Nossa equipe RK SUCATAS está pronta para te ajudar.

LOGÍSTICA E CONFIANÇA
Envio Rápido: Despachamos sua compra até o próximo dia útil após a confirmação do pagamento.

Procurando Outra Peça? Fale conosco pelo campo de perguntas. Temos um vasto estoque de peças revisadas para diversas marcas e modelos!`;
```

- [ ] **Step 2: Write the failing test**

Adicionar ao fim de `src/features/estoque/EstoquePublicarMlModal.render.test.tsx`:

```tsx
describe('EstoquePublicarMlModal — descrição padrão', () => {
  it('abre com o texto institucional da RK, ignorando a descrição interna da peça', () => {
    const item = criarItem({ id: 'p1', nome: 'Lanterna', imagens: [], descricao: 'nota interna de catalogação' });

    render(<EstoquePublicarMlModal aberto item={item} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);

    const campo = screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement;
    expect(campo.value).toBe(DESCRICAO_PADRAO_ANUNCIO);
    expect(campo.value).not.toContain('nota interna de catalogação');
  });

  it('o botão Limpar esvazia o campo e vira Restaurar padrão', () => {
    const item = criarItem({ id: 'p1', nome: 'Lanterna', imagens: [] });

    render(<EstoquePublicarMlModal aberto item={item} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);

    const campo = screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement;
    fireEvent.click(screen.getByText('Limpar'));
    expect(campo.value).toBe('');

    fireEvent.click(screen.getByText('Restaurar padrão'));
    expect(campo.value).toBe(DESCRICAO_PADRAO_ANUNCIO);
  });

  it('trocar de peça reseta a descrição de volta pro padrão', () => {
    const itemA = criarItem({ id: 'p1', nome: 'Lanterna', imagens: [] });
    const itemB = criarItem({ id: 'p2', nome: 'Farol', imagens: [] });

    const { rerender } = render(<EstoquePublicarMlModal aberto item={itemA} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);
    const campo = screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: 'texto só desta peça' } });

    rerender(<EstoquePublicarMlModal aberto item={itemB} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);
    expect((screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement).value).toBe(DESCRICAO_PADRAO_ANUNCIO);
  });
});
```

Adicionar o import no topo do arquivo de teste, junto dos outros:

```tsx
import { DESCRICAO_PADRAO_ANUNCIO } from './descricaoPadraoMl';
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/estoque/EstoquePublicarMlModal.render.test.tsx -t "descrição padrão"`
Expected: FAIL — o campo vem com `'nota interna de catalogação'`, e não existe botão "Limpar".

- [ ] **Step 4: Trocar o estado inicial e o reset por peça**

Em `src/features/estoque/EstoquePublicarMlModal.tsx`, adicionar o import:

```tsx
import { DESCRICAO_PADRAO_ANUNCIO } from './descricaoPadraoMl';
```

Trocar o `useState` da descrição (~linha 421):

```tsx
  const [tituloAnuncio, setTituloAnuncio] = useState(item.nome.slice(0, 60));
  // Descrição do anúncio nasce SEMPRE do texto institucional, nunca de
  // item.descricao — a descrição interna é nota de catalogação, escrita pra
  // quem trabalha no estoque, não pra converter comprador.
  const [descricaoAnuncio, setDescricaoAnuncio] = useState(DESCRICAO_PADRAO_ANUNCIO);
```

E, dentro do `useEffect` de reset por peça (~linha 468), trocar a linha correspondente:

```tsx
    setDescricaoAnuncio(DESCRICAO_PADRAO_ANUNCIO);
```

- [ ] **Step 5: Adicionar o botão no JSX**

Na seção "Título e descrição do anúncio", trocar o bloco do `<label>Descrição do anúncio *</label>` por um cabeçalho com o botão (mesmo padrão do contador do título logo acima). O botão é `ghost` — o único `accent` da tela continua sendo "Publicar anúncio":

```tsx
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={cn(labelClass, 'mb-0')}>Descrição do anúncio *</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDescricaoAnuncio((atual) => (atual === DESCRICAO_PADRAO_ANUNCIO ? '' : DESCRICAO_PADRAO_ANUNCIO))}
                >
                  {descricaoAnuncio === DESCRICAO_PADRAO_ANUNCIO ? 'Limpar' : 'Restaurar padrão'}
                </Button>
              </div>
              <textarea
                value={descricaoAnuncio}
                onChange={(e) => setDescricaoAnuncio(e.target.value)}
                rows={5}
                placeholder="Descrição do anúncio"
                className={cn(inputClass, 'resize-y')}
              />
            </div>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/features/estoque/EstoquePublicarMlModal.render.test.tsx`
Expected: PASS — os 3 testes novos e todos os que já existiam no arquivo.

- [ ] **Step 7: Commit**

```bash
git add src/features/estoque/descricaoPadraoMl.ts src/features/estoque/EstoquePublicarMlModal.tsx src/features/estoque/EstoquePublicarMlModal.render.test.tsx
git commit -m "feat: descrição padrão da RK pré-preenchida no anúncio do ML"
```

---

### Task 3: Remoção de fundo começa ao ligar o toggle

Hoje a máquina de remoção de fundo vive dentro do modal, então só começa a rodar quando o usuário abre "Configurar e publicar" e clica foto por foto. Extraí-la pra um hook permite instanciá-la um nível acima (na tela de editar peça), onde o toggle vive — as prévias ficam prontas antes do modal abrir. A aprovação continua sendo clique do usuário: remoção de fundo erra em peça escura, e foto ruim não pode ir pro ar sozinha.

**Files:**
- Create: `src/features/estoque/useRemocaoFundoFotos.ts`
- Create: `src/features/estoque/useRemocaoFundoFotos.test.ts`
- Modify: `src/features/estoque/EstoquePublicarMlModal.tsx` (remover o estado de fundo, consumir o hook via prop)
- Modify: `src/features/estoque/EstoqueView.tsx` (instanciar o hook, disparar no toggle ~linha 1501, limpar ao fechar ~linhas 209 e 222, passar a prop ~linha 1641)

**Interfaces:**
- Consumes: `removerFundoImagem(fonte: File | string): Promise<{ sucesso: boolean; blob?: Blob }>` de `src/utils/removerFundoImagem`; `uploadImagemEstoque(arquivo: File): Promise<{ success: boolean; url?: string }>` de `src/features/estoque/api`; `comprimirImagem(arquivo: File): Promise<{ arquivo: File }>` de `src/utils/comprimirImagem`.
- Produces:

```ts
export interface PreviewFundo {
  originalUrl: string;
  antesSrc: string;
  depoisBlob: Blob;
  depoisPreviewUrl: string;
}

export interface RemocaoFundoFotos {
  processandoUrls: Set<string>;
  previews: PreviewFundo[];
  fotosProcessadas: Record<string, string>; // urlOriginal -> urlNova (já aprovada e no storage)
  aprovandoUrl: string | null;
  podeIniciarMais: boolean;
  iniciar: (originalUrl: string, fonte: File | string) => Promise<void>;
  iniciarTodas: (urls: string[]) => void;
  tentarNovaFoto: (originalUrl: string, arquivo: File) => Promise<void>;
  aprovar: (originalUrl: string) => Promise<string | null>; // devolve a url nova, ou null se falhou
  descartar: (originalUrl: string) => void;
  limparTudo: () => void;
}

export function useRemocaoFundoFotos(): RemocaoFundoFotos;
```

- [ ] **Step 1: Write the failing test**

Criar `src/features/estoque/useRemocaoFundoFotos.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

vi.mock('../../utils/removerFundoImagem', () => ({
  removerFundoImagem: vi.fn(() => Promise.resolve({ sucesso: true, blob: new Blob(['x'], { type: 'image/jpeg' }) })),
}));
vi.mock('./api', () => ({
  uploadImagemEstoque: vi.fn(() => Promise.resolve({ success: true, url: 'https://cdn/sem-fundo.jpg' })),
  estoqueApi: {},
}));
vi.mock('../../utils/comprimirImagem', () => ({
  comprimirImagem: vi.fn((arquivo: File) => Promise.resolve({ arquivo })),
}));
vi.mock('../../components/ui/toast', () => ({
  aviso: { falha: vi.fn(), sucesso: vi.fn(), atencao: vi.fn() },
}));

import { removerFundoImagem } from '../../utils/removerFundoImagem';
import { uploadImagemEstoque } from './api';
import { useRemocaoFundoFotos } from './useRemocaoFundoFotos';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe('useRemocaoFundoFotos', () => {
  it('iniciarTodas dispara uma remoção por foto e produz uma prévia pra cada', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg', 'https://cdn/b.jpg']));

    await waitFor(() => expect(result.current.previews).toHaveLength(2));
    expect(removerFundoImagem).toHaveBeenCalledTimes(2);
    expect(result.current.previews.map((p) => p.originalUrl).sort()).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });

  it('iniciarTodas ignora foto que já tem prévia pronta, pra não reprocessar à toa', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(1));

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg', 'https://cdn/b.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(2));
    expect(removerFundoImagem).toHaveBeenCalledTimes(2);
  });

  it('aprovar sobe a foto e registra a troca em fotosProcessadas', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(1));

    let urlNova: string | null = null;
    await act(async () => {
      urlNova = await result.current.aprovar('https://cdn/a.jpg');
    });

    expect(uploadImagemEstoque).toHaveBeenCalledTimes(1);
    expect(urlNova).toBe('https://cdn/sem-fundo.jpg');
    expect(result.current.fotosProcessadas).toEqual({ 'https://cdn/a.jpg': 'https://cdn/sem-fundo.jpg' });
    expect(result.current.previews).toHaveLength(0);
  });

  it('falha na remoção não cria prévia e libera o slot de processamento', async () => {
    vi.mocked(removerFundoImagem).mockResolvedValueOnce({ sucesso: false } as any);
    const { result } = renderHook(() => useRemocaoFundoFotos());

    await act(async () => {
      await result.current.iniciar('https://cdn/a.jpg', 'https://cdn/a.jpg');
    });

    expect(result.current.previews).toHaveLength(0);
    expect(result.current.processandoUrls.size).toBe(0);
  });

  it('limparTudo descarta prévias e revoga os blobs', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(1));

    act(() => result.current.limparTudo());

    expect(result.current.previews).toHaveLength(0);
    expect(result.current.fotosProcessadas).toEqual({});
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/estoque/useRemocaoFundoFotos.test.ts`
Expected: FAIL — módulo `./useRemocaoFundoFotos` não existe.

- [ ] **Step 3: Escrever o hook**

Criar `src/features/estoque/useRemocaoFundoFotos.ts` movendo a lógica que hoje vive no modal (linhas ~424-445 de estado e ~510-600 de funções), sem mudar comportamento:

```ts
// Máquina de remoção de fundo das fotos, extraída de
// EstoquePublicarMlModal.tsx pra poder ser instanciada UM NÍVEL ACIMA (na
// tela de editar peça): assim o processamento começa quando o toggle
// "Publicar automaticamente no Mercado Livre" é ligado, e as prévias já
// estão prontas quando o formulário abre. Aprovar continua sendo clique
// explícito do usuário — a remoção erra em peça escura/fundo próximo, e
// foto ruim não pode entrar no anúncio sozinha.
//
// 100% client-side (@imgly/background-removal, WASM — ver
// src/utils/removerFundoImagem.ts pro porquê de não haver rota no backend).
import { useCallback, useRef, useState } from 'react';
import { aviso } from '../../components/ui/toast';
import { comprimirImagem } from '../../utils/comprimirImagem';
import { removerFundoImagem } from '../../utils/removerFundoImagem';
import { uploadImagemEstoque } from './api';

export interface PreviewFundo {
  originalUrl: string;
  antesSrc: string;
  depoisBlob: Blob;
  depoisPreviewUrl: string;
}

// Mesmo teto do pool de workers em removerFundoImagem.ts — não faz sentido
// deixar clicar numa 3ª foto se o pool só processa 2 ao mesmo tempo mesmo.
// iniciarTodas não respeita esse teto de propósito: o pool já enfileira o
// excedente sozinho, e a fila é justamente o ganho de disparar cedo.
const MAX_REMOCOES_SIMULTANEAS = 2;

export interface RemocaoFundoFotos {
  processandoUrls: Set<string>;
  previews: PreviewFundo[];
  fotosProcessadas: Record<string, string>;
  aprovandoUrl: string | null;
  podeIniciarMais: boolean;
  iniciar: (originalUrl: string, fonte: File | string) => Promise<void>;
  iniciarTodas: (urls: string[]) => void;
  tentarNovaFoto: (originalUrl: string, arquivo: File) => Promise<void>;
  aprovar: (originalUrl: string) => Promise<string | null>;
  descartar: (originalUrl: string) => void;
  limparTudo: () => void;
}

function revogarSeBlob(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function useRemocaoFundoFotos(): RemocaoFundoFotos {
  const [processandoUrls, setProcessandoUrls] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<PreviewFundo[]>([]);
  const [fotosProcessadas, setFotosProcessadas] = useState<Record<string, string>>({});
  const [aprovandoUrl, setAprovandoUrl] = useState<string | null>(null);
  // Espelho síncrono do que já foi disparado — iniciarTodas roda em loop e
  // não pode depender do estado de prévias, que só atualiza no próximo
  // render (dispararia a mesma foto N vezes).
  const jaDisparadas = useRef<Set<string>>(new Set());

  const descartar = useCallback((originalUrl: string) => {
    setPreviews((atual) => {
      const preview = atual.find((p) => p.originalUrl === originalUrl);
      if (preview) {
        revogarSeBlob(preview.antesSrc);
        revogarSeBlob(preview.depoisPreviewUrl);
      }
      return atual.filter((p) => p.originalUrl !== originalUrl);
    });
  }, []);

  const iniciar = useCallback(
    async (originalUrl: string, fonte: File | string) => {
      jaDisparadas.current.add(originalUrl);
      descartar(originalUrl); // nova tentativa substitui a prévia anterior desta mesma foto
      setProcessandoUrls((atual) => new Set(atual).add(originalUrl));
      try {
        const resultado = await removerFundoImagem(fonte);
        if (!resultado.sucesso || !resultado.blob) {
          aviso.falha(null, 'Não foi possível remover o fundo desta foto');
          return;
        }
        const novaPreview: PreviewFundo = {
          originalUrl,
          antesSrc: typeof fonte === 'string' ? fonte : URL.createObjectURL(fonte),
          depoisBlob: resultado.blob,
          depoisPreviewUrl: URL.createObjectURL(resultado.blob),
        };
        setPreviews((atual) => [...atual.filter((p) => p.originalUrl !== originalUrl), novaPreview]);
      } finally {
        setProcessandoUrls((atual) => {
          const proximo = new Set(atual);
          proximo.delete(originalUrl);
          return proximo;
        });
      }
    },
    [descartar]
  );

  const iniciarTodas = useCallback(
    (urls: string[]) => {
      for (const url of urls) {
        if (jaDisparadas.current.has(url)) continue;
        void iniciar(url, url);
      }
    },
    [iniciar]
  );

  // "Tirar outra foto" reaproveita a mesma peça que estava sendo retocada —
  // o usuário está tentando de novo, não anexando uma foto nova solta.
  // Comprime antes (mesmo pipeline do upload normal em EstoqueView.tsx).
  const tentarNovaFoto = useCallback(
    async (originalUrl: string, arquivo: File) => {
      const { arquivo: comprimido } = await comprimirImagem(arquivo);
      jaDisparadas.current.delete(originalUrl);
      await iniciar(originalUrl, comprimido);
    },
    [iniciar]
  );

  const aprovar = useCallback(
    async (originalUrl: string): Promise<string | null> => {
      const preview = previews.find((p) => p.originalUrl === originalUrl);
      if (!preview) return null;
      setAprovandoUrl(originalUrl);
      try {
        const arquivo = new File([preview.depoisBlob], 'fundo-removido.jpg', { type: 'image/jpeg' });
        const resultado = await uploadImagemEstoque(arquivo);
        if (!resultado.success || !resultado.url) {
          aviso.falha(null, 'Não foi possível salvar a foto sem fundo');
          return null;
        }
        setFotosProcessadas((prev) => ({ ...prev, [originalUrl]: resultado.url! }));
        descartar(originalUrl);
        aviso.sucesso('Foto sem fundo aplicada ao anúncio');
        return resultado.url;
      } catch (err) {
        aviso.falha(err, 'Não foi possível salvar a foto sem fundo');
        return null;
      } finally {
        setAprovandoUrl(null);
      }
    },
    [previews, descartar]
  );

  const limparTudo = useCallback(() => {
    setPreviews((atual) => {
      for (const preview of atual) {
        revogarSeBlob(preview.antesSrc);
        revogarSeBlob(preview.depoisPreviewUrl);
      }
      return [];
    });
    setFotosProcessadas({});
    setProcessandoUrls(new Set());
    setAprovandoUrl(null);
    jaDisparadas.current = new Set();
  }, []);

  return {
    processandoUrls,
    previews,
    fotosProcessadas,
    aprovandoUrl,
    podeIniciarMais: processandoUrls.size < MAX_REMOCOES_SIMULTANEAS,
    iniciar,
    iniciarTodas,
    tentarNovaFoto,
    aprovar,
    descartar,
    limparTudo,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/estoque/useRemocaoFundoFotos.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit do hook isolado**

```bash
git add src/features/estoque/useRemocaoFundoFotos.ts src/features/estoque/useRemocaoFundoFotos.test.ts
git commit -m "refactor: extrai remoção de fundo do modal pra hook próprio"
```

- [ ] **Step 6: Consumir o hook no modal**

Em `src/features/estoque/EstoquePublicarMlModal.tsx`:

1. Adicionar `remocaoFundo: RemocaoFundoFotos` à interface de props e ao destructuring do componente:

```tsx
interface EstoquePublicarMlModalProps {
  aberto: boolean;
  onFechar: () => void;
  item: Estoque;
  modelos: ModeloMoto[];
  onPublicado: (links: EstoqueAnuncioMl[]) => void;
  // Instanciado em EstoqueView pra que a remoção comece ao ligar o toggle,
  // antes deste modal existir — ver useRemocaoFundoFotos.ts.
  remocaoFundo: RemocaoFundoFotos;
}
```

```tsx
export function EstoquePublicarMlModal({ aberto, onFechar, item, modelos, onPublicado, remocaoFundo }: EstoquePublicarMlModalProps) {
```

2. Trocar os imports: remover `removerFundoImagem` e `comprimirImagem`, adicionar `import type { RemocaoFundoFotos } from './useRemocaoFundoFotos';`.

3. Apagar os estados `processandoFundoUrls`, `previewsFundo`, `fotosProcessadas`, `aprovandoFundoUrl`, a constante `MAX_REMOCOES_SIMULTANEAS`, e as funções `revogarSeBlob`, `descartarPreviewFundo`, `iniciarRemocaoFundo`, `tentarNovaFoto`, `aprovarPreviewFundo` — tudo isso agora vem do hook. Manter `retryAlvoUrl`, os dois `inputRef` e `substituindoFotosEstoque` (são do modal).

4. No reset por peça (`useEffect` de `[item.id]`), trocar as quatro linhas de estado de fundo por `remocaoFundo.limparTudo();` e adicionar `remocaoFundo` às dependências.

5. No JSX, trocar as referências: `fotosProcessadas` → `remocaoFundo.fotosProcessadas`, `processandoFundoUrls` → `remocaoFundo.processandoUrls`, `previewsFundo` → `remocaoFundo.previews`, `aprovandoFundoUrl` → `remocaoFundo.aprovandoUrl`, `descartarPreviewFundo(...)` → `remocaoFundo.descartar(...)`, `iniciarRemocaoFundo(url, url)` → `remocaoFundo.iniciar(url, url)`. O `disabled` do botão de remover fundo passa a ser `processandoEsta || !remocaoFundo.podeIniciarMais`.

6. O botão "Usar esta versão no anúncio" precisa aplicar a troca na seleção do anúncio, que continua sendo estado do modal:

```tsx
                  <Button type="button" variant="outline" size="sm" onClick={async () => {
                    const novaUrl = await remocaoFundo.aprovar(preview.originalUrl);
                    if (novaUrl) setFotosSelecionadas((prev) => prev.map((u) => (u === preview.originalUrl ? novaUrl : u)));
                  }} disabled={remocaoFundo.aprovandoUrl === preview.originalUrl}>
```

7. Os dois `<input type="file">` de retry passam a chamar:

```tsx
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo && retryAlvoUrl) void remocaoFundo.tentarNovaFoto(retryAlvoUrl, arquivo);
                e.target.value = '';
              }}
```

- [ ] **Step 7: Ligar o toggle em EstoqueView**

Em `src/features/estoque/EstoqueView.tsx`:

1. Importar o hook e instanciá-lo junto dos outros estados (perto de `publicarMlAtivo`, ~linha 183):

```tsx
  const remocaoFundo = useRemocaoFundoFotos();
```

2. No `Switch` do toggle (~linha 1501), disparar o processamento:

```tsx
                      <Switch
                        checked={publicarMlAtivo}
                        onCheckedChange={(ativo) => {
                          setPublicarMlAtivo(ativo);
                          // Adianta o trabalho pesado: quando o formulário de
                          // publicação abrir, as prévias já estão prontas.
                          if (ativo) remocaoFundo.iniciarTodas(formData.imagens);
                          else remocaoFundo.limparTudo();
                        }}
                      />
```

3. Nos dois pontos que já fazem `setPublicarMlAtivo(false)` ao abrir/fechar o editor (~linhas 209 e 222), adicionar `remocaoFundo.limparTudo();` na linha seguinte.

4. Passar a prop pro modal (~linha 1641): `remocaoFundo={remocaoFundo}`.

- [ ] **Step 8: Rodar a suíte inteira e o type-check**

Run: `npx tsc --noEmit`
Expected: sem erros (a prop nova é obrigatória — se faltou passar em algum lugar, aparece aqui).

Run: `npm test`
Expected: PASS. O arquivo `EstoquePublicarMlModal.render.test.tsx` precisa passar `remocaoFundo` nas 5 chamadas de `render`/`rerender` que já existem — adicione um helper no topo do arquivo de teste e use em todas:

```tsx
const remocaoFundoFake = {
  processandoUrls: new Set<string>(),
  previews: [],
  fotosProcessadas: {},
  aprovandoUrl: null,
  podeIniciarMais: true,
  iniciar: vi.fn(),
  iniciarTodas: vi.fn(),
  tentarNovaFoto: vi.fn(),
  aprovar: vi.fn(),
  descartar: vi.fn(),
  limparTudo: vi.fn(),
};
```

- [ ] **Step 9: Commit**

```bash
git add src/features/estoque/EstoquePublicarMlModal.tsx src/features/estoque/EstoqueView.tsx src/features/estoque/EstoquePublicarMlModal.render.test.tsx
git commit -m "feat: remoção de fundo começa ao ligar o toggle do Mercado Livre"
```

---

### Task 4: Migração 044 e busca de pedido avulso

Base do Bloco B: a fila e a função de API que falta. `mercadolivreApi.ts` só sabe buscar pedidos por lista (`buscarPedidosRecentes`); o webhook entrega `/orders/{id}` e precisa de busca por id.

**Files:**
- Create: `supabase/migration_044_mercadolivre_fila_pedidos.sql`
- Modify: `src/services/mercadolivreApi.ts` (adicionar `buscarPedido` depois de `buscarPedidosRecentes`, ~linha 202)
- Test: `src/services/mercadolivreApi.test.ts` (criar)

**Interfaces:**
- Consumes: `PedidoML` (interface já existente em `src/services/mercadolivreApi.ts`).
- Produces: `export async function buscarPedido(token: string, orderId: string): Promise<PedidoML | null>`.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migration_044_mercadolivre_fila_pedidos.sql`:

```sql
-- =============================================================================
-- RK Sucatas — Migração 044: fila de pedidos do Mercado Livre
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 043 aplicadas, em ordem — esta depende da 022
-- (vendas.ml_order_id), da 023 (mercadolivre_notificacoes), da 030
-- (formas_pagamento.natureza) e da 038 (vendas.unidade_id)).
--
-- `mercadolivre_notificacoes` nasceu (migração 023) como log auxiliar de
-- "houve atividade recente": webhook e polling escrevem, e ninguém lê além
-- de um indicador visual. Estas colunas a promovem a FILA — um consumidor no
-- scheduler processa cada linha de pedido uma única vez, transformando
-- pedido pago em venda com baixa de estoque.
--
-- `processado_em` nulo = pendente. Linhas antigas nascem pendentes de
-- propósito: são pedidos das últimas semanas que talvez nunca tenham sido
-- importados. Quem já virou venda é pulado pelo índice único de
-- (ml_order_id, ml_item_id) em `vendas` (migração 022), então reprocessar é
-- seguro por construção.
--
-- `tentativas` existe pra um pedido quebrado (item apagado no ML, resposta
-- fora do formato esperado) não travar a fila pra sempre: depois do teto que
-- a aplicação define, a linha é marcada processada com o `erro` preservado.
--
-- A forma de pagamento dedicada é requisito do `registrar_venda` (ele exige
-- forma de pagamento) e mantém o caixa separando canal ML de balcão. Natureza
-- 'avista' porque o Mercado Livre repassa o dinheiro — não é fiado.
-- =============================================================================

alter table mercadolivre_notificacoes add column processado_em timestamptz;
alter table mercadolivre_notificacoes add column erro text;
alter table mercadolivre_notificacoes add column tentativas integer not null default 0;

-- Índice parcial: a fila só consulta o que está pendente, e ela encolhe
-- conforme o consumidor trabalha — indexar a tabela inteira seria desperdício.
create index idx_mercadolivre_notificacoes_pendentes
  on mercadolivre_notificacoes(recebido_em) where processado_em is null;

insert into formas_pagamento (nome, natureza) values ('MERCADO LIVRE', 'avista')
  on conflict (nome) do nothing;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Write the failing test**

Criar `src/services/mercadolivreApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

import axios from 'axios';
import { buscarPedido } from './mercadolivreApi.js';

beforeEach(() => vi.clearAllMocks());

describe('buscarPedido', () => {
  it('busca o pedido por id e devolve o corpo da resposta', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { id: 123, status: 'paid', order_items: [] } });

    const pedido = await buscarPedido('token-fake', '123');

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/orders/123'), {
      headers: { Authorization: 'Bearer token-fake' },
    });
    expect(pedido).toEqual({ id: 123, status: 'paid', order_items: [] });
  });

  it('devolve null quando o pedido não existe mais (404), em vez de lançar', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 404 } });

    await expect(buscarPedido('token-fake', '999')).resolves.toBeNull();
  });

  it('propaga erro que não é 404 — token expirado precisa estourar', async () => {
    vi.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });

    await expect(buscarPedido('token-fake', '123')).rejects.toMatchObject({ response: { status: 401 } });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/services/mercadolivreApi.test.ts`
Expected: FAIL — `buscarPedido` não é exportado.

- [ ] **Step 4: Implementar `buscarPedido`**

Em `src/services/mercadolivreApi.ts`, logo abaixo de `buscarPedidosRecentes`:

```ts
// Busca um pedido específico — o webhook entrega o recurso `/orders/{id}` e
// não o pedido inteiro. 404 vira null (pedido apagado/inacessível não é erro
// de sistema, é linha de fila pra descartar); qualquer outro status propaga,
// porque 401/403 significa token vencido e aí a fila TEM que parar em vez de
// marcar tudo como processado em silêncio.
export async function buscarPedido(token: string, orderId: string): Promise<PedidoML | null> {
  try {
    const { data } = await axios.get(`${ML_API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data ?? null;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/mercadolivreApi.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add supabase/migration_044_mercadolivre_fila_pedidos.sql src/services/mercadolivreApi.ts src/services/mercadolivreApi.test.ts
git commit -m "feat: migration 044 (fila de pedidos ML) e busca de pedido por id"
```

---

### Task 5: Consumidor da fila importa pedido pago como venda

O coração do item 4. Lê as linhas pendentes de `topic = 'orders_v2'`, busca cada pedido, e transforma em venda reusando `importarPedidoComoVenda` (que já é idempotente e já marca canal/ids do ML).

**Files:**
- Modify: `src/services/mercadolivreSync.ts` (adicionar a seção do consumidor ao fim do arquivo)
- Modify: `src/services/mercadolivreScheduler.ts` (chamar o consumidor a cada ciclo)
- Test: `src/services/mercadolivreFilaPedidos.test.ts` (criar)

**Interfaces:**
- Consumes: `buscarPedido(token, orderId)` (Task 4); `construirMapaEstoquePorMlb(supabase)` e `importarPedidoComoVenda(supabase, params)` (já existem em `mercadolivreSync.ts`); `obterConexaoAtual(supabase)` de `mercadolivreApi.ts`.
- Produces:

```ts
export interface ResultadoFilaPedidos {
  importados: number;
  itensImportados: { estoqueNome: string; mlOrderId: string }[];
  semMatch: { mlOrderId: string; titulo: string }[];
  ignorados: number;
  falhas: number;
}

export async function processarPedidosPendentes(supabase: SupabaseClient): Promise<ResultadoFilaPedidos>;
```

- [ ] **Step 1: Write the failing test**

Criar `src/services/mercadolivreFilaPedidos.test.ts`. O fake de Supabase segue o estilo já usado em `mercadolivrePublicacao.test.ts` — objeto com os métodos encadeáveis que o código exercita:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./mercadolivreApi.js', () => ({
  obterConexaoAtual: vi.fn(),
  buscarPedido: vi.fn(),
  buscarPedidosRecentes: vi.fn(),
  buscarPerguntas: vi.fn(),
  buscarItensPorIds: vi.fn(),
  obterMargemSincronizacao: vi.fn(),
  atualizarItemML: vi.fn(),
  extrairMlbId: vi.fn((url: string) => url?.match(/MLB\d+/)?.[0] ?? null),
  buscarEnvio: vi.fn(),
  responderPergunta: vi.fn(),
}));

import { obterConexaoAtual, buscarPedido } from './mercadolivreApi.js';
import { processarPedidosPendentes } from './mercadolivreSync.js';

// Fila em memória: cada teste declara as linhas pendentes e inspeciona o que
// o consumidor escreveu de volta.
function criarSupabaseFake(opts: {
  pendentes: { id: string; topic: string; resource: string; tentativas: number }[];
  estoquePorMlb?: Record<string, { id: string; nome: string }>;
  formaPagamentoId?: string | null;
  registrarVenda?: (params: any) => { data: any; error: any };
}) {
  const atualizacoes: Record<string, any>[] = [];
  const vendasRegistradas: any[] = [];

  const supabase: any = {
    atualizacoes,
    vendasRegistradas,
    from(tabela: string) {
      if (tabela === 'mercadolivre_notificacoes') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({ order: () => ({ limit: () => Promise.resolve({ data: opts.pendentes, error: null }) }) }),
            }),
          }),
          update(payload: any) {
            return { eq: (_c: string, id: string) => { atualizacoes.push({ id, ...payload }); return Promise.resolve({ error: null }); } };
          },
        };
      }
      if (tabela === 'formas_pagamento') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.formaPagamentoId === null ? null : { id: opts.formaPagamentoId ?? 'fp-ml' }, error: null }) }) }),
        };
      }
      if (tabela === 'estoque') {
        const linhas = Object.entries(opts.estoquePorMlb ?? {}).map(([mlb, peca]) => ({
          id: peca.id, nome: peca.nome, valor: 10, quantidade: 1, condicao: 'original',
          anuncio_ml_url: `https://produto.mercadolivre.com.br/${mlb}`, categoria_id: null, modelo_moto_id: null, categoria: null, modelo_moto: null,
        }));
        return { select: () => ({ eq: () => Promise.resolve({ data: linhas, error: null }) }) };
      }
      if (tabela === 'estoque_anuncios_ml') {
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }
      if (tabela === 'vendas') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (tabela === 'usuarios') {
        return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      throw new Error(`tabela inesperada no fake: ${tabela}`);
    },
    rpc(nome: string, params: any) {
      if (nome !== 'registrar_venda') throw new Error(`rpc inesperada: ${nome}`);
      vendasRegistradas.push(params);
      return Promise.resolve(opts.registrarVenda ? opts.registrarVenda(params) : { data: { id: 'venda-1' }, error: null });
    },
  };
  return supabase;
}

const pedidoPago = {
  id: 555,
  status: 'paid',
  date_created: '2026-08-14T10:00:00.000Z',
  buyer: { nickname: 'comprador1' },
  shipping: { id: 777 },
  order_items: [{ item: { id: 'MLB111', title: 'Lanterna Traseira' }, quantity: 1, unit_price: 120 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterConexaoAtual).mockResolvedValue({ accessToken: 'token-fake', mlUserId: '42' } as any);
});

describe('processarPedidosPendentes', () => {
  it('pedido pago que casa com peça vira venda e marca a linha como processada', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(1);
    expect(supabase.vendasRegistradas[0]).toMatchObject({ p_estoque_id: 'peca-1', p_quantidade: 1, p_valor_unitario: 120, p_forma_pagamento_id: 'fp-ml' });
    expect(supabase.atualizacoes[0]).toMatchObject({ id: 'n1', erro: null });
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('pedido não pago é marcado processado sem virar venda', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({ ...pedidoPago, status: 'cancelled' } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(resultado.ignorados).toBe(1);
    expect(supabase.vendasRegistradas).toHaveLength(0);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('pedido sem peça correspondente não inventa venda — reporta pra avisar o usuário', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: {},
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(resultado.semMatch).toEqual([{ mlOrderId: '555', titulo: 'Lanterna Traseira' }]);
    expect(supabase.vendasRegistradas).toHaveLength(0);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('falha temporária não marca processado — incrementa tentativas pro próximo ciclo', async () => {
    vi.mocked(buscarPedido).mockRejectedValue(new Error('timeout'));
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.falhas).toBe(1);
    expect(supabase.atualizacoes[0]).toMatchObject({ id: 'n1', tentativas: 1, erro: 'timeout' });
    expect(supabase.atualizacoes[0].processado_em).toBeUndefined();
  });

  it('na última tentativa, marca processado preservando o erro pra não travar a fila', async () => {
    vi.mocked(buscarPedido).mockRejectedValue(new Error('timeout'));
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 4 }],
    });

    await processarPedidosPendentes(supabase);

    expect(supabase.atualizacoes[0]).toMatchObject({ id: 'n1', tentativas: 5, erro: 'timeout' });
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('estoque insuficiente vira aviso, não retry infinito', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      registrarVenda: () => ({ data: null, error: { message: 'Estoque insuficiente para o item' } }),
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.semMatch).toHaveLength(1);
    expect(resultado.falhas).toBe(0);
    expect(supabase.atualizacoes[0].processado_em).toBeTruthy();
  });

  it('sem conta conectada, não faz nada', async () => {
    vi.mocked(obterConexaoAtual).mockResolvedValue(null);
    const supabase = criarSupabaseFake({ pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }] });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(buscarPedido).not.toHaveBeenCalled();
  });

  it('sem a forma de pagamento MERCADO LIVRE (migration 044 não rodou), não importa nada', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      formaPagamentoId: null,
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(0);
    expect(supabase.vendasRegistradas).toHaveLength(0);
    expect(supabase.atualizacoes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/mercadolivreFilaPedidos.test.ts`
Expected: FAIL — `processarPedidosPendentes` não é exportado de `mercadolivreSync.js`.

- [ ] **Step 3: Implementar o consumidor**

Adicionar ao fim de `src/services/mercadolivreSync.ts`:

```ts
// ============================================================================
// Fila de pedidos (migration_044) — pedido pago no ML vira venda com baixa de
// estoque, sem clique humano. É a ÚNICA automação de escrita deste módulo, e
// ela escreve só em tabela nossa: nada aqui muta anúncio no Mercado Livre
// (isso continua exigindo revisão com checkbox, ver aplicarSincronizacao).
//
// Webhook e polling já escrevem em mercadolivre_notificacoes com índice único
// por (topic, resource) — as duas fontes convergem numa linha só, e este é o
// único consumidor.
// ============================================================================

const MAX_TENTATIVAS_PEDIDO = 5;
const PEDIDOS_POR_CICLO = 20;

export interface ResultadoFilaPedidos {
  importados: number;
  itensImportados: { estoqueNome: string; mlOrderId: string }[];
  semMatch: { mlOrderId: string; titulo: string }[];
  ignorados: number;
  falhas: number;
}

// A forma de pagamento dedicada é seed da migration_044. Ausente = migração
// não rodou: melhor não importar nada do que empurrar as vendas do canal ML
// pra uma forma de pagamento arbitrária e sujar o caixa.
async function obterFormaPagamentoMercadoLivre(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from('formas_pagamento').select('id').eq('nome', 'MERCADO LIVRE').maybeSingle();
  if (error) {
    if (ehErroDeMigrationAusente(error)) return null;
    throw error;
  }
  return data?.id ?? null;
}

function extrairOrderId(resource: string): string | null {
  return resource.match(/\/orders\/(\d+)/)?.[1] ?? null;
}

function ehErroDeEstoqueInsuficiente(mensagem: string): boolean {
  return /estoque insuficiente/i.test(mensagem);
}

export async function processarPedidosPendentes(supabase: SupabaseClient): Promise<ResultadoFilaPedidos> {
  const resultado: ResultadoFilaPedidos = { importados: 0, itensImportados: [], semMatch: [], ignorados: 0, falhas: 0 };

  const conexao = await obterConexaoAtual(supabase);
  if (!conexao) return resultado;

  const { data: pendentes, error: erroFila } = await supabase
    .from('mercadolivre_notificacoes')
    .select('id, topic, resource, tentativas')
    .eq('topic', 'orders_v2')
    .is('processado_em', null)
    .order('recebido_em', { ascending: true })
    .limit(PEDIDOS_POR_CICLO);

  if (erroFila) {
    if (ehErroDeMigrationAusente(erroFila)) {
      console.warn('⚠️ Fila de pedidos do Mercado Livre indisponível — rode supabase/migration_044_mercadolivre_fila_pedidos.sql. Importação automática desligada até lá.');
      return resultado;
    }
    throw erroFila;
  }
  if (!pendentes || pendentes.length === 0) return resultado;

  const formaPagamentoId = await obterFormaPagamentoMercadoLivre(supabase);
  if (!formaPagamentoId) {
    console.warn('⚠️ Forma de pagamento "MERCADO LIVRE" não encontrada — rode supabase/migration_044_mercadolivre_fila_pedidos.sql. Importação automática desligada até lá.');
    return resultado;
  }

  const mapaEstoque = await construirMapaEstoquePorMlb(supabase);

  // Sequencial de propósito: cada linha vira escrita no banco, e um lote
  // paralelo de registrar_venda na mesma peça disputaria o mesmo saldo.
  for (const linha of pendentes) {
    try {
      const orderId = extrairOrderId(linha.resource);
      if (!orderId) {
        resultado.ignorados++;
        await marcarProcessado(supabase, linha.id, null);
        continue;
      }

      const pedido = await buscarPedido(conexao.accessToken, orderId);
      if (!pedido || pedido.status !== 'paid') {
        resultado.ignorados++;
        await marcarProcessado(supabase, linha.id, null);
        continue;
      }

      for (const itemPedido of pedido.order_items ?? []) {
        const peca = mapaEstoque.get(itemPedido.item.id);
        if (!peca) {
          resultado.semMatch.push({ mlOrderId: orderId, titulo: itemPedido.item.title });
          continue;
        }
        try {
          const venda = await importarPedidoComoVenda(supabase, {
            estoqueId: peca.id,
            quantidade: itemPedido.quantity,
            valorUnitario: itemPedido.unit_price,
            formaPagamentoId,
            clienteNome: pedido.buyer?.nickname ?? null,
            data: pedido.date_created ?? null,
            mlOrderId: orderId,
            mlItemId: itemPedido.item.id,
            mlShippingId: pedido.shipping?.id ? String(pedido.shipping.id) : null,
          });
          if (venda) {
            resultado.importados++;
            resultado.itensImportados.push({ estoqueNome: peca.nome, mlOrderId: orderId });
          }
        } catch (err: any) {
          // Saldo zerado é divergência real entre sistema e Mercado Livre —
          // repetir não resolve, quem resolve é uma pessoa. Vira aviso.
          if (ehErroDeEstoqueInsuficiente(err.message ?? '')) {
            resultado.semMatch.push({ mlOrderId: orderId, titulo: itemPedido.item.title });
          } else {
            throw err;
          }
        }
      }

      await marcarProcessado(supabase, linha.id, null);
    } catch (err: any) {
      resultado.falhas++;
      const tentativas = (linha.tentativas ?? 0) + 1;
      const mensagem = err?.response?.data?.message || err?.message || 'erro desconhecido';
      if (tentativas >= MAX_TENTATIVAS_PEDIDO) {
        await marcarProcessado(supabase, linha.id, mensagem, tentativas);
      } else {
        await supabase.from('mercadolivre_notificacoes').update({ tentativas, erro: mensagem }).eq('id', linha.id);
      }
    }
  }

  return resultado;
}

async function marcarProcessado(supabase: SupabaseClient, id: string, erro: string | null, tentativas?: number): Promise<void> {
  const payload: Record<string, any> = { processado_em: new Date().toISOString(), erro };
  if (tentativas !== undefined) payload.tentativas = tentativas;
  const { error } = await supabase.from('mercadolivre_notificacoes').update(payload).eq('id', id);
  if (error && !ehErroDeMigrationAusente(error)) console.error('Erro ao marcar notificação do ML como processada:', error);
}
```

Adicionar `buscarPedido` ao import de `./mercadolivreApi.js` no topo do arquivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/mercadolivreFilaPedidos.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Ligar o consumidor no scheduler**

Em `src/services/mercadolivreScheduler.ts`, trocar o import e o corpo de `executar`:

```ts
import { verificarNotificacoesPendentes, processarPedidosPendentes } from './mercadolivreSync.js';
```

```ts
  const executar = () => {
    verificarNotificacoesPendentes(supabase)
      // Detectar primeiro, consumir depois: o polling é quem enfileira o
      // pedido que o webhook perdeu, então rodar na ordem inversa atrasaria
      // esse pedido em um ciclo inteiro.
      .then(() => processarPedidosPendentes(supabase))
      .catch((err) => {
        console.error('Erro no detector de pendências do Mercado Livre:', err.response?.data || err.message);
      });
  };
```

Atualizar o comentário de cabeçalho do arquivo, que hoje afirma que este loop "só detecta" — agora ele também importa venda (e continua sem tocar em anúncio).

- [ ] **Step 6: Rodar a suíte e o type-check**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/mercadolivreSync.ts src/services/mercadolivreScheduler.ts src/services/mercadolivreFilaPedidos.test.ts
git commit -m "feat: pedido pago no ML vira venda com baixa de estoque automática"
```

---

### Task 6: Pedido de variação registra a ficha correta

`construirMapaEstoquePorMlb` casa pedido com peça só pelo `MLB`, ignorando `variation_id`. Desde que a publicação com variações existe (migração 043), isso faz um pedido de ficha específica virar venda genérica da peça-mãe — o sistema não sabe qual unidade saiu, e `estoque_unidades.vendida_em` nunca é marcada.

**Files:**
- Modify: `src/services/mercadolivreSync.ts` (`ImportarPedidoParams` + `importarPedidoComoVenda` + resolução no consumidor)
- Test: `src/services/mercadolivreFilaPedidos.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: tabela `estoque_anuncios_ml_variacoes` (migração 043, colunas `ml_variation_id` e `unidade_id`); parâmetro `p_unidade_id` da RPC `registrar_venda` (migração 038).
- Produces: `ImportarPedidoParams` ganha `unidadeId?: string | null`.

- [ ] **Step 1: Write the failing test**

Adicionar ao `describe('processarPedidosPendentes')` em `src/services/mercadolivreFilaPedidos.test.ts`:

```ts
  it('pedido de uma variação registra a venda na ficha de unidade correspondente', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({
      ...pedidoPago,
      order_items: [{ item: { id: 'MLB111', title: 'Lanterna Traseira', variation_id: 900123 }, quantity: 1, unit_price: 120 }],
    } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      variacoes: { '900123': 'unidade-7' },
    });

    await processarPedidosPendentes(supabase);

    expect(supabase.vendasRegistradas[0]).toMatchObject({ p_estoque_id: 'peca-1', p_unidade_id: 'unidade-7' });
  });

  it('variação desconhecida (migration 043 sem o vínculo) registra a venda sem ficha, em vez de falhar', async () => {
    vi.mocked(buscarPedido).mockResolvedValue({
      ...pedidoPago,
      order_items: [{ item: { id: 'MLB111', title: 'Lanterna Traseira', variation_id: 900999 }, quantity: 1, unit_price: 120 }],
    } as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
      variacoes: {},
    });

    const resultado = await processarPedidosPendentes(supabase);

    expect(resultado.importados).toBe(1);
    expect(supabase.vendasRegistradas[0].p_unidade_id).toBeNull();
  });
```

E estender `criarSupabaseFake` com o novo parâmetro e a nova tabela:

```ts
  variacoes?: Record<string, string>; // ml_variation_id -> unidade_id
```

```ts
      if (tabela === 'estoque_anuncios_ml_variacoes') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) =>
              Promise.resolve({
                data: ids.filter((id) => opts.variacoes?.[id]).map((id) => ({ ml_variation_id: id, unidade_id: opts.variacoes![id] })),
                error: null,
              }),
          }),
        };
      }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/mercadolivreFilaPedidos.test.ts -t "variação"`
Expected: FAIL — `p_unidade_id` chega `undefined` (o consumidor nem lê `variation_id`).

- [ ] **Step 3: Passar `unidadeId` adiante**

Em `src/services/mercadolivreSync.ts`, adicionar o campo à interface:

```ts
export interface ImportarPedidoParams {
  estoqueId: string;
  quantidade: number;
  valorUnitario: number;
  formaPagamentoId: string;
  clienteNome: string | null;
  clienteId?: string | null;
  data: string | null;
  mlOrderId: string;
  mlItemId: string;
  mlShippingId: string | null;
  // Ficha específica (estoque_unidades) quando o pedido é de uma VARIAÇÃO —
  // sem isso a venda sai da peça-mãe e ninguém sabe qual unidade saiu.
  unidadeId?: string | null;
}
```

E na chamada da RPC dentro de `importarPedidoComoVenda`, adicionar o parâmetro:

```ts
    p_cliente_id: params.clienteId || null,
    p_unidade_id: params.unidadeId || null,
```

- [ ] **Step 4: Resolver a variação no consumidor**

Adicionar a função de resolução em `src/services/mercadolivreSync.ts`, na seção da fila:

```ts
// Mapeia variations[].id do pedido -> ficha de unidade que originou aquela
// variação (estoque_anuncios_ml_variacoes, migration_043). Ausência de
// vínculo não é erro: anúncio publicado antes da 043, ou variação criada à
// mão no site do Mercado Livre, simplesmente cai como venda da peça-mãe.
async function resolverUnidadesPorVariacao(supabase: SupabaseClient, variationIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (variationIds.length === 0) return mapa;

  const { data, error } = await supabase.from('estoque_anuncios_ml_variacoes').select('ml_variation_id, unidade_id').in('ml_variation_id', variationIds);
  if (error) {
    if (ehErroDeMigrationAusente(error)) return mapa;
    throw error;
  }
  for (const linha of data ?? []) {
    if (linha.unidade_id) mapa.set(String(linha.ml_variation_id), linha.unidade_id);
  }
  return mapa;
}
```

Dentro de `processarPedidosPendentes`, depois de validar que o pedido está pago e antes do loop de `order_items`:

```ts
      const variationIds = (pedido.order_items ?? [])
        .map((i: any) => (i.item?.variation_id != null ? String(i.item.variation_id) : null))
        .filter((id: string | null): id is string => !!id);
      const unidadesPorVariacao = await resolverUnidadesPorVariacao(supabase, variationIds);
```

E na chamada de `importarPedidoComoVenda`, adicionar:

```ts
            unidadeId: itemPedido.item.variation_id != null ? unidadesPorVariacao.get(String(itemPedido.item.variation_id)) ?? null : null,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/mercadolivreFilaPedidos.test.ts`
Expected: PASS (10 testes — os 8 da Task 5 mais os 2 novos).

- [ ] **Step 6: Commit**

```bash
git add src/services/mercadolivreSync.ts src/services/mercadolivreFilaPedidos.test.ts
git commit -m "feat: pedido de variação do ML registra a ficha de unidade correta"
```

---

### Task 7: Notificação push do que a fila importou

Sem isso a baixa acontece em silêncio — e "todo alerta precisa ter uma ação associada" também vale ao contrário: uma mudança de estoque feita pelo sistema precisa ser visível. Uma notificação agregada por ciclo, nunca uma por pedido.

**Files:**
- Create: `src/services/destinatariosNotificacao.ts`
- Modify: `src/services/notificacoesScheduler.ts` (passar a importar a função extraída, removendo a cópia privada)
- Modify: `src/services/mercadolivreSync.ts` (notificar ao fim de `processarPedidosPendentes`)
- Test: `src/services/mercadolivreFilaPedidos.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `notificarUsuarios(supabase, usuarioIds, { titulo, corpo, url })` de `src/services/pushNotificationService.ts`.
- Produces: `export async function buscarDestinatariosEquipe(supabase: SupabaseClient): Promise<string[]>` em `src/services/destinatariosNotificacao.ts`.

- [ ] **Step 1: Write the failing test**

Adicionar no topo de `src/services/mercadolivreFilaPedidos.test.ts` o mock do push:

```ts
vi.mock('./pushNotificationService.js', () => ({ notificarUsuarios: vi.fn(() => Promise.resolve()) }));
```

```ts
import { notificarUsuarios } from './pushNotificationService.js';
```

E estender o fake pra devolver destinatários (trocar o ramo `usuarios`):

```ts
      if (tabela === 'usuarios') {
        return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: [{ id: 'user-1' }], error: null }) }) }) };
      }
```

Adicionar os casos:

```ts
  it('avisa a equipe quando importou, dizendo quantas peças saíram', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: { MLB111: { id: 'peca-1', nome: 'Lanterna Traseira' } },
    });

    await processarPedidosPendentes(supabase);

    expect(notificarUsuarios).toHaveBeenCalledWith(supabase, ['user-1'], expect.objectContaining({ url: '/mercadolivre' }));
    const payload = vi.mocked(notificarUsuarios).mock.calls[0][2];
    expect(payload.corpo).toContain('Lanterna Traseira');
  });

  it('avisa separadamente o pedido que não casou com peça nenhuma', async () => {
    vi.mocked(buscarPedido).mockResolvedValue(pedidoPago as any);
    const supabase = criarSupabaseFake({
      pendentes: [{ id: 'n1', topic: 'orders_v2', resource: '/orders/555', tentativas: 0 }],
      estoquePorMlb: {},
    });

    await processarPedidosPendentes(supabase);

    const corpos = vi.mocked(notificarUsuarios).mock.calls.map((c) => c[2].corpo);
    expect(corpos.some((c) => /não casou|não encontrada/i.test(c))).toBe(true);
  });

  it('ciclo sem novidade não dispara push nenhum', async () => {
    const supabase = criarSupabaseFake({ pendentes: [] });

    await processarPedidosPendentes(supabase);

    expect(notificarUsuarios).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/mercadolivreFilaPedidos.test.ts -t "avisa"`
Expected: FAIL — `notificarUsuarios` nunca é chamado.

- [ ] **Step 3: Extrair a busca de destinatários**

Criar `src/services/destinatariosNotificacao.ts`:

```ts
// Quem recebe push de evento do sistema (não de tarefa pessoal): todo usuário
// ativo com papel admin ou equipe. Extraído de notificacoesScheduler.ts
// quando a fila de pedidos do Mercado Livre passou a precisar do mesmo
// público — duas cópias divergiriam na primeira vez que um papel novo
// entrasse no sistema.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function buscarDestinatariosEquipe(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('usuarios').select('id, roles').eq('ativo', true).or('roles.ov.{admin,equipe}');
  if (error) throw error;
  return (data ?? []).map((u: { id: string }) => u.id);
}
```

Em `src/services/notificacoesScheduler.ts`, apagar a função privada `buscarDestinatarios` e importar a nova, trocando a chamada por `buscarDestinatariosEquipe(supabase)`.

- [ ] **Step 4: Notificar ao fim do consumidor**

Em `src/services/mercadolivreSync.ts`, adicionar os imports:

```ts
import { notificarUsuarios } from './pushNotificationService.js';
import { buscarDestinatariosEquipe } from './destinatariosNotificacao.js';
```

E, antes do `return resultado` de `processarPedidosPendentes`:

```ts
  await avisarResultadoDaFila(supabase, resultado);
  return resultado;
```

Com a função:

```ts
// Agregada por ciclo, nunca uma notificação por pedido — uma tarde
// movimentada não pode virar enxurrada de push. Nunca lança: falha de push
// não pode desfazer nem mascarar a importação, que já está no banco.
async function avisarResultadoDaFila(supabase: SupabaseClient, resultado: ResultadoFilaPedidos): Promise<void> {
  if (resultado.importados === 0 && resultado.semMatch.length === 0) return;

  try {
    const destinatarios = await buscarDestinatariosEquipe(supabase);
    if (destinatarios.length === 0) return;

    if (resultado.importados > 0) {
      const nomes = Array.from(new Set(resultado.itensImportados.map((i) => i.estoqueNome)));
      const corpo =
        resultado.importados === 1
          ? `${nomes[0]} — baixa dada no estoque.`
          : `${resultado.importados} peças vendidas (${nomes.slice(0, 3).join(', ')}${nomes.length > 3 ? '...' : ''}) — baixa dada no estoque.`;
      await notificarUsuarios(supabase, destinatarios, { titulo: 'Venda no Mercado Livre', corpo, url: '/mercadolivre' });
    }

    if (resultado.semMatch.length > 0) {
      const corpo =
        resultado.semMatch.length === 1
          ? `"${resultado.semMatch[0].titulo}" (pedido ${resultado.semMatch[0].mlOrderId}) não casou com nenhuma peça do estoque — registre a venda na mão.`
          : `${resultado.semMatch.length} itens vendidos não casaram com peça do estoque — registre as vendas na mão.`;
      await notificarUsuarios(supabase, destinatarios, { titulo: 'Pedido do ML precisa de você', corpo, url: '/mercadolivre' });
    }
  } catch (err: any) {
    console.error('Erro ao notificar resultado da fila de pedidos do ML:', err?.message || err);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/mercadolivreFilaPedidos.test.ts && npx vitest run src/services/`
Expected: PASS — inclusive os testes que já existiam de `notificacoesScheduler`, se houver.

- [ ] **Step 6: Commit**

```bash
git add src/services/destinatariosNotificacao.ts src/services/notificacoesScheduler.ts src/services/mercadolivreSync.ts src/services/mercadolivreFilaPedidos.test.ts
git commit -m "feat: push agregado quando a fila do ML dá baixa no estoque"
```

---

### Task 8: Venda no estoque avisa que o anúncio precisa de ajuste

O item 5. Existe hoje um toast local ("Sincronizar agora") que só funciona pra quem está com a tela aberta e some ao trocar de aba. O gatilho no servidor cobre o resto: outro aparelho, outra aba, venda vinda de orçamento aprovado ou da fila automática da Task 5.

**Files:**
- Modify: `src/services/mercadolivreSync.ts` (nova função exportada)
- Modify: `src/server/routes/vendas.ts` (chamar após a venda, rota `POST /`)
- Modify: `src/server/routes/orcamentos.ts` (chamar após as duas rotas que vendem)
- Test: `src/services/avisarAnunciosDesatualizados.test.ts` (criar)

**Interfaces:**
- Consumes: `buscarDestinatariosEquipe` (Task 7); `notificarUsuarios`.
- Produces: `export async function avisarAnunciosDesatualizados(supabase: SupabaseClient, estoqueIds: string[]): Promise<void>` — nunca lança.

- [ ] **Step 1: Write the failing test**

Criar `src/services/avisarAnunciosDesatualizados.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./pushNotificationService.js', () => ({ notificarUsuarios: vi.fn(() => Promise.resolve()) }));
vi.mock('./mercadolivreApi.js', () => ({
  obterConexaoAtual: vi.fn(), buscarPedido: vi.fn(), buscarPedidosRecentes: vi.fn(), buscarPerguntas: vi.fn(),
  buscarItensPorIds: vi.fn(), obterMargemSincronizacao: vi.fn(), atualizarItemML: vi.fn(), buscarEnvio: vi.fn(),
  responderPergunta: vi.fn(), extrairMlbId: vi.fn(),
}));

import { notificarUsuarios } from './pushNotificationService.js';
import { atualizarItemML } from './mercadolivreApi.js';
import { avisarAnunciosDesatualizados } from './mercadolivreSync.js';

function criarSupabaseFake(links: { estoque_id: string }[], usuarios: { id: string }[] = [{ id: 'user-1' }]) {
  return {
    from(tabela: string) {
      if (tabela === 'estoque_anuncios_ml') {
        return { select: () => ({ in: () => Promise.resolve({ data: links, error: null }) }) };
      }
      if (tabela === 'usuarios') {
        return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: usuarios, error: null }) }) }) };
      }
      throw new Error(`tabela inesperada: ${tabela}`);
    },
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('avisarAnunciosDesatualizados', () => {
  it('peça com anúncio vinculado gera notificação apontando pra revisão', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFake([{ estoque_id: 'peca-1' }]), ['peca-1']);

    expect(notificarUsuarios).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(notificarUsuarios).mock.calls[0][2];
    expect(payload.url).toBe('/mercadolivre');
  });

  it('nunca muta o anúncio sozinho — só avisa', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFake([{ estoque_id: 'peca-1' }]), ['peca-1']);

    expect(atualizarItemML).not.toHaveBeenCalled();
  });

  it('peça sem anúncio no ML não gera notificação nenhuma', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFake([]), ['peca-1']);

    expect(notificarUsuarios).not.toHaveBeenCalled();
  });

  it('lista vazia não consulta nada', async () => {
    const supabase = { from: vi.fn() } as any;

    await avisarAnunciosDesatualizados(supabase, []);

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('falha de banco não propaga — venda já aconteceu e não pode ser desfeita por erro de aviso', async () => {
    const supabase = {
      from: () => ({ select: () => ({ in: () => Promise.reject(new Error('conexão caiu')) }) }),
    } as any;

    await expect(avisarAnunciosDesatualizados(supabase, ['peca-1'])).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/avisarAnunciosDesatualizados.test.ts`
Expected: FAIL — `avisarAnunciosDesatualizados` não é exportado.

- [ ] **Step 3: Implementar a função**

Adicionar em `src/services/mercadolivreSync.ts`, na seção da fila:

```ts
// Contraparte do consumidor: quando a peça sai pelo estoque (balcão,
// orçamento aprovado, ou a própria importação automática), o anúncio no
// Mercado Livre fica anunciando quantidade que não existe mais. Isto AVISA —
// aplicar continua sendo revisão com checkbox (aplicarSincronizacao), porque
// mexer no anúncio muda a vitrine real da loja.
//
// Complementa (não substitui) o toast "Sincronizar agora" que VendasView e
// OrcamentosView já mostram: o toast é o caminho rápido pra quem está com a
// tela aberta; o push cobre outro aparelho, outra aba, e venda que nasceu da
// fila automática.
//
// Nunca lança: a venda já está registrada quando isto roda, e falha de aviso
// não pode virar erro 500 numa venda que deu certo.
export async function avisarAnunciosDesatualizados(supabase: SupabaseClient, estoqueIds: string[]): Promise<void> {
  if (estoqueIds.length === 0) return;

  try {
    const { data: links, error } = await supabase.from('estoque_anuncios_ml').select('estoque_id').in('estoque_id', estoqueIds);
    if (error) {
      if (ehErroDeMigrationAusente(error)) return;
      throw error;
    }
    const afetadas = new Set((links ?? []).map((l: { estoque_id: string }) => l.estoque_id));
    if (afetadas.size === 0) return;

    const destinatarios = await buscarDestinatariosEquipe(supabase);
    if (destinatarios.length === 0) return;

    const corpo =
      afetadas.size === 1
        ? '1 anúncio no Mercado Livre está com quantidade desatualizada. Revise e aplique.'
        : `${afetadas.size} anúncios no Mercado Livre estão com quantidade desatualizada. Revise e aplique.`;

    await notificarUsuarios(supabase, destinatarios, { titulo: 'Anúncio precisa de ajuste', corpo, url: '/mercadolivre' });
  } catch (err: any) {
    console.error('Erro ao avisar sobre anúncios desatualizados:', err?.message || err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/avisarAnunciosDesatualizados.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Chamar nos pontos que registram venda**

Em `src/server/routes/vendas.ts`, importar a função e chamá-la logo antes do `res.json` da rota `POST /` (sem `await` bloqueante — o `void` deixa explícito que a resposta não espera o push):

```ts
      if (error) throw error;
      // Fire-and-forget: a venda já está registrada; avisar sobre o anúncio
      // não pode atrasar nem derrubar a resposta.
      void avisarAnunciosDesatualizados(supabase, [estoque_id]);
      res.json({ success: true, data: venda });
```

Em `src/server/routes/orcamentos.ts`, fazer o mesmo nas duas rotas que vendem: a que vende uma linha isolada e a que vende o orçamento inteiro em lote. Na rota em lote, acumular os `estoque_id` das linhas vendidas com sucesso numa lista e chamar **uma vez** ao fim, antes de responder:

```ts
      void avisarAnunciosDesatualizados(supabase, estoqueIdsVendidos);
```

- [ ] **Step 6: Rodar tudo**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/mercadolivreSync.ts src/services/avisarAnunciosDesatualizados.test.ts src/server/routes/vendas.ts src/server/routes/orcamentos.ts
git commit -m "feat: venda no estoque avisa que anúncio do ML precisa de ajuste"
```

---

### Task 9: Patch notes e verificação de ponta a ponta

**Files:**
- Modify: `src/features/patchnotes/data.ts` (nova entrada no TOPO do array)

**Interfaces:**
- Consumes: `PatchNoteEntrada`, `PatchNoteItem` (já existentes no arquivo).
- Produces: nada.

- [ ] **Step 1: Adicionar a entrada de patch notes**

No topo de `PATCH_NOTES` em `src/features/patchnotes/data.ts` (a versão anterior é `1.2.15`):

```ts
  {
    versao: '1.2.16',
    data: '2026-08-14',
    titulo: 'Estoque e Mercado Livre agora conversam nos dois sentidos',
    itens: [
      {
        tipo: 'feature',
        texto:
          'Venda feita no Mercado Livre agora dá baixa no estoque sozinha, com aviso no celular dizendo qual peça saiu. Pedido que não bate com nenhuma peça do catálogo nunca vira venda automática — você recebe um aviso pra registrar na mão.',
      },
      {
        tipo: 'feature',
        texto:
          'Vendeu no balcão uma peça que está anunciada no Mercado Livre? Você recebe um aviso de que o anúncio ficou com quantidade desatualizada, com atalho direto pra tela de revisão. Aplicar continua sendo decisão sua, com a lista de conferência de sempre.',
      },
      {
        tipo: 'feature',
        texto:
          'A descrição do anúncio já abre preenchida com o texto padrão da RK Sucatas. Tem um botão pra limpar quando você quiser escrever outro, e pra restaurar o padrão depois.',
      },
      {
        tipo: 'melhoria',
        texto:
          'Ligar o toggle "Publicar automaticamente no Mercado Livre" já começa a remover o fundo das fotos em segundo plano. Quando você abre o formulário, as prévias estão prontas — aprovar cada foto continua sendo seu clique.',
      },
      {
        tipo: 'fix',
        texto:
          'O toggle de padronizar a categoria do Mercado Livre salvava a escolha, mas ela nunca voltava: toda peça nova da mesma categoria (Lanterna, por exemplo) abria sem a categoria pré-selecionada. Corrigido — agora a predefinição realmente aparece.',
      },
      {
        tipo: 'fix',
        texto:
          'Venda de anúncio com variações registrava a peça genérica sem saber qual ficha específica tinha saído. Agora a venda é vinculada à ficha certa.',
      },
    ],
  },
```

- [ ] **Step 2: Verificação final**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm test`
Expected: PASS — suíte inteira, sem testes pulados.

Run: `npm run build`
Expected: build de produção conclui sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/features/patchnotes/data.ts
git commit -m "docs: patch notes 1.2.16 — sincronização ML e ajustes de publicação"
```

- [ ] **Step 4: Rodar as migrações e validar à mão**

Isto é do usuário, não do agente. Passar exatamente isto adiante:

1. No editor SQL do Supabase, rodar em ordem as migrações pendentes até a 043, e por último `supabase/migration_044_mercadolivre_fila_pedidos.sql`.
2. Reiniciar o servidor (`tsx server.ts` não recarrega backend sozinho).
3. Confirmar no log da subida que não aparece nenhum aviso de "rode supabase/migration_044".
4. **Esperado na primeira execução:** a fila nasce com as notificações antigas pendentes, então o primeiro ciclo pode importar pedidos das últimas semanas de uma vez. Pedidos já importados são pulados pela dedupe — mas confira a lista de vendas depois do primeiro ciclo.

---

## Self-Review

**Cobertura da spec:**
- Consumidor de fila (Parte 1) → Tasks 4, 5.
- Variações → ficha de unidade → Task 6.
- Notificações do consumidor (sucesso e sem-match) → Task 7.
- Gatilho na venda (Parte 2) → Task 8.
- Migração 044 (colunas + índice + forma de pagamento) → Task 4.
- Degradação graciosa sem migração → Tasks 5 (fila e forma de pagamento ausentes), 6 (tabela de variações ausente), 8 (tabela de links ausente).
- Fora de escopo respeitado: nenhuma task estorna venda por cancelamento no ML, cria tela de administração da fila, faz reconciliação retroativa, ou muta anúncio automaticamente (Task 8 tem teste explícito de que `atualizarItemML` não é chamado).
- Bloco A → Tasks 1, 2, 3.
