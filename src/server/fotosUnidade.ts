/**
 * As fotos antigas foram gravadas em estoque.imagens antes da existência das
 * fichas físicas. Enquanto uma ficha não possui fotos próprias, elas passam a
 * ser as fotos efetivas da unidade. Fotos específicas da unidade têm prioridade.
 */
export function fotosEfetivasDaUnidade(unidade: { fotos?: unknown } | null | undefined, imagensLegadas: unknown): string[] {
  const proprias = Array.isArray(unidade?.fotos) ? unidade.fotos.map(String).filter(Boolean) : [];
  if (proprias.length > 0) return proprias;
  return Array.isArray(imagensLegadas) ? imagensLegadas.map(String).filter(Boolean) : [];
}
