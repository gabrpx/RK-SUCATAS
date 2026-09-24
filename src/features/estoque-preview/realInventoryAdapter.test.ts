import { describe, expect, it } from "vitest";
import { adaptarEstoqueReal } from "./realInventoryAdapter";

describe("adaptarEstoqueReal", () => {
  it("expande quantidade em unidades sem inventar endereço físico", () => {
    const result = adaptarEstoqueReal(
      [{
        id: "item-1",
        codigo: "RK-001",
        nome: "Carenagem CG",
        categoria_id: "cat-1",
        categoria: null,
        modelo_moto_id: "moto-1",
        modelo_moto: { id: "moto-1", nome: "CG 150", parent_id: null, ordem: 1, ano: "2009-2013", imagem_url: null },
        modelos_compativeis: [],
        condicao: "original",
        condicao_nota: 8,
        nota_cadastro: null,
        ano: null,
        valor: 120,
        quantidade: 2,
        imagens: ["https://example.com/capa.jpg"],
        descricao: "Peça de teste",
        ativo: true,
        criado_em: "2026-01-01",
        atualizado_em: "2026-01-01",
        anuncio_ml_url: null,
        anuncio_fb_url: null,
        componentes: null,
        unidades_incompletas: [],
      }],
      [{ id: "cat-1", nome: "Carenagem", parent_id: null, ordem: 1 }]
    );

    expect(result.pecas).toHaveLength(1);
    expect(result.unidades).toHaveLength(2);
    expect(result.unidades.map((unit) => unit.sku)).toEqual(["RK-001-01", "RK-001-02"]);
    expect(result.unidades.every((unit) => unit.endereco === null)).toBe(true);
    expect(result.unidades[0].fotoUrl).toBeNull();
    expect(result.unidades.every((unit) => unit.individualizada === false)).toBe(true);
    expect(result.unidades[0].origem).toBeNull();
    expect(result.categoriasPorSecao).toEqual({});
    expect(result.categorias.map((categoria) => categoria.nome)).toContain("Carenagem");
  });

  it("preserva a ficha real da unidade e não duplica uma unidade vendida", () => {
    const result = adaptarEstoqueReal(
      [{
        id: "item-2",
        codigo: "RK-002",
        nome: "Escapamento",
        categoria_id: null,
        categoria: null,
        modelo_moto_id: null,
        modelo_moto: null,
        modelos_compativeis: [],
        gaveta_id: "gav-1",
        gaveta: { id: "gav-1", nome: "Escapamentos", categoria_id: null, icone: null, criado_em: "2026-01-01", atualizado_em: "2026-01-01" },
        condicao: "original",
        condicao_nota: 4,
        nota_cadastro: null,
        ano: null,
        valor: 300,
        quantidade: 1,
        imagens: ["https://example.com/produto.jpg"],
        descricao: null,
        ativo: true,
        criado_em: "2026-01-01",
        atualizado_em: "2026-01-01",
        anuncio_ml_url: null,
        anuncio_fb_url: null,
        componentes: null,
        unidades_incompletas: [],
        unidades: [{ id: "unit-1", estoque_id: "item-2", sku: 77, nome: "Com detalhe", avaria: true, avaria_descricao: "Risco", descricao: null, fotos: ["https://example.com/unidade-1.jpg", "https://example.com/unidade-2.jpg"], valor: 250, condicao_nota: 4, vendida_em: null, criado_em: "2026-01-01", atualizado_em: "2026-01-01" }],
      }],
      [], [], [], [{ id: "res-1", unidade_id: "unit-1", responsavel: "Cliente", reservada_ate: "2026-10-01T12:00:00Z", criada_em: "2026-09-22T12:00:00Z" }]
    );

    expect(result.unidades).toHaveLength(1);
    expect(result.unidades[0]).toMatchObject({ id: "unit-1", sku: "77", preco: 250, grau: "C", estado: "reservada", individualizada: true, reservaId: "res-1", reservadaPara: "Cliente" });
    expect(result.unidades[0].detalhes).toContain("Com detalhe");
    expect(result.unidades[0]).toMatchObject({
      fotoUrl: "https://example.com/unidade-1.jpg",
      fotos: ["https://example.com/unidade-1.jpg", "https://example.com/unidade-2.jpg"],
    });
    expect(result.pecas[0].fotos).toEqual(["https://example.com/produto.jpg"]);
    expect(result.pecas[0].detalhes).toContain("Gaveta atual: Escapamentos");
  });

  it("mostra o nome do cliente cadastrado vinculado à reserva", () => {
    const item = {
      id: "item-3", codigo: "RK-003", nome: "Farol", categoria_id: null, categoria: null, modelo_moto_id: null, modelo_moto: null,
      modelos_compativeis: [], condicao: "original", condicao_nota: 6, nota_cadastro: null, ano: null, valor: 90, quantidade: 1,
      imagens: [], descricao: null, ativo: true, criado_em: "2026-01-01", atualizado_em: "2026-01-01", anuncio_ml_url: null,
      anuncio_fb_url: null, componentes: null, unidades_incompletas: [],
      unidades: [{ id: "unit-3", estoque_id: "item-3", sku: 5, nome: null, avaria: false, avaria_descricao: null, descricao: null, fotos: [], valor: null, condicao_nota: null, vendida_em: null, criado_em: "2026-01-01", atualizado_em: "2026-01-01" }],
    } as unknown as Parameters<typeof adaptarEstoqueReal>[0][number];
    const result = adaptarEstoqueReal([item], [], [], [], [{
      id: "res-3", unidade_id: "unit-3", responsavel: "Nome antigo", reservada_ate: "2026-10-01T12:00:00Z", criada_em: "2026-09-22T12:00:00Z",
      cliente_id: "cli-1", cliente: { id: "cli-1", nome: "Maria Cadastro", telefone: "(83) 99999-0000" },
    }]);
    expect(result.unidades[0]).toMatchObject({ estado: "reservada", reservadaPara: "Maria Cadastro", reservaClienteId: "cli-1", reservaTelefone: "(83) 99999-0000" });
  });
});
