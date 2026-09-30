import { parseDataLocal, type MovimentoDemo, type PendenciaDemo } from './data';
import type { SaleViewModel } from './salesViewModel';

export interface SalesOverview {
  period: { grossSales: number; salesCount: number; cashIn: number; cashInCount: number; cashOut: number; netResult: number };
  current: { receivable: number; overdue: number };
}

export function buildSalesOverview({ sales, movements, pendings, start, end, financialAvailable }: {
  sales: SaleViewModel[]; movements: MovimentoDemo[]; pendings: PendenciaDemo[];
  start: Date; end: Date; financialAvailable: boolean;
}): SalesOverview {
  const inPeriod = (value: string) => {
    const date = parseDataLocal(value);
    return date >= start && date <= end;
  };
  const periodSales = sales.filter((sale) => inPeriod(sale.ocorridoEm));
  const periodMovements = financialAvailable ? movements.filter((movement) => inPeriod(movement.ocorridoEm)) : [];
  const cashInRows = periodMovements.filter((movement) => movement.tipo === 'entrada');
  const cashIn = cashInRows.reduce((sum, movement) => sum + movement.valor, 0);
  const cashOut = periodMovements.filter((movement) => movement.tipo === 'saída').reduce((sum, movement) => sum + movement.valor, 0);
  const open = financialAvailable ? pendings.filter((pending) => pending.pago < pending.total) : [];
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const isOverdue = (pending: PendenciaDemo) => {
    const due = pending.venceEm
      ? parseDataLocal(pending.venceEm)
      : new Date(parseDataLocal(pending.criadaEm).getTime() + 30 * 86400000);
    return new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() < endDay;
  };
  const outstanding = (pending: PendenciaDemo) => Math.max(0, pending.total - pending.pago);

  return {
    period: {
      grossSales: periodSales.reduce((sum, sale) => sum + sale.valor, 0),
      salesCount: periodSales.length,
      cashIn,
      cashInCount: cashInRows.length,
      cashOut,
      netResult: cashIn - cashOut,
    },
    current: {
      receivable: open.reduce((sum, pending) => sum + outstanding(pending), 0),
      overdue: open.filter(isOverdue).reduce((sum, pending) => sum + outstanding(pending), 0),
    },
  };
}
