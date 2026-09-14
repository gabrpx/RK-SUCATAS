import { describe, it, expect } from 'vitest';
import { classificarAtributos } from './EstoquePublicarMlModal';
import type { AtributoMl } from './types';

function atributo(parcial: Partial<AtributoMl> & Pick<AtributoMl, 'id' | 'name'>): AtributoMl {
  return { value_type: 'string', tags: {}, ...parcial };
}

describe('classificarAtributos', () => {
  it('mantém atributo obrigatório em "principais" mesmo quando a API marca tags.hidden', () => {
    const marca = atributo({ id: 'BRAND', name: 'Marca', tags: { required: true, hidden: true } });

    const { principais } = classificarAtributos([marca]);

    expect(principais).toEqual([marca]);
  });

  it('atributo opcional sem tags.hidden vai pra "principais" (é específico da peça, não genérico)', () => {
    const posicao = atributo({ id: 'VEHICLE_PARTS_POSITION', name: 'Posição', tags: { allow_variations: true } });

    const { principais, secundarios } = classificarAtributos([posicao]);

    expect(principais).toEqual([posicao]);
    expect(secundarios).toEqual([]);
  });

  it('agrupa atributo opcional com tags.hidden em "secundarios", fora do topo do formulário', () => {
    const voltagem = atributo({ id: 'VOLTAGE', name: 'Voltagem', tags: { hidden: true } });

    const { principais, secundarios } = classificarAtributos([voltagem]);

    expect(principais).toEqual([]);
    expect(secundarios).toEqual([voltagem]);
  });

  it('exclui atributo tags.read_only inteiramente — a API nunca aceitaria esse valor de volta', () => {
    const chaveSat = atributo({ id: 'SAT_KEY', name: 'Chave do produto', tags: { hidden: true, read_only: true } });

    const { principais, secundarios } = classificarAtributos([chaveSat]);

    expect(principais).toEqual([]);
    expect(secundarios).toEqual([]);
  });

  // Recortes reais de GET /categories/{id}/attributes, capturados ao vivo (sem
  // token — são endpoints públicos) pra 2 categorias bem diferentes, provando
  // que a filtragem generaliza por metadado e não por uma lista de nomes:
  // MLB22645 "Faróis Traseiros" (peça de carro) e MLB46593 "Carenagem"
  // (peça de moto, mesmo domínio da peça de teste do usuário). Os mesmos
  // atributos genéricos que o usuário reportou (Voltagem, IVA para revenda,
  // IEPS, alimentos e bebidas, medicamentos, características químicas,
  // origem do dado da embalagem) aparecem nas duas com tags.hidden=true.
  it('generaliza pra categoria de peça de moto (Carenagem, MLB46593) sem depender de nomes fixos', () => {
    const atributosCarenagemMoto: AtributoMl[] = [
      atributo({ id: 'BRAND', name: 'Marca', tags: { catalog_required: true, required: true } }),
      atributo({ id: 'PART_NUMBER', name: 'Número de peça', tags: { catalog_required: true, required: true } }),
      atributo({ id: 'COLOR', name: 'Cor', tags: { allow_variations: true, defines_picture: true } }),
      atributo({ id: 'ORIGIN', name: 'Origem', tags: {} }),
      atributo({ id: 'PACKAGE_HEIGHT', name: 'Altura da embalagem', tags: { hidden: true, read_only: true, variation_attribute: true } }),
      atributo({ id: 'IVA_FOR_RESALE', name: 'IVA para revenda', tags: { hidden: true, read_only: true } }),
      atributo({ id: 'IEPS', name: 'IEPS', tags: { hidden: true, read_only: true } }),
      atributo({ id: 'FOODS_AND_DRINKS', name: 'Alimentos e bebidas', tags: { hidden: true, multivalued: true, read_only: true } }),
      atributo({ id: 'MEDICINES', name: 'Medicamentos', tags: { hidden: true, multivalued: true, read_only: true } }),
      atributo({ id: 'PRODUCT_CHEMICAL_FEATURES', name: 'Características químicas do produto', tags: { hidden: true, multivalued: true, read_only: true } }),
      atributo({ id: 'SELLER_PACKAGE_DATA_SOURCE', name: 'Origem do dado do pacote de envio', tags: { hidden: true, read_only: true } }),
      atributo({ id: 'VOLTAGE', name: 'Voltagem', tags: { hidden: true } }),
    ];

    const { principais, secundarios } = classificarAtributos(atributosCarenagemMoto);

    expect(principais.map((a) => a.id)).toEqual(['BRAND', 'PART_NUMBER', 'COLOR', 'ORIGIN']);
    expect(secundarios.map((a) => a.id)).toEqual(['VOLTAGE']);
    // Tudo com tags.read_only some dos dois grupos — inclui todos os campos
    // fiscais/logísticos que o usuário reportou, exceto Voltagem (editável,
    // só não é read_only, por isso some pra "secundarios" e não desaparece).
    const idsReadOnlyDoRelato = ['IVA_FOR_RESALE', 'IEPS', 'FOODS_AND_DRINKS', 'MEDICINES', 'PRODUCT_CHEMICAL_FEATURES', 'SELLER_PACKAGE_DATA_SOURCE'];
    for (const id of idsReadOnlyDoRelato) {
      expect(principais.some((a) => a.id === id)).toBe(false);
      expect(secundarios.some((a) => a.id === id)).toBe(false);
    }
  });
});
