// @vitest-environment jsdom
//
// Cobre o bug relatado pelo usuário: trocar de peça (prop `item`) sem
// desmontar o modal (EstoqueView.tsx troca só a prop, não recria o
// componente) deixava a seleção de fotos, título, descrição e categoria
// "presos" na peça anterior — o payload de publicação saía com dados da
// peça errada. Seam: DOM renderizado pelo componente em função da prop
// `item`, via @testing-library/react.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EstoquePublicarMlModal } from './EstoquePublicarMlModal';
import { DESCRICAO_PADRAO_ANUNCIO } from './descricaoPadraoMl';
import { useRemocaoFundoFotos } from './useRemocaoFundoFotos';
import type { CategoriaMlSugerida, Estoque } from './types';

const categoriaFake: CategoriaMlSugerida = { id: 'MLB123', nome: 'Lanternas', caminho: 'Peças > Iluminação', atributosSugeridos: [] };
const categoriaPadraoFake: CategoriaMlSugerida = { id: 'MLB999', nome: 'Carcaças de Motor', caminho: 'Peças > Motor', atributosSugeridos: [] };

vi.mock('../mercadolivre/api', () => ({
  mercadolivreApi: {
    sugerirCategoria: vi.fn(() => Promise.resolve({ success: true, data: [categoriaFake] })),
    buscarTiposAnuncio: vi.fn(() => new Promise(() => {})),
    buscarSubcategorias: vi.fn(() => new Promise(() => {})),
    buscarAtributosCategoria: vi.fn(() => Promise.resolve({ success: true, data: [] })),
    buscarConfiguracao: vi.fn(() => new Promise(() => {})),
    buscarDetalheCategoria: vi.fn((id: string) =>
      id === categoriaPadraoFake.id ? Promise.resolve({ success: true, data: categoriaPadraoFake }) : Promise.resolve({ success: false })
    ),
  },
}));

vi.mock('./api', () => ({
  estoqueApi: {
    atualizarParcial: vi.fn(),
    publicarMl: vi.fn(),
    listarAnunciosMl: vi.fn(),
  },
  uploadImagemEstoque: vi.fn(),
}));

vi.mock('../../lib/catalogApi', () => ({
  categoriasApi: {
    memorizarCategoriaMlPadrao: vi.fn(),
  },
}));

// Dublê do hook useRemocaoFundoFotos (Task 3) — estes testes cobrem o reset
// por troca de item, não a máquina de remoção de fundo em si (que tem sua
// própria suíte em useRemocaoFundoFotos.test.ts). Recriado a cada teste via
// factory, não constante módulo, pra não vazar chamadas de mock entre testes.
function criarRemocaoFundoFake() {
  return {
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
}

function criarItem(overrides: Partial<Estoque> & Pick<Estoque, 'id' | 'imagens' | 'nome'>): Estoque {
  return {
    codigo: 'RK-1',
    categoria_id: null,
    modelo_moto_id: null,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    descricao: null,
    ativo: true,
    criado_em: '',
    atualizado_em: '',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    ...overrides,
  };
}

function botaoDaFoto(url: string): HTMLElement | null {
  const img = document.querySelector(`img[src="${url}"]`);
  return img?.closest('button') ?? null;
}

function fotoSelecionada(url: string): boolean {
  return !!botaoDaFoto(url)?.className.includes('border-accent');
}

/** Espera a sugestão de categoria chegar (debounce de 400ms) e seleciona ela, abrindo o resto do formulário. */
async function selecionarCategoriaSugerida() {
  const botaoSugestao = await screen.findByText(categoriaFake.nome, undefined, { timeout: 1000 });
  fireEvent.click(botaoSugestao);
  await waitFor(() => expect(screen.queryByPlaceholderText('Título do anúncio')).not.toBeNull(), { timeout: 1000 });
}

describe('EstoquePublicarMlModal — troca de peça sem desmontar', () => {
  afterEach(() => cleanup());

  it('reseta a seleção de fotos para as fotos da nova peça ao trocar o prop item', async () => {
    const itemA = criarItem({ id: 'a', nome: 'Lanterna CG 150', imagens: ['https://x/a.jpg'] });
    const itemB = criarItem({ id: 'b', nome: 'Lanterna Biz 100', imagens: ['https://x/b.jpg'] });

    const { rerender } = render(<EstoquePublicarMlModal aberto item={itemA} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();
    expect(fotoSelecionada('https://x/a.jpg')).toBe(true);

    rerender(<EstoquePublicarMlModal aberto item={itemB} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();

    expect(fotoSelecionada('https://x/b.jpg')).toBe(true);
  });

  it('reseta o título do anúncio para o da nova peça ao trocar o prop item (descrição segue o padrão institucional, ver describe dedicado)', async () => {
    const itemA = criarItem({ id: 'a', nome: 'Lanterna CG 150', descricao: 'Descrição A', imagens: [] });
    const itemB = criarItem({ id: 'b', nome: 'Lanterna Biz 100', descricao: 'Descrição B', imagens: [] });

    const { rerender } = render(<EstoquePublicarMlModal aberto item={itemA} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();
    expect((screen.getByPlaceholderText('Título do anúncio') as HTMLInputElement).value).toBe('Lanterna CG 150');
    expect((screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement).value).toBe(DESCRICAO_PADRAO_ANUNCIO);

    rerender(<EstoquePublicarMlModal aberto item={itemB} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();

    expect((screen.getByPlaceholderText('Título do anúncio') as HTMLInputElement).value).toBe('Lanterna Biz 100');
    expect((screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement).value).toBe(DESCRICAO_PADRAO_ANUNCIO);
  });
});

describe('EstoquePublicarMlModal — padronizar categoria (Fase 4)', () => {
  afterEach(() => cleanup());

  it('pré-seleciona a categoria memorizada como padrão da categoria interna, sem precisar buscar/navegar', async () => {
    const item = criarItem({
      id: 'c',
      nome: 'Carcaça motor CG 150',
      imagens: [],
      categoria_id: 'cat-motor',
      categoria: { id: 'cat-motor', nome: 'Carcaças', parent_id: null, ordem: 0, mercadolivre_categoria_id_padrao: categoriaPadraoFake.id },
    });

    render(<EstoquePublicarMlModal aberto item={item} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);

    // O título/descrição do anúncio só aparece quando categoriaSelecionada
    // já está preenchida — aqui isso precisa acontecer SEM clicar em
    // nenhuma sugestão, diferente de selecionarCategoriaSugerida() acima.
    await waitFor(() => expect(screen.queryByPlaceholderText('Título do anúncio')).not.toBeNull(), { timeout: 1000 });
    expect(screen.getByText(categoriaPadraoFake.nome)).toBeTruthy();
  });
});

describe('EstoquePublicarMlModal — descrição padrão', () => {
  afterEach(() => cleanup());

  // O campo de descrição só existe no DOM depois que uma categoria é
  // selecionada (ver `categoriaSelecionada &&` no componente) — por isso
  // toda peça criada aqui passa por selecionarCategoriaSugerida() antes de
  // procurar o textarea, igual aos describes acima.

  it('abre com o texto institucional da RK, ignorando a descrição interna da peça', async () => {
    const item = criarItem({ id: 'p1', nome: 'Lanterna', imagens: [], descricao: 'nota interna de catalogação' });

    render(<EstoquePublicarMlModal aberto item={item} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();

    const campo = screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement;
    expect(campo.value).toBe(DESCRICAO_PADRAO_ANUNCIO);
    expect(campo.value).not.toContain('nota interna de catalogação');
  });

  it('o botão Limpar esvazia o campo e vira Restaurar padrão', async () => {
    const item = criarItem({ id: 'p1', nome: 'Lanterna', imagens: [] });

    render(<EstoquePublicarMlModal aberto item={item} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();

    const campo = screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement;
    fireEvent.click(screen.getByText('Limpar'));
    expect(campo.value).toBe('');

    fireEvent.click(screen.getByText('Restaurar padrão'));
    expect(campo.value).toBe(DESCRICAO_PADRAO_ANUNCIO);
  });

  it('trocar de peça reseta a descrição de volta pro padrão', async () => {
    const itemA = criarItem({ id: 'p1', nome: 'Lanterna', imagens: [] });
    const itemB = criarItem({ id: 'p2', nome: 'Farol', imagens: [] });

    const { rerender } = render(<EstoquePublicarMlModal aberto item={itemA} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();
    const campo = screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: 'texto só desta peça' } });

    rerender(<EstoquePublicarMlModal aberto item={itemB} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={criarRemocaoFundoFake()} />);
    await selecionarCategoriaSugerida();
    expect((screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement).value).toBe(DESCRICAO_PADRAO_ANUNCIO);
  });
});

// Regressão: uma versão anterior desta task memoizava o objeto devolvido por
// useRemocaoFundoFotos (useMemo) e colocava esse objeto no array de deps do
// efeito de reset por item.id do modal. Como limparTudo() sempre cria
// []/{}/new Set() novos — mesmo "zerando" um estado que já estava vazio — o
// objeto memoizado nunca alcançava um ponto fixo: efeito roda → limparTudo()
// → estado novo → objeto memoizado novo → deps mudaram → efeito roda de novo
// → loop infinito, travando a página assim que o modal monta.
//
// Os testes acima usam criarRemocaoFundoFake() (objeto escrito à mão, cuja
// identidade nunca muda) — por isso NENHUM deles pegou o bug. Só ligando o
// HOOK REAL ao MODAL REAL o loop fica visível. Confirmado ao vivo: reintroduzir
// o useMemo + `[item.id, remocaoFundo]` fez o `render()` abaixo NUNCA
// resolver — o teste trava e estoura o timeout, não lança uma exceção
// síncrona (esse loop é uma cascata de efeito → setState → efeito de novo,
// não um setState em fase de render, que é o único caso em que o React
// lança "Maximum update depth exceeded" de forma síncrona). Por isso o
// timeout curto abaixo é a asserção principal — chegar ao fim da promise é
// a prova de que o efeito estabilizou; o spy de console.error fica como
// sinal auxiliar pros casos em que o React consegue detectar e avisar.
describe('EstoquePublicarMlModal — hook real de remoção de fundo (regressão de loop infinito)', () => {
  afterEach(() => cleanup());

  function Wrapper({ item }: { item: Estoque }) {
    const remocaoFundo = useRemocaoFundoFotos();
    return <EstoquePublicarMlModal aberto item={item} modelos={[]} onFechar={() => {}} onPublicado={() => {}} remocaoFundo={remocaoFundo} />;
  }

  it(
    'monta com o hook real sem entrar em loop infinito de re-render',
    async () => {
      const item = criarItem({ id: 'real-1', nome: 'Lanterna CG 150', imagens: ['https://x/a.jpg'] });
      const erroSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<Wrapper item={item} />);
      // Terminar este await dentro do timeout do teste (5s, bem acima do que
      // um mount saudável leva) já é a evidência: com o bug, esta chamada
      // nunca resolve porque o efeito de reset nunca para de re-disparar.
      await selecionarCategoriaSugerida();

      expect(erroSpy.mock.calls.some((args) => String(args[0]).includes('Maximum update depth'))).toBe(false);
      erroSpy.mockRestore();
    },
    5000
  );

  it(
    'trocar de peça com o hook real reseta a seleção de fotos, sem loop, e sem apagar a prévia da peça nova incorretamente',
    async () => {
      const itemA = criarItem({ id: 'real-a', nome: 'Lanterna CG 150', imagens: ['https://x/a.jpg'] });
      const itemB = criarItem({ id: 'real-b', nome: 'Lanterna Biz 100', imagens: ['https://x/b.jpg'] });
      const erroSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { rerender } = render(<Wrapper item={itemA} />);
      await selecionarCategoriaSugerida();
      expect(fotoSelecionada('https://x/a.jpg')).toBe(true);

      rerender(<Wrapper item={itemB} />);
      await selecionarCategoriaSugerida();
      expect(fotoSelecionada('https://x/b.jpg')).toBe(true);

      expect(erroSpy.mock.calls.some((args) => String(args[0]).includes('Maximum update depth'))).toBe(false);
      erroSpy.mockRestore();
    },
    5000
  );
});
