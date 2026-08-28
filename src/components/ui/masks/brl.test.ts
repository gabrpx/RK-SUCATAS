import { describe, it, expect } from 'vitest';
import { formatBrl, parseBrl } from './brl';

describe('brl', () => {
  it('formata cents em BRL', () => {
    expect(formatBrl(0)).toBe('R$ 0,00');
    expect(formatBrl(1)).toBe('R$ 0,01');
    expect(formatBrl(12345)).toBe('R$ 123,45');
    expect(formatBrl(1234567)).toBe('R$ 12.345,67');
  });
  it('parse aceita string formatada', () => {
    expect(parseBrl('R$ 1.234,56')).toBe(123456);
    expect(parseBrl('1.234,56')).toBe(123456);
    expect(parseBrl('123,45')).toBe(12345);
    expect(parseBrl('1234.56')).toBe(123456);   // formato "americano" colado
    expect(parseBrl('')).toBe(0);
  });
});
