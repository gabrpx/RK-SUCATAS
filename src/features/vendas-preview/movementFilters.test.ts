import { describe, expect, it } from 'vitest';
import { filtrarMovimentosPorPeriodo } from './movementFilters';
import type { MovimentoDemo } from './data';

const movimento = (id: string, ocorridoEm: string) => ({ id, ocorridoEm } as MovimentoDemo);

describe('filtrarMovimentosPorPeriodo', () => {
  it('mantém todos os movimentos ou limita a trinta dias usando uma referência de tempo estável', () => {
    const agora = new Date('2026-09-29T12:00:00.000Z').getTime();
    const itens = [
      movimento('hoje', '2026-09-29T10:00:00.000Z'),
      movimento('limite', '2026-08-30T12:00:00.000Z'),
      movimento('antigo', '2026-08-29T12:00:00.000Z'),
    ];

    expect(filtrarMovimentosPorPeriodo(itens, 'todos', agora).map((item) => item.id)).toEqual(['hoje', 'limite', 'antigo']);
    expect(filtrarMovimentosPorPeriodo(itens, 'trinta-dias', agora).map((item) => item.id)).toEqual(['hoje', 'limite']);
  });
});
