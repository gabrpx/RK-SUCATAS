import { describe, it, expect } from 'vitest';
import { formatarCidade } from './formatarCidade';

describe('formatarCidade', () => {
  it('formata cidade + UF', () => {
    expect(formatarCidade({ estado: 'PB', cidade: 'Juazeirinho' })).toBe('Juazeirinho, PB');
  });
  it('vazio quando sem cidade', () => {
    expect(formatarCidade({ estado: 'PB', cidade: '' })).toBe('');
  });
  it('vazio quando sem UF', () => {
    expect(formatarCidade({ estado: '', cidade: 'Juazeirinho' })).toBe('Juazeirinho');
  });
});
