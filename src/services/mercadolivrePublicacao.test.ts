import { describe, it, expect, vi } from 'vitest';

vi.mock('./mercadolivreApi.js', () => ({
  buscarCategoriasRaizML: vi.fn(),
  buscarCategoriaML: vi.fn(),
  buscarTiposAnuncioML: vi.fn(),
  buscarProdutosCatalogoML: vi.fn(),
}));

import { buscarCategoriasRaizML, buscarCategoriaML, buscarTiposAnuncioML, buscarProdutosCatalogoML } from './mercadolivreApi.js';
import {
  listarFilhosCategoria,
  buscarTiposAnuncioDisponiveis,
  buscarProdutosCatalogo,
  montarPayloadPublicacao,
  montarPayloadComFamilyName,
  extrairMensagemErroMl,
  pareceErroFamilyNameAusente,
} from './mercadolivrePublicacao.js';

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

  // Categorias de autopeças (ex: MLB240692 "Volante do Magneto", checado ao
  // vivo em GET /categories/MLB240692 — settings.shipping_options: ["custom"])
  // não aceitam o modo "me2" (Mercado Envios Fulfillment, requer contrato à
  // parte que a loja não tem — o frete real é calculado à parte via Melhor
  // Envio, ver src/features/frete). Mandar "me2" faz o Mercado Livre recusar
  // a criação do item inteiro com "body.required_fields". "not_specified" é
  // aceito por qualquer conta/categoria (ML mostra "a combinar" no anúncio),
  // e é o que já reflete o fluxo real: o frete é combinado/calculado fora do
  // anúncio, na venda.
  it('shipping sai como not_specified — "me2" não é aceito nas categorias de autopeças e exige contrato que a loja não tem', () => {
    const config = {
      categoriaMlId: 'MLB240692',
      condicaoMl: 'used' as const,
      listingTypeId: 'gold_special',
      atributos: [],
      fotos: ['capa.jpg'],
    };

    const resultado = montarPayloadPublicacao(item, [], config, 30);

    expect(resultado.payload.shipping).toEqual({ mode: 'not_specified' });
  });

  // Título do anúncio é editável pelo usuário no modal (não é mais sempre
  // item.nome) — o nome interno do estoque é otimizado pra busca no
  // catálogo, não pra converter comprador no Mercado Livre.
  it('com tituloAnuncio informado, usa ele (truncado em 60) no lugar do nome da peça', () => {
    const tituloAnuncio = 'Carenagem do lado esquerdo Honda CB 300R 2015 até 2020 original';
    const config = {
      categoriaMlId: 'MLB240692',
      condicaoMl: 'used' as const,
      listingTypeId: 'gold_special',
      atributos: [],
      fotos: ['capa.jpg'],
      tituloAnuncio,
    };

    const resultado = montarPayloadPublicacao(item, [], config, 30);

    expect(resultado.payload.title).toBe(tituloAnuncio.slice(0, 60));
    expect(resultado.payload.title).toHaveLength(60);
  });

  // Defesa em profundidade: montarPayloadPublicacao é reaproveitada dentro do
  // próprio publicarAnuncio (fallback de itens separados por ficha) e também
  // é chamada direto em teste — sem tituloAnuncio, mantém o comportamento de
  // antes (nome da peça) em vez de gerar um anúncio sem título.
  it('sem tituloAnuncio, cai no fallback do nome da peça (mesmo comportamento de antes)', () => {
    const config = {
      categoriaMlId: 'MLB240692',
      condicaoMl: 'used' as const,
      listingTypeId: 'gold_special',
      atributos: [],
      fotos: ['capa.jpg'],
    };

    const resultado = montarPayloadPublicacao(item, [], config, 30);

    expect(resultado.payload.title).toBe(item.nome.slice(0, 60));
  });
});

describe('extrairMensagemErroMl', () => {
  it('prioriza as mensagens de cause[] (detalhe real) sobre o message genérico do topo', () => {
    const data = {
      message: 'body.required_fields',
      error: 'bad_request',
      status: 400,
      cause: [{ code: 'item.attribute.missing_required', message: 'Falta o atributo BRAND' }],
    };

    expect(extrairMensagemErroMl(data)).toBe('Falta o atributo BRAND');
  });

  it('junta várias causas com "; " quando cause[] tem mais de um item', () => {
    const data = {
      message: 'body.required_fields',
      cause: [
        { code: 'a', message: 'Falta o atributo BRAND' },
        { code: 'b', message: 'Preço abaixo do mínimo' },
      ],
    };

    expect(extrairMensagemErroMl(data)).toBe('Falta o atributo BRAND; Preço abaixo do mínimo');
  });

  it('sem cause[] com mensagem, cai pro message do topo', () => {
    expect(extrairMensagemErroMl({ message: 'Invalid category_id' })).toBe('Invalid category_id');
  });

  it('sem data nenhum, retorna null', () => {
    expect(extrairMensagemErroMl(undefined)).toBeNull();
  });
});

describe('montarPayloadComFamilyName', () => {
  // No modelo de User Products, o título é gerado pelo próprio Mercado Livre
  // a partir de family_name + atributos — mandar os dois juntos é rejeitado
  // com "The fields [title] are invalid for requested call." (confirmado ao
  // vivo: a primeira versão deste fallback só acrescentava family_name e
  // mantinha o title original, causando esse erro).
  it('remove title do payload e acrescenta family_name', () => {
    const payload = { title: 'Carenagem CB 300R', category_id: 'MLB46593', price: 100 };

    const resultado = montarPayloadComFamilyName(payload, 'Carenagem CB 300R');

    expect(resultado).toEqual({ category_id: 'MLB46593', price: 100, family_name: 'Carenagem CB 300R' });
    expect(resultado).not.toHaveProperty('title');
  });

  it('preserva os demais campos do payload original, inclusive variations', () => {
    const payload = { title: 'Peça X', attributes: [{ id: 'BRAND', value_name: 'Honda' }], variations: [{ price: 50 }] };

    const resultado = montarPayloadComFamilyName(payload, 'Peça X');

    expect(resultado.attributes).toEqual([{ id: 'BRAND', value_name: 'Honda' }]);
    expect(resultado.variations).toEqual([{ price: 50 }]);
    expect(resultado.family_name).toBe('Peça X');
  });
});

describe('pareceErroFamilyNameAusente', () => {
  // Conta migrada pro modelo novo de User Products (Preço por Variação) —
  // rollout gradual da própria API, confirmado ao vivo tentando publicar
  // (ver "Publicar um item" em developers.mercadolivre.com.br/pt_br/preco-variacao):
  // o POST /items passa a exigir family_name pra itens sem variações nem
  // catalog_product_id, e recusa com esta mensagem em cause[].
  it('true quando a causa do erro cita family_name', () => {
    const err = {
      response: { data: { message: 'body.required_fields', cause: [{ message: 'The body does not contains some or none of the following properties [family_name]' }] } },
    };

    expect(pareceErroFamilyNameAusente(err)).toBe(true);
  });

  it('false pra outros erros de body.required_fields que não citam family_name', () => {
    const err = {
      response: { data: { message: 'body.required_fields', cause: [{ message: 'Falta o atributo BRAND' }] } },
    };

    expect(pareceErroFamilyNameAusente(err)).toBe(false);
  });

  it('false quando não há response.data (erro de rede, etc.)', () => {
    expect(pareceErroFamilyNameAusente(new Error('timeout'))).toBe(false);
  });
});
