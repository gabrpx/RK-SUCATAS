import type { MovimentoDemo } from './data';

export type PeriodoMovimento = 'todos' | 'sete-dias';

export function filtrarMovimentosPorPeriodo(
  movimentos: MovimentoDemo[],
  periodo: PeriodoMovimento,
  agora = Date.now()
): MovimentoDemo[] {
  if (periodo === 'todos') return movimentos;
  const limite = 7 * 24 * 60 * 60 * 1000;
  return movimentos.filter((movimento) => agora - new Date(movimento.ocorridoEm).getTime() <= limite);
}
