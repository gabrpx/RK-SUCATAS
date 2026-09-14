import { describe, expect, it } from 'vitest';
import { formatarNomeModeloMoto } from './nomeModelo';
import type { ModeloMoto } from '../../types/catalog';

const modelo = (id: string, nome: string, parent_id: string | null, ano: string | null = null): ModeloMoto => ({
  id,
  nome,
  parent_id,
  ano,
  ordem: 0,
  imagem_url: null,
});

describe('formatarNomeModeloMoto', () => {
  it('apresenta Titan para CG 125 entre 1995 e 1999 sem alterar o catálogo', () => {
    const modelos = [
      modelo('honda', 'Honda', null),
      modelo('cg125', 'CG 125', 'honda'),
      modelo('moto', 'CG 125', 'cg125', '1995 a 1999'),
    ];

    expect(formatarNomeModeloMoto(modelos[2], modelos)).toBe('Honda CG 125 Titan · 1995 a 1999');
    expect(modelos[2].nome).toBe('CG 125');
  });

  it('identifica a CG 150 carburada pelo período conhecido', () => {
    const modelos = [
      modelo('honda', 'Honda', null),
      modelo('cg150', 'CG 150', 'honda'),
      modelo('moto', 'CG 150', 'cg150', '2004 a 2008'),
    ];

    expect(formatarNomeModeloMoto(modelos[2], modelos)).toBe('Honda CG 150 Carburada · 2004 a 2008');
  });

  it('preserva o caminho oficial quando não existe uma regra segura', () => {
    const modelos = [modelo('honda', 'Honda', null), modelo('fan', 'Fan 160', 'honda', '2016+')];

    expect(formatarNomeModeloMoto(modelos[1], modelos)).toBe('Honda Fan 160 · 2016+');
  });
});
