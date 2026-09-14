import { describe, it, expect } from 'vitest';
import { derivarAutopreenchimentoAtributos } from './autopreencherAtributosMl';
import type { AtributoMl } from './types';
import type { ModeloMoto } from '../../types/catalog';

function atributo(parcial: Partial<AtributoMl> & Pick<AtributoMl, 'id' | 'name'>): AtributoMl {
  return { value_type: 'string', tags: {}, ...parcial };
}

// Árvore mínima: Honda (raiz) > 150 (cilindrada) > Bros NXR 150 (modelo).
const modelos: ModeloMoto[] = [
  { id: 'honda', nome: 'Honda', parent_id: null, ordem: 0, ano: null, imagem_url: null },
  { id: '150', nome: '150', parent_id: 'honda', ordem: 0, ano: null, imagem_url: null },
  { id: 'bros', nome: 'Bros NXR 150', parent_id: '150', ordem: 0, ano: null, imagem_url: null },
];

describe('derivarAutopreenchimentoAtributos', () => {
  it('preenche BRAND com a raiz da árvore de modelo (marca), via getAncestorChain', () => {
    const atributos = [atributo({ id: 'BRAND', name: 'Marca' })];
    const item = { modelo_moto_id: 'bros', modelo_moto: { id: 'bros', nome: 'Bros NXR 150', parent_id: '150', ordem: 0, ano: null, imagem_url: null } };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.BRAND).toEqual({ id: 'BRAND', value_name: 'Honda' });
  });

  it('preenche o atributo de marca por nome quando o id não é BRAND (categoria pode variar)', () => {
    const atributos = [atributo({ id: 'MARCA_CUSTOM_ID', name: 'Marca' })];
    const item = { modelo_moto_id: 'bros', modelo_moto: { id: 'bros', nome: 'Bros NXR 150', parent_id: '150', ordem: 0, ano: null, imagem_url: null } };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.MARCA_CUSTOM_ID).toEqual({ id: 'MARCA_CUSTOM_ID', value_name: 'Honda' });
  });

  it('BRAND como lista (value_type list) só preenche se achar o value_id correspondente ao nome da marca', () => {
    const atributos = [
      atributo({
        id: 'BRAND',
        name: 'Marca',
        value_type: 'list',
        values: [
          { id: '9344', name: 'Honda' },
          { id: '9345', name: 'Yamaha' },
        ],
      }),
    ];
    const item = { modelo_moto_id: 'bros', modelo_moto: { id: 'bros', nome: 'Bros NXR 150', parent_id: '150', ordem: 0, ano: null, imagem_url: null } };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.BRAND).toEqual({ id: 'BRAND', value_id: '9344', value_name: 'Honda' });
  });

  it('BRAND como lista sem a marca no catálogo de valores não preenche nada (não força um valor errado)', () => {
    const atributos = [
      atributo({
        id: 'BRAND',
        name: 'Marca',
        value_type: 'list',
        values: [{ id: '1', name: 'Genérica' }],
      }),
    ];
    const item = { modelo_moto_id: 'bros', modelo_moto: { id: 'bros', nome: 'Bros NXR 150', parent_id: '150', ordem: 0, ano: null, imagem_url: null } };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.BRAND).toBeUndefined();
  });

  it('item sem modelo_moto_id não preenche marca (no-op, não quebra)', () => {
    const atributos = [atributo({ id: 'BRAND', name: 'Marca' })];
    const item = { modelo_moto_id: null, modelo_moto: null };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.BRAND).toBeUndefined();
  });

  it('modelo_moto_id preenchido mas ausente da árvore (cadeia vazia) não preenche marca', () => {
    const atributos = [atributo({ id: 'BRAND', name: 'Marca' })];
    const item = { modelo_moto_id: 'id-que-nao-existe', modelo_moto: null };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.BRAND).toBeUndefined();
  });

  it('preenche PART_NUMBER com o nome da moto vinculada (item.modelo_moto.nome), por pedido explícito do usuário', () => {
    const atributos = [atributo({ id: 'PART_NUMBER', name: 'Número de peça' })];
    const item = { modelo_moto_id: 'bros', modelo_moto: { id: 'bros', nome: 'Bros NXR 150', parent_id: '150', ordem: 0, ano: null, imagem_url: null } };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.PART_NUMBER).toEqual({ id: 'PART_NUMBER', value_name: 'Bros NXR 150' });
  });

  it('sem item.modelo_moto (mesmo com modelo_moto_id), não preenche número de peça', () => {
    const atributos = [atributo({ id: 'PART_NUMBER', name: 'Número de peça' })];
    const item = { modelo_moto_id: 'bros', modelo_moto: null };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.PART_NUMBER).toBeUndefined();
  });

  it('preenche VEHICLE_TYPE buscando o value cujo nome normalizado contém "moto" (cobre variações como "Moto e Quadriciclo")', () => {
    const atributos = [
      atributo({
        id: 'VEHICLE_TYPE',
        name: 'Tipo de veículo',
        value_type: 'list',
        values: [
          { id: '1', name: 'Carro e Camioneta' },
          { id: '2', name: 'Moto e Quadriciclo' },
        ],
      }),
    ];
    const item = { modelo_moto_id: null, modelo_moto: null };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado.VEHICLE_TYPE).toEqual({ id: 'VEHICLE_TYPE', value_id: '2', value_name: 'Moto e Quadriciclo' });
  });

  it('categoria sem nenhum dos 3 atributos retorna objeto vazio, sem quebrar', () => {
    const atributos = [atributo({ id: 'COLOR', name: 'Cor' })];
    const item = { modelo_moto_id: 'bros', modelo_moto: { id: 'bros', nome: 'Bros NXR 150', parent_id: '150', ordem: 0, ano: null, imagem_url: null } };

    const resultado = derivarAutopreenchimentoAtributos(atributos, item, modelos);

    expect(resultado).toEqual({});
  });
});
