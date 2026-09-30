import type { MovimentoDemo } from './data';

export type PeriodoMovimento = 'todos' | 'trinta-dias';

export function filtrarMovimentosPorPeriodo(
  movimentos: MovimentoDemo[],
  periodo: PeriodoMovimento,
  agora = Date.now()
): MovimentoDemo[] {
  if (periodo === 'todos') return movimentos;
  const limite = 30 * 24 * 60 * 60 * 1000;
  return movimentos.filter((movimento) => agora - new Date(movimento.ocorridoEm).getTime() <= limite);
}
