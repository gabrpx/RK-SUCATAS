import { describe, it, expect } from 'vitest';
import { linkWhatsapp, normalizarTelefoneBR } from './whatsapp';

describe('normalizarTelefoneBR', () => {
  it('higieniza (só dígitos) e prefixa o DDI 55 num celular local de 11 dígitos', () => {
    expect(normalizarTelefoneBR('(83) 98203-9490')).toBe('5583982039490');
  });

  it('prefixa o DDI 55 num fixo local de 10 dígitos', () => {
    expect(normalizarTelefoneBR('83 3221-1234')).toBe('558332211234');
  });

  it('não duplica o 55 quando o número já vem com DDI', () => {
    expect(normalizarTelefoneBR('5583982039490')).toBe('5583982039490');
  });

  it('trata o DDD 55 (Santa Maria/RS) como número local, não como DDI', () => {
    // 11 dígitos = celular local com DDD 55; deve virar 55 (DDI) + 55999998888
    expect(normalizarTelefoneBR('55 99999-8888')).toBe('5555999998888');
  });

  it('retorna null quando não há dígitos', () => {
    expect(normalizarTelefoneBR('')).toBeNull();
    expect(normalizarTelefoneBR(null)).toBeNull();
    expect(normalizarTelefoneBR(undefined)).toBeNull();
    expect(normalizarTelefoneBR('sem número')).toBeNull();
  });
});

describe('linkWhatsapp', () => {
  it('monta a URL wa.me com o número higienizado e DDI 55', () => {
    expect(linkWhatsapp('(83) 98203-9490')).toBe('https://wa.me/5583982039490');
  });

  it('anexa a mensagem encodada em ?text= quando informada', () => {
    expect(linkWhatsapp('83982039490', 'Olá, tudo bem?')).toBe(
      'https://wa.me/5583982039490?text=Ol%C3%A1%2C%20tudo%20bem%3F'
    );
  });

  it('retorna null quando o telefone não tem dígitos', () => {
    expect(linkWhatsapp(null)).toBeNull();
    expect(linkWhatsapp('')).toBeNull();
  });
});
