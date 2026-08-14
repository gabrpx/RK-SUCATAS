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

    const { rerender } = render(<EstoquePublicarMlModal aberto item={itemA} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);
    await selecionarCategoriaSugerida();
    expect(fotoSelecionada('https://x/a.jpg')).toBe(true);

    rerender(<EstoquePublicarMlModal aberto item={itemB} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);
    await selecionarCategoriaSugerida();

    expect(fotoSelecionada('https://x/b.jpg')).toBe(true);
  });

  it('reseta título e descrição do anúncio para os da nova peça ao trocar o prop item', async () => {
    const itemA = criarItem({ id: 'a', nome: 'Lanterna CG 150', descricao: 'Descrição A', imagens: [] });
    const itemB = criarItem({ id: 'b', nome: 'Lanterna Biz 100', descricao: 'Descrição B', imagens: [] });

    const { rerender } = render(<EstoquePublicarMlModal aberto item={itemA} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);
    await selecionarCategoriaSugerida();
    expect((screen.getByPlaceholderText('Título do anúncio') as HTMLInputElement).value).toBe('Lanterna CG 150');
    expect((screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement).value).toBe('Descrição A');

    rerender(<EstoquePublicarMlModal aberto item={itemB} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);
    await selecionarCategoriaSugerida();

    expect((screen.getByPlaceholderText('Título do anúncio') as HTMLInputElement).value).toBe('Lanterna Biz 100');
    expect((screen.getByPlaceholderText('Descrição do anúncio') as HTMLTextAreaElement).value).toBe('Descrição B');
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

    render(<EstoquePublicarMlModal aberto item={item} modelos={[]} onFechar={() => {}} onPublicado={() => {}} />);

    // O título/descrição do anúncio só aparece quando categoriaSelecionada
    // já está preenchida — aqui isso precisa acontecer SEM clicar em
    // nenhuma sugestão, diferente de selecionarCategoriaSugerida() acima.
    await waitFor(() => expect(screen.queryByPlaceholderText('Título do anúncio')).not.toBeNull(), { timeout: 1000 });
    expect(screen.getByText(categoriaPadraoFake.nome)).toBeTruthy();
  });
});
