import { describe, it, expect } from 'vitest';
import { formatPhoneBr, stripPhone } from './phone-br';

describe('phone-br', () => {
  it('formata celular com DDD (11 dígitos)', () => {
    expect(formatPhoneBr('83999999999')).toBe('(83) 9 9999-9999');
  });
  it('formata fixo com DDD (10 dígitos)', () => {
    expect(formatPhoneBr('8332221111')).toBe('(83) 3222-1111');
  });
  it('formata parcial', () => {
    expect(formatPhoneBr('83')).toBe('(83');
    expect(formatPhoneBr('839')).toBe('(83) 9');
    expect(formatPhoneBr('83999')).toBe('(83) 9 99');
  });
  it('strip remove tudo que não é dígito', () => {
    expect(stripPhone('(83) 9 9999-9999')).toBe('83999999999');
  });
});
