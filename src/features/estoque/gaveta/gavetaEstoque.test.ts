import { describe, it, expect } from 'vitest';
import { agruparPorGaveta, faixaPrecoVariante, faixaPrecoGaveta, statsGaveta } from './gavetaEstoque';
import type { Estoque, Gaveta } from '../types';

const gaveta = (id: string, nome: string): Gaveta =>
  ({ id, nome, categoria_id: null, icone: null, criado_em: '', atualizado_em: '' });

const peca = (over: Partial<Estoque>): Estoque =>
  ({ id: 'p', codigo: '', nome: '', categoria_id: null, modelo_moto_id: null, condicao: 'original',
     condicao_nota: null, nota_cadastro: null, ano: null, valor: 100, quantidade: 1, imagens: [],
     descricao: null, ativo: true, criado_em: '', atualizado_em: '', anuncio_ml_url: null,
     anuncio_fb_url: null, componentes: null, unidades_incompletas: [], ...over } as Estoque);

type UnidadeEstoque = NonNullable<Estoque['unidades']>[number];

const un = (over: Partial<UnidadeEstoque> = {}): UnidadeEstoque =>
  ({ id: 'u', estoque_id: 'p', nome: null, descricao: null, avaria: false, avaria_descricao: null,
     fotos: [], valor: null, condicao_nota: null, criado_em: '', atualizado_em: '', ...over } as UnidadeEstoque);

describe('agruparPorGaveta', () => {
  it('separa peças por gaveta e junta as sem gaveta em "não agrupado" no fim', () => {
    const g1 = gaveta('g1', 'Tanque CG 125');
    const itens = [
      peca({ id: 'a', gaveta_id: 'g1' }),
      peca({ id: 'b', gaveta_id: null }),
    ];
    const linhas = agruparPorGaveta(itens, [g1]);
    expect(linhas[0]).toMatchObject({ tipo: 'gaveta', id: 'g1' });
    expect(linhas[0].itens.map((i) => i.id)).toEqual(['a']);
    const naoAgrupado = linhas.find((l) => l.tipo === 'nao-agrupado');
    expect(naoAgrupado?.itens.map((i) => i.id)).toEqual(['b']);
  });

  it('inclui gaveta vazia e omite "não agrupado" quando tudo tem gaveta', () => {
    const g1 = gaveta('g1', 'Vazia');
    const linhas = agruparPorGaveta([peca({ id: 'a', gaveta_id: 'g1' })], [g1, gaveta('g2', 'Sem itens')]);
    expect(linhas.filter((l) => l.tipo === 'gaveta')).toHaveLength(2);
    expect(linhas.some((l) => l.tipo === 'nao-agrupado')).toBe(false);
  });
});

describe('faixaPrecoVariante', () => {
  it('usa min~max das unidades disponíveis, herdando o valor da peça quando null', () => {
    const item = peca({ valor: 100, quantidade: 2, unidades: [un({ id: 'u1', valor: 80 }), un({ id: 'u2', valor: null })] });
    expect(faixaPrecoVariante(item)).toEqual({ min: 80, max: 100 });
  });

  it('ignora unidades vendidas', () => {
    // quantidade já exclui unidades vendidas (decrementado em registrar_venda);
    // veja familiaEstoque.ts linhas 63, 74-76 que prova isso.
    const item = peca({ valor: 100, quantidade: 1, unidades: [un({ id: 'u1', valor: 80, vendida_em: '2026-01-01' }), un({ id: 'u2', valor: 120 })] });
    expect(faixaPrecoVariante(item)).toEqual({ min: 120, max: 120 });
  });
});

describe('statsGaveta', () => {
  it('conta variantes, unidades disponíveis e soma valor', () => {
    const itens = [
      peca({ id: 'a', valor: 100, quantidade: 1, unidades: [un({ id: 'u1', valor: 100 })] }),
      peca({ id: 'b', valor: 50, quantidade: 2, unidades: [un({ id: 'u2', valor: 50 }), un({ id: 'u3', valor: 60 })] }),
    ];
    const s = statsGaveta(itens);
    expect(s.variantes).toBe(2);
    expect(s.unidadesDisponiveis).toBe(3);
    expect(s.faixa).toEqual({ min: 50, max: 100 });
  });
});
