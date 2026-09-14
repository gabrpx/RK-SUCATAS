import { describe, expect, it } from 'vitest';
import { fotosEfetivasDaUnidade } from './fotosUnidade';

describe('fotosEfetivasDaUnidade', () => {
  it('usa as fotos antigas quando a ficha ainda está sem fotos', () => {
    expect(fotosEfetivasDaUnidade({ fotos: [] }, ['roda-a.jpg', 'roda-b.jpg'])).toEqual(['roda-a.jpg', 'roda-b.jpg']);
  });

  it('preserva fotos próprias e não substitui o cadastro específico da unidade', () => {
    expect(fotosEfetivasDaUnidade({ fotos: ['unidade.jpg'] }, ['legada.jpg'])).toEqual(['unidade.jpg']);
  });
});
