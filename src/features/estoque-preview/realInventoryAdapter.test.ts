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
        imagens: [],
        descricao: null,
        ativo: true,
        criado_em: "2026-01-01",
        atualizado_em: "2026-01-01",
        anuncio_ml_url: null,
        anuncio_fb_url: null,
        componentes: null,
        unidades_incompletas: [],
        unidades: [{ id: "unit-1", estoque_id: "item-2", sku: 77, nome: "Com detalhe", avaria: true, avaria_descricao: "Risco", descricao: null, fotos: [], valor: 250, condicao_nota: 4, vendida_em: null, criado_em: "2026-01-01", atualizado_em: "2026-01-01" }],
      }],
      []
    );

    expect(result.unidades).toHaveLength(1);
    expect(result.unidades[0]).toMatchObject({ id: "unit-1", sku: "77", preco: 250, grau: "C", estado: "organizar" });
    expect(result.unidades[0].detalhes).toContain("Com detalhe");
    expect(result.pecas[0].detalhes).toContain("Gaveta atual: Escapamentos");
  });
});
