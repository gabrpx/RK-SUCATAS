import { describe, expect, it } from 'vitest';
import { formatarNomeModeloMoto, obterNomeVariacaoModelo } from './nomeModelo';
import type { ModeloMoto } from '../../types/catalog';

const modelo = (id: string, nome: string, parent_id: string | null, ano: string | null = null): ModeloMoto => ({
  id,
  nome,
  parent_id,
  ano,
  ordem: 0,
  imagem_url: null,
});

describe('nomeModelo', () => {
  it('apresenta a variação sem repetir os níveis da árvore', () => {
    const modelos = [
      modelo('honda', 'Honda', null),
      modelo('cilindrada', '125', 'honda'),
      modelo('cg125', 'CG 125', 'cilindrada'),
      modelo('moto', 'CG 125 Titan 99', 'cg125', '1995 a 1999'),
    ];

    expect(formatarNomeModeloMoto(modelos[2], modelos)).toBe('Honda CG 125');
    expect(formatarNomeModeloMoto(modelos[3], modelos)).toBe('Honda CG 125 Titan 99 · 1995 a 1999');
    expect(obterNomeVariacaoModelo(modelos[3], modelos)).toBe('Titan');
    expect(modelos[3].nome).toBe('CG 125 Titan 99');
  });

  it('extrai a variação cadastrada para qualquer marca sem regra fixa', () => {
    const modelos = [
      modelo('dafra', 'Dafra', null),
      modelo('150', '150', 'dafra'),
      modelo('modelo', 'Kansas', '150', '2008 a 2015'),
    ];

    expect(formatarNomeModeloMoto(modelos[2], modelos)).toBe('Dafra Kansas · 2008 a 2015');
    expect(obterNomeVariacaoModelo(modelos[2], modelos)).toBe('Kansas');
  });

  it('não inventa uma variação quando o modelo é genérico', () => {
    const modelos = [modelo('honda', 'Honda', null), modelo('fan', 'Fan 160', 'honda', '2016+')];

    expect(formatarNomeModeloMoto(modelos[1], modelos)).toBe('Honda Fan 160 · 2016+');
    expect(obterNomeVariacaoModelo(modelos[1], modelos)).toBeNull();
  });
});
