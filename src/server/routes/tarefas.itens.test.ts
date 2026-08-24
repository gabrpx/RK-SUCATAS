import { describe, it, expect } from 'vitest';
import { normalizarItens } from './tarefas';

describe('normalizarItens', () => {
  it('retorna [] quando não é array', () => {
    expect(normalizarItens(undefined)).toEqual([]);
    expect(normalizarItens(null)).toEqual([]);
    expect(normalizarItens('x')).toEqual([]);
  });
  it('descarta textos vazios/só-espaço e faz trim', () => {
    expect(normalizarItens([{ texto: '  Postar  ' }, { texto: '   ' }, { texto: '' }])).toEqual([{ texto: 'Postar' }]);
  });
  it('preserva id quando presente', () => {
    expect(normalizarItens([{ id: 'a', texto: 'X' }, { texto: 'Y' }])).toEqual([{ id: 'a', texto: 'X' }, { texto: 'Y' }]);
  });
});
