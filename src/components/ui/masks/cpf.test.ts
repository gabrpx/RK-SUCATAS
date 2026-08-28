import { describe, it, expect } from 'vitest';
import { formatCpf, stripCpf, isValidCpf } from './cpf';

describe('cpf', () => {
  it('formata 11 dígitos', () => {
    expect(formatCpf('12345678900')).toBe('123.456.789-00');
  });
  it('formata parcial (5 dígitos)', () => {
    expect(formatCpf('12345')).toBe('123.45');
  });
  it('strip remove tudo que não é dígito', () => {
    expect(stripCpf('123.456.789-00')).toBe('12345678900');
  });
  it('valida CPFs conhecidos', () => {
    expect(isValidCpf('52998224725')).toBe(true);  // test vector público
    expect(isValidCpf('11144477735')).toBe(true);
  });
  it('rejeita CPFs inválidos', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
});
