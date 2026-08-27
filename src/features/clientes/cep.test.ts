import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatCep, validarCep, buscarCep } from './cep';

describe('formatCep', () => {
  it('formata 8 dígitos com hífen', () => {
    expect(formatCep('12345678')).toBe('12345-678');
  });

  it('retorna parcial sem hífen quando < 6 dígitos', () => {
    expect(formatCep('123')).toBe('123');
  });

  it('insere hífen a partir de 6 dígitos', () => {
    expect(formatCep('123456')).toBe('12345-6');
  });

  it('remove não-dígitos antes de formatar', () => {
    expect(formatCep('12.345-678')).toBe('12345-678');
  });

  it('limita a 8 dígitos', () => {
    expect(formatCep('123456789999')).toBe('12345-678');
  });

  it('string vazia retorna vazia', () => {
    expect(formatCep('')).toBe('');
  });
});

describe('validarCep', () => {
  it('CEP completo com hífen é válido', () => {
    expect(validarCep('12345-678')).toBe(true);
  });

  it('CEP completo sem hífen é válido', () => {
    expect(validarCep('12345678')).toBe(true);
  });

  it('CEP incompleto é inválido', () => {
    expect(validarCep('1234-567')).toBe(false);
  });

  it('string vazia é inválida', () => {
    expect(validarCep('')).toBe(false);
  });

  it('letras são inválidas', () => {
    expect(validarCep('abcde-fgh')).toBe(false);
  });
});

describe('buscarCep', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna cidade e uf para CEP válido', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ localidade: 'São Paulo', uf: 'SP' }),
    } as Response);

    const result = await buscarCep('01001-000');
    expect(result).toEqual({ cidade: 'São Paulo', uf: 'SP' });
  });

  it('retorna null quando API retorna erro', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ erro: true }),
    } as Response);

    const result = await buscarCep('00000-000');
    expect(result).toBeNull();
  });

  it('retorna null quando fetch falha', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await buscarCep('01001-000');
    expect(result).toBeNull();
  });

  it('retorna null para CEP inválido sem chamar fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await buscarCep('123');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
