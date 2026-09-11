// Validação estrita do campo `novo` (migration_063, Fase 2A): só booleano de
// verdade entra no payload; qualquer outra coisa vira 400 via validarNovo, e
// null/undefined significam "não mexer" (a coluna é NOT NULL, nunca gravar
// null). Testa as duas funções puras que POST e PATCH compartilham.
import { describe, it, expect } from 'vitest';
import { validarNovo, montarPayload } from './estoque';

describe('validarNovo (booleano estrito)', () => {
  it('aceita true e false', () => {
    expect(validarNovo({ novo: true })).toBeNull();
    expect(validarNovo({ novo: false })).toBeNull();
  });

  it('aceita ausência (undefined/null = não mexe)', () => {
    expect(validarNovo({})).toBeNull();
    expect(validarNovo({ novo: undefined })).toBeNull();
    expect(validarNovo({ novo: null })).toBeNull();
  });

  it('rejeita truthy/falsy não-booleanos', () => {
    for (const valor of ['true', 'false', 1, 0, 'on', 'sim', {}, []]) {
      expect(validarNovo({ novo: valor })).toMatch(/booleano/i);
    }
  });
});

describe('montarPayload — campo novo', () => {
  it('inclui novo só quando é booleano', () => {
    expect(montarPayload({ novo: true }).novo).toBe(true);
    expect(montarPayload({ novo: false }).novo).toBe(false);
  });

  it('nunca grava null/undefined/coerções em novo', () => {
    expect('novo' in montarPayload({ novo: null })).toBe(false);
    expect('novo' in montarPayload({ novo: undefined })).toBe(false);
    expect('novo' in montarPayload({ novo: 'true' })).toBe(false);
    expect('novo' in montarPayload({ novo: 1 })).toBe(false);
    expect('novo' in montarPayload({})).toBe(false);
  });
});
