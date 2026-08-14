// O join do estoque lista colunas explícitas da categoria. Toda coluna nova
// de `categorias` que o frontend precisa tem que ser adicionada aqui à mão —
// esquecer disso foi exatamente o bug da predefinição de categoria do
// Mercado Livre (o toggle salvava, mas o valor nunca voltava pro formulário).
import { describe, it, expect } from 'vitest';
import { SELECT_COM_JOINS } from './estoque.js';

describe('SELECT_COM_JOINS', () => {
  it('traz a categoria padrão do Mercado Livre junto da categoria da peça', () => {
    expect(SELECT_COM_JOINS).toContain('mercadolivre_categoria_id_padrao');
  });

  it('continua trazendo id e nome da categoria', () => {
    expect(SELECT_COM_JOINS).toMatch(/categoria:categorias\([^)]*id[^)]*nome[^)]*\)/);
  });
});
