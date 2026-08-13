import { describe, it, expect, vi } from 'vitest';

vi.mock('./mercadolivreApi.js', () => ({
  buscarCategoriasRaizML: vi.fn(),
  buscarCategoriaML: vi.fn(),
  buscarTiposAnuncioML: vi.fn(),
  buscarProdutosCatalogoML: vi.fn(),
}));

import { buscarCategoriasRaizML, buscarCategoriaML, buscarTiposAnuncioML, buscarProdutosCatalogoML } from './mercadolivreApi.js';
import { listarFilhosCategoria, buscarTiposAnuncioDisponiveis, buscarProdutosCatalogo, montarPayloadPublicacao } from './mercadolivrePublicacao.js';

describe('listarFilhosCategoria', () => {
  it('sem categoriaId, busca as categorias raiz do site MLB e mapeia pra {id, nome}', async () => {
    vi.mocked(buscarCategoriasRaizML).mockResolvedValue([
      { id: 'MLB1071', name: 'Acessórios para Veículos' },
      { id: 'MLB1743', name: 'Motos' },
    ]);

    const filhos = await listarFilhosCategoria('token-fake');

    expect(buscarCategoriasRaizML).toHaveBeenCalledWith('token-fake');
    expect(buscarCategoriaML).not.toHaveBeenCalled();
    expect(filhos).toEqual([
      { id: 'MLB1071', nome: 'Acessórios para Veículos' },
      { id: 'MLB1743', nome: 'Motos' },
    ]);
  });

  it('com categoriaId, busca a categoria e mapeia children_categories pra {id, nome}', async () => {
    vi.mocked(buscarCategoriaML).mockResolvedValue({
      id: 'MLB438724',
      name: 'Peças de Motos e Quadriciclos',
      path_from_root: [],
      children_categories: [
        { id: 'MLB438729', name: 'Iluminação' },
        { id: 'MLB438730', name: 'Motor' },
      ],
    });

    const filhos = await listarFilhosCategoria('token-fake', 'MLB438724');

    expect(buscarCategoriaML).toHaveBeenCalledWith('token-fake', 'MLB438724');
    expect(filhos).toEqual([
      { id: 'MLB438729', nome: 'Iluminação' },
      { id: 'MLB438730', nome: 'Motor' },
    ]);
  });

  it('categoria-folha (children_categories vazio) retorna lista vazia', async () => {
    vi.mocked(buscarCategoriaML).mockResolvedValue({
      id: 'MLB438756',
      name: 'Lanternas',
      path_from_root: [],
      children_categories: [],
    });

    const filhos = await listarFilhosCategoria('token-fake', 'MLB438756');

    expect(filhos).toEqual([]);
  });
});

describe('buscarTiposAnuncioDisponiveis', () => {
  it('mapeia sale_fee_amount (R$) pra percentual e também expõe o valor cru em R$ e a exposição crua', async () => {
    vi.mocked(buscarTiposAnuncioML).mockResolvedValue([
      {
        listing_type_id: 'gold_pro',
        listing_type_name: 'Premium',
        listing_exposure: 'highest',
        requires_picture: true,
        currency_id: 'BRL',
        listing_fee_amount: 0,
        sale_fee_amount: 24.96,
        free_relist: false,
        stop_time: '2046-08-08T00:00:00.000-04:00',
      },
      {
        listing_type_id: 'gold_special',
        listing_type_name: 'Clássico',
        listing_exposure: 'highest',
        requires_picture: true,
        currency_id: 'BRL',
        listing_fee_amount: 0,
        sale_fee_amount: 17.16,
        free_relist: false,
        stop_time: '2046-08-08T00:00:00.000-04:00',
      },
    ]);

    const tipos = await buscarTiposAnuncioDisponiveis('token-fake', 156);

    expect(tipos).toEqual([
      { id: 'gold_pro', nome: 'Premium', taxaVendaPercentual: 16, taxaVendaValor: 24.96, exposicao: 'highest' },
      { id: 'gold_special', nome: 'Clássico', taxaVendaPercentual: 11, taxaVendaValor: 17.16, exposicao: 'highest' },
    ]);
  });
});

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
