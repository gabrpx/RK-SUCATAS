// O join do estoque lista colunas explícitas da categoria. Toda coluna nova
// de `categorias` que o frontend precisa tem que ser adicionada aqui à mão —
// esquecer disso foi exatamente o bug da predefinição de categoria do
// Mercado Livre (o toggle salvava, mas o valor nunca voltava pro formulário).
import { describe, it, expect } from 'vitest';
import { SELECT_COM_JOINS, montarPayload } from './estoque.js';

describe('SELECT_COM_JOINS', () => {
  it('traz a categoria padrão do Mercado Livre junto da categoria da peça', () => {
    expect(SELECT_COM_JOINS).toContain('mercadolivre_categoria_id_padrao');
  });

  it('continua trazendo id e nome da categoria', () => {
    expect(SELECT_COM_JOINS).toMatch(/categoria:categorias\([^)]*id[^)]*nome[^)]*\)/);
  });
});

describe('SELECT_COM_JOINS (família)', () => {
  it('não embute estoque_familias no select principal', () => {
    // O select principal não deve tentar embutir estoque_familias — isso
    // quebraria a listagem inteira se a migration_056 não tiver rodado
    // ainda, o mesmo motivo pelo qual unidades/compatibilidades também
    // ficam fora do SELECT_COM_JOINS. Ver anexarFamilias (consulta separada).
    expect(SELECT_COM_JOINS).not.toContain('estoque_familias');
  });
});

describe('SELECT_COM_JOINS (gaveta)', () => {
  it('traz o join da gaveta com id, nome e icone', () => {
    expect(SELECT_COM_JOINS).toMatch(/gaveta:gavetas\([^)]*id[^)]*nome[^)]*icone[^)]*\)/);
  });
});

describe('montarPayload (gaveta_id)', () => {
  it('inclui gaveta_id no payload quando enviado (mover peça pra gaveta)', () => {
    expect(montarPayload({ gaveta_id: 'g1' })).toEqual({ gaveta_id: 'g1' });
  });

  it('normaliza null explícito pra null (soltar a peça da gaveta)', () => {
    expect(montarPayload({ gaveta_id: null })).toEqual({ gaveta_id: null });
  });

  it('normaliza string vazia pra null', () => {
    expect(montarPayload({ gaveta_id: '' })).toEqual({ gaveta_id: null });
  });

  it('omite gaveta_id quando o campo não veio no body', () => {
    expect(montarPayload({ nome: 'Tanque' })).not.toHaveProperty('gaveta_id');
  });
});

describe('montarPayload (familia_id)', () => {
  it('mantém um uuid válido de familia_id', () => {
    expect(montarPayload({ familia_id: 'f1' })).toEqual({ familia_id: 'f1' });
  });

  it('normaliza string vazia pra null (desvincula da família)', () => {
    expect(montarPayload({ familia_id: '' })).toEqual({ familia_id: null });
  });

  it('normaliza null explícito pra null', () => {
    expect(montarPayload({ familia_id: null })).toEqual({ familia_id: null });
  });

  it('omite familia_id quando o campo não veio no body', () => {
    expect(montarPayload({ nome: 'Tanque' })).not.toHaveProperty('familia_id');
  });
});
