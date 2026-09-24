import { describe, expect, it } from 'vitest';
import { ehRotaEstoquePreview } from './previewRoute';

describe('ehRotaEstoquePreview', () => {
  it('identifica somente a rota isolada da prévia', () => {
    expect(ehRotaEstoquePreview('/estoque-preview')).toBe(true);
    expect(ehRotaEstoquePreview('/estoque')).toBe(false);
    expect(ehRotaEstoquePreview('/tarefas-preview')).toBe(false);
  });
});
