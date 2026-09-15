import { describe, expect, it } from 'vitest';
import { fotosEfetivasDaUnidade } from './fotosUnidade';

describe('fotosEfetivasDaUnidade', () => {
  it('não atribui fotos legadas a uma ficha sem fotos próprias', () => {
    expect(fotosEfetivasDaUnidade({ fotos: [] }, ['roda-a.jpg', 'roda-b.jpg'])).toEqual([]);
  });

  it('preserva fotos próprias e não substitui o cadastro específico da unidade', () => {
    expect(fotosEfetivasDaUnidade({ fotos: ['unidade.jpg'] }, ['legada.jpg'])).toEqual(['unidade.jpg']);
  });
});
