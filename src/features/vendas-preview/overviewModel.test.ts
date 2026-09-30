import { describe, expect, it } from 'vitest';
import type { MovimentoDemo, PendenciaDemo } from './data';
import type { SaleViewModel } from './salesViewModel';
import { buildSalesOverview } from './overviewModel';

const sale = (id: string, value: number, date: string) => ({ id, valor: value, ocorridoEm: date }) as SaleViewModel;
const movement = (id: string, tipo: 'entrada' | 'saída', value: number, date: string) => ({ id, tipo, valor: value, ocorridoEm: date }) as MovimentoDemo;
const pending = (id: string, total: number, paid: number, created: string): PendenciaDemo => ({
  id, tipo: 'A receber', nome: 'Ana', origem: 'Venda', total, pago: paid, pagamentos: [],
  venceEm: null, criadaEm: created, source: { kind: 'caixa', pendenciaId: id }, clienteId: null, observacoes: null,
});

describe('buildSalesOverview', () => {
  it('calcula vendas, entradas, saídas e resultado somente dentro do período', () => {
    const result = buildSalesOverview({
      sales: [sale('inside', 200, '2026-09-20'), sale('outside', 500, '2026-08-20')],
      movements: [movement('in', 'entrada', 150, '2026-09-20'), movement('out', 'saída', 40, '2026-09-21'), movement('old', 'entrada', 900, '2026-08-20')],
      pendings: [], start: new Date('2026-09-01T00:00:00'), end: new Date('2026-09-30T23:59:59'), financialAvailable: true,
    });
    expect(result.period).toEqual({ grossSales: 200, salesCount: 1, cashIn: 150, cashInCount: 1, cashOut: 40, netResult: 110 });
  });

  it('mantém a posição atual independente do período selecionado', () => {
    const pendings = [pending('p1', 300, 100, '2026-08-01')];
    const base = { sales: [], movements: [], pendings, end: new Date('2026-09-30T23:59:59'), financialAvailable: true };
    expect(buildSalesOverview({ ...base, start: new Date('2026-09-01T00:00:00') }).current)
      .toEqual(buildSalesOverview({ ...base, start: new Date('2026-09-30T00:00:00') }).current);
  });
});
