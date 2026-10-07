import { describe, expect, it } from 'vitest';
import { linkInstagram, normalizarInstagram } from './instagram';

describe('normalizarInstagram', () => {
  it('remove @, espaços e diferença entre maiúsculas e minúsculas', () => {
    expect(normalizarInstagram('  @Loja.Moto  ')).toBe('loja.moto');
  });

  it('aceita uma URL completa de perfil do Instagram', () => {
    expect(normalizarInstagram('https://www.instagram.com/RK.Sucatas/')).toBe('rk.sucatas');
  });

  it('rejeita vazio, domínio estranho e caracteres inválidos', () => {
    expect(normalizarInstagram('')).toBe('');
    expect(normalizarInstagram('https://exemplo.com/rk.sucatas')).toBe('');
    expect(normalizarInstagram('@rk-sucatas!')).toBe('');
  });
});

describe('linkInstagram', () => {
  it('gera somente a URL canônica de um perfil válido', () => {
    expect(linkInstagram('@Loja.Moto')).toBe('https://www.instagram.com/loja.moto/');
    expect(linkInstagram('https://instagram.com/Loja.Moto/?utm_source=teste')).toBe('https://www.instagram.com/loja.moto/');
  });

  it('retorna null quando não existe perfil válido', () => {
    expect(linkInstagram('')).toBeNull();
    expect(linkInstagram('nome inválido')).toBeNull();
  });
});
