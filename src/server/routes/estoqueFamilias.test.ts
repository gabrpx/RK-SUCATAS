// src/server/routes/estoqueFamilias.test.ts
import { describe, it, expect } from 'vitest';
import { montarPayloadFamilia } from './estoqueFamilias.js';

describe('montarPayloadFamilia', () => {
  it('trims nome when present', () => {
    expect(montarPayloadFamilia({ nome: '  Tanque de Combustível CG 125  ' })).toEqual({ nome: 'Tanque de Combustível CG 125' });
  });

  it('omits nome from the payload when not provided (partial update)', () => {
    expect(montarPayloadFamilia({ descricao: 'nova descrição' })).toEqual({ descricao: 'nova descrição' });
  });

  it('normalizes empty categoria_id/imagem_url to null', () => {
    expect(montarPayloadFamilia({ categoria_id: '', imagem_url: '' })).toEqual({ categoria_id: null, imagem_url: null });
  });

  it('trims descricao and turns empty string into null', () => {
    expect(montarPayloadFamilia({ descricao: '   ' })).toEqual({ descricao: null });
  });
});
