import { describe, it, expect } from 'vitest';
import { normalizarItens, derivarConclusao } from './tarefas';

describe('normalizarItens', () => {
  it('retorna [] quando não é array', () => {
    expect(normalizarItens(undefined)).toEqual([]);
    expect(normalizarItens(null)).toEqual([]);
    expect(normalizarItens('x')).toEqual([]);
  });
  it('descarta textos vazios/só-espaço e faz trim', () => {
    expect(normalizarItens([{ texto: '  Postar  ' }, { texto: '   ' }, { texto: '' }])).toEqual([{ texto: 'Postar' }]);
  });
  it('preserva id quando presente', () => {
    expect(normalizarItens([{ id: 'a', texto: 'X' }, { texto: 'Y' }])).toEqual([{ id: 'a', texto: 'X' }, { texto: 'Y' }]);
  });
});

describe('derivarConclusao', () => {
  const AGORA = '2026-08-24T18:00:00.000Z';
  it('sem itens não muda nada', () => {
    expect(derivarConclusao([], 'pendente', AGORA)).toBeNull();
  });
  it('todos marcados e pendente -> conclui', () => {
    expect(derivarConclusao([{ concluido: true }, { concluido: true }], 'pendente', AGORA))
      .toEqual({ status: 'concluida', concluida_em: AGORA });
  });
  it('algum pendente e concluida -> reabre', () => {
    expect(derivarConclusao([{ concluido: true }, { concluido: false }], 'concluida', AGORA))
      .toEqual({ status: 'pendente', concluida_em: null });
  });
  it('já no estado certo -> null (idempotente)', () => {
    expect(derivarConclusao([{ concluido: true }], 'concluida', AGORA)).toBeNull();
    expect(derivarConclusao([{ concluido: false }], 'pendente', AGORA)).toBeNull();
  });
});
