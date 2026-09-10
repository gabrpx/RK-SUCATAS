import { describe, it, expect } from 'vitest';
import {
  agruparPorModelo,
  contarModelosFamilia,
  faixaPrecoFamilia,
  emEstoqueFamilia,
  variacoesFamilia,
  comAvariaFamilia,
  valorEmEstoqueFamilia,
  agruparLinhasTabela,
  filtrarLinhaTexto,
} from './familiaEstoque';
import type { Estoque, EstoqueFamilia, EstoqueUnidade } from './types';

function mockUnidade(overrides: Partial<EstoqueUnidade> = {}): EstoqueUnidade {
  return {
    id: 'u1',
    estoque_id: 'e1',
    nome: null,
    avaria: false,
    avaria_descricao: null,
    descricao: null,
    fotos: [],
    valor: null,
    condicao_nota: null,
    vendida_em: null,
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockItem(overrides: Partial<Estoque> = {}): Estoque {
  return {
    id: 'e1',
    codigo: 'RK-0001',
    nome: 'Tanque de Combustível',
    categoria_id: null,
    modelo_moto_id: 'm1',
    modelo_moto: { id: 'm1', nome: 'CG 125', parent_id: null, ordem: 0, ano: '2004-2008', criado_em: '2026-01-01T00:00:00Z' } as any,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-01-01T00:00:00Z',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    familia_id: 'f1',
    unidades: [],
    ...overrides,
  };
}

describe('agruparPorModelo', () => {
  it('returns an empty array for no items', () => {
    expect(agruparPorModelo([])).toEqual([]);
  });

  it('groups items with the same modelo_moto_id together', () => {
    const a = mockItem({ id: 'a' });
    const b = mockItem({ id: 'b' });
    const grupos = agruparPorModelo([a, b]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('sorts groups by starting year, oldest first', () => {
    const antigo = mockItem({
      id: 'antigo',
      modelo_moto_id: 'm-antigo',
      modelo_moto: { id: 'm-antigo', nome: 'CG 125 Titan 99', parent_id: null, ordem: 0, ano: '1999', criado_em: '' } as any,
    });
    const novo = mockItem({
      id: 'novo',
      modelo_moto_id: 'm-novo',
      modelo_moto: { id: 'm-novo', nome: 'CG 125 Fan', parent_id: null, ordem: 0, ano: '2009-2013', criado_em: '' } as any,
    });
    const grupos = agruparPorModelo([novo, antigo]);
    expect(grupos.map((g) => g.modeloMotoId)).toEqual(['m-antigo', 'm-novo']);
  });

  it('puts items with no modelo (null ano) last', () => {
    const semModelo = mockItem({ id: 'sem', modelo_moto_id: null, modelo_moto: null });
    const comModelo = mockItem({
      id: 'com',
      modelo_moto_id: 'm1',
      modelo_moto: { id: 'm1', nome: 'CG 125', parent_id: null, ordem: 0, ano: '2010', criado_em: '' } as any,
    });
    const grupos = agruparPorModelo([semModelo, comModelo]);
    expect(grupos.map((g) => g.modeloMotoId)).toEqual(['m1', null]);
  });
});

describe('contarModelosFamilia', () => {
  it('counts distinct modelo_moto_id, ignoring null', () => {
    const a = mockItem({ id: 'a', modelo_moto_id: 'm1' });
    const b = mockItem({ id: 'b', modelo_moto_id: 'm1' });
    const c = mockItem({ id: 'c', modelo_moto_id: 'm2' });
    const d = mockItem({ id: 'd', modelo_moto_id: null });
    expect(contarModelosFamilia([a, b, c, d])).toBe(2);
  });
});

describe('faixaPrecoFamilia', () => {
  it('returns null for an empty family', () => {
    expect(faixaPrecoFamilia([])).toBeNull();
  });

  it('returns the same min/max when every unit costs the same', () => {
    const item = mockItem({ valor: 480, quantidade: 2, unidades: [] });
    expect(faixaPrecoFamilia([item])).toEqual({ min: 480, max: 480 });
  });

  it('spans min/max across different fichas and unit-level overrides', () => {
    const barato = mockItem({ id: 'a', valor: 380, quantidade: 1, unidades: [] });
    const caro = mockItem({
      id: 'b',
      valor: 480,
      quantidade: 1,
      unidades: [mockUnidade({ id: 'u-cara', valor: 520 })],
    });
    expect(faixaPrecoFamilia([barato, caro])).toEqual({ min: 380, max: 520 });
  });
});

describe('emEstoqueFamilia', () => {
  it('sums quantidade across all fichas', () => {
    const a = mockItem({ id: 'a', quantidade: 2 });
    const b = mockItem({ id: 'b', quantidade: 3 });
    expect(emEstoqueFamilia([a, b])).toBe(5);
  });
});

describe('variacoesFamilia', () => {
  it('falls back to quantidade when unidades is not populated yet', () => {
    const item = mockItem({ quantidade: 4, unidades: undefined });
    expect(variacoesFamilia([item])).toBe(4);
  });

  it('counts unidades rows (including sold ones) when populated', () => {
    const item = mockItem({
      quantidade: 1,
      unidades: [mockUnidade({ id: 'u1' }), mockUnidade({ id: 'u2', vendida_em: '2026-01-01T00:00:00Z' })],
    });
    expect(variacoesFamilia([item])).toBe(2);
  });
});

describe('comAvariaFamilia', () => {
  it('sums avaria count across fichas, ignoring sold units', () => {
    const item = mockItem({
      unidades: [
        mockUnidade({ id: 'u1', avaria: true }),
        mockUnidade({ id: 'u2', avaria: true, vendida_em: '2026-01-01T00:00:00Z' }),
      ],
    });
    expect(comAvariaFamilia([item])).toBe(1);
  });
});

describe('valorEmEstoqueFamilia', () => {
  it('sums valorTotalItem across fichas', () => {
    const a = mockItem({ id: 'a', valor: 100, quantidade: 1, unidades: [] });
    const b = mockItem({ id: 'b', valor: 200, quantidade: 1, unidades: [] });
    expect(valorEmEstoqueFamilia([a, b])).toBe(300);
  });
});

const mockFamilia = (overrides: Partial<EstoqueFamilia> = {}): EstoqueFamilia => ({
  id: 'f1',
  nome: 'Tanque de Combustível CG 150',
  categoria_id: null,
  descricao: null,
  imagem_url: null,
  criado_em: '2026-01-01T00:00:00Z',
  atualizado_em: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('agruparLinhasTabela', () => {
  it('returns a familia line for items sharing familia_id', () => {
    const f = mockFamilia();
    const a = mockItem({ id: 'a', familia_id: 'f1', familia: f });
    const b = mockItem({ id: 'b', familia_id: 'f1', familia: f });
    const c = mockItem({ id: 'c', familia_id: 'f1', familia: f });
    const linhas = agruparLinhasTabela([a, b, c]);
    expect(linhas).toHaveLength(1);
    const linha = linhas[0];
    expect(linha.tipo).toBe('familia');
    if (linha.tipo === 'familia') {
      expect(linha.itens).toHaveLength(3);
      expect(linha.familia.id).toBe('f1');
    }
  });

  it('returns an avulso line for item without familia_id', () => {
    const item = mockItem({ familia_id: null, familia: null });
    const linhas = agruparLinhasTabela([item]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].tipo).toBe('avulso');
    if (linhas[0].tipo === 'avulso') expect(linhas[0].item.id).toBe('e1');
  });

  it('mixes familia and avulso lines preserving input order', () => {
    const f = mockFamilia();
    const filho = mockItem({ id: 'filho', familia_id: 'f1', familia: f });
    const avulso = mockItem({ id: 'avulso', familia_id: null, familia: null });
    const linhas = agruparLinhasTabela([filho, avulso]);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.tipo)).toEqual(['familia', 'avulso']);
  });

  it('groups items with the same familia_id into one line', () => {
    const f = mockFamilia();
    const carburada = mockItem({ id: 'carb', familia_id: 'f1', familia: f,
      modelo_moto_id: 'm1',
      modelo_moto: { id: 'm1', nome: 'CG 150 Carburada', parent_id: null, ordem: 0, ano: '2004', criado_em: '' } as any });
    const injetada = mockItem({ id: 'inj', familia_id: 'f1', familia: f,
      modelo_moto_id: 'm2',
      modelo_moto: { id: 'm2', nome: 'CG 150 Injetada', parent_id: null, ordem: 0, ano: '2013', criado_em: '' } as any });
    const avulso = mockItem({ id: 'av', familia_id: null, familia: null, nome: 'Freio' });
    const linhas = agruparLinhasTabela([carburada, injetada, avulso]);
    expect(linhas).toHaveLength(2);
    const familiaLinha = linhas[0];
    expect(familiaLinha.tipo).toBe('familia');
    if (familiaLinha.tipo === 'familia') expect(familiaLinha.itens).toHaveLength(2);
  });

  it('assigns stable ids for deduplication', () => {
    const f = mockFamilia();
    const a = mockItem({ id: 'a', familia_id: 'f1', familia: f });
    const b = mockItem({ id: 'b', familia_id: 'f1', familia: f });
    const linhas = agruparLinhasTabela([a, b]);
    expect(linhas[0].id).toBe('familia-f1');
  });
});

describe('filtrarLinhaTexto', () => {
  it('matches avulso line by item name', () => {
    const linha = { tipo: 'avulso' as const, id: 'a', item: mockItem({ nome: 'Tanque de Combustível' }) };
    expect(filtrarLinhaTexto(linha, ['tanque'])).toBe(true);
    expect(filtrarLinhaTexto(linha, ['freio'])).toBe(false);
  });

  it('returns true when terms is empty', () => {
    const linha = { tipo: 'avulso' as const, id: 'a', item: mockItem() };
    expect(filtrarLinhaTexto(linha, [])).toBe(true);
  });

  it('matches familia line when ANY child item matches', () => {
    const f = mockFamilia();
    const carb = mockItem({ id: 'c', familia_id: 'f1', familia: f,
      nome: 'Tanque CG 150 Carburada',
      modelo_moto: { id: 'm1', nome: 'CG 150 Carburada', parent_id: null, ordem: 0, ano: '2004', criado_em: '' } as any });
    const titan = mockItem({ id: 't', familia_id: 'f1', familia: f,
      nome: 'Tanque CG 150 Titan',
      modelo_moto: { id: 'm2', nome: 'CG 150 Titan 99', parent_id: null, ordem: 0, ano: '1999', criado_em: '' } as any });
    const linha = { tipo: 'familia' as const, id: 'familia-f1', familia: f, itens: [carb, titan] };
    expect(filtrarLinhaTexto(linha, ['titan'])).toBe(true);
    expect(filtrarLinhaTexto(linha, ['freio'])).toBe(false);
  });

  it('requires ALL terms to match (across any child)', () => {
    const f = mockFamilia();
    const item = mockItem({ id: 'x', familia_id: 'f1', familia: f,
      nome: 'Tanque CG 150',
      modelo_moto: { id: 'm1', nome: 'CG 150 Carburada', parent_id: null, ordem: 0, ano: '2004', criado_em: '' } as any });
    const linha = { tipo: 'familia' as const, id: 'familia-f1', familia: f, itens: [item] };
    expect(filtrarLinhaTexto(linha, ['tanque', 'cg'])).toBe(true);
    expect(filtrarLinhaTexto(linha, ['tanque', 'freio'])).toBe(false);
  });

  it('matches by modelo_moto name in familia child', () => {
    const f = mockFamilia({ nome: 'Tanque' });
    const item = mockItem({ id: 'x', familia_id: 'f1', familia: f, nome: 'Tanque',
      modelo_moto: { id: 'm1', nome: 'Titan 99', parent_id: null, ordem: 0, ano: '1999', criado_em: '' } as any });
    const linha = { tipo: 'familia' as const, id: 'familia-f1', familia: f, itens: [item] };
    expect(filtrarLinhaTexto(linha, ['titan'])).toBe(true);
  });
});
