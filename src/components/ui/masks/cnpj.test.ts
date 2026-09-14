import { describe, it, expect } from 'vitest';
import { formatCnpj, stripCnpj, isValidCnpj } from './cnpj';

describe('cnpj', () => {
  it('formata 14 dígitos', () => {
    expect(formatCnpj('12345678000199')).toBe('12.345.678/0001-99');
  });
  it('strip', () => {
    expect(stripCnpj('12.345.678/0001-99')).toBe('12345678000199');
  });
  it('valida CNPJs conhecidos', () => {
    expect(isValidCnpj('11444777000161')).toBe(true);
  });
  it('rejeita inválidos', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('12345678000100')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });
});
