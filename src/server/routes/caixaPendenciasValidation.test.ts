import { describe, expect, it } from 'vitest';
import { prepararEdicaoPendencia } from './caixaPendenciasValidation';

const atual = {
  descricao: 'Peça encomendada', valor_total: 200, data: '2026-09-20',
  cliente_id: 'cliente-1', status: 'aberta' as const,
};

describe('prepararEdicaoPendencia', () => {
  it('recusa valor total inferior ao que já foi recebido', () => {
    const result = prepararEdicaoPendencia({ valor_total: 99 }, atual, 100);
    expect(result).toEqual({ ok: false, status: 400, error: 'O valor total não pode ser menor que o valor já recebido (R$ 100,00).' });
  });

  it('não reabre implicitamente uma pendência quitada', () => {
    const result = prepararEdicaoPendencia({ valor_total: 300 }, { ...atual, status: 'quitada' }, 200);
    expect(result).toEqual({ ok: false, status: 409, error: 'Pendências quitadas não podem ser reabertas por esta edição.' });
  });

  it('marca como quitada quando o novo total coincide com o recebido', () => {
    const result = prepararEdicaoPendencia({ descricao: '  Revisada  ', valor_total: 100 }, atual, 100);
    expect(result).toEqual({ ok: true, payload: { descricao: 'Revisada', valor_total: 100, status: 'quitada' } });
  });

  it('aceita os campos seguros e preserva a pendência aberta quando ainda há saldo', () => {
    const result = prepararEdicaoPendencia({ descricao: 'Revisada', valor_total: 250, data: '2026-09-30', cliente_id: null }, atual, 100);
    expect(result).toEqual({ ok: true, payload: { descricao: 'Revisada', valor_total: 250, data: '2026-09-30', cliente_id: null, status: 'aberta' } });
  });

  it('recusa uma data inexistente no calendário', () => {
    expect(prepararEdicaoPendencia({ data: '2026-02-31' }, atual, 0))
      .toEqual({ ok: false, status: 400, error: 'Data inválida.' });
  });
});
