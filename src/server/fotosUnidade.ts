/**
 * As fotos antigas foram gravadas em estoque.imagens antes da existência das
 * fichas físicas. Elas são referência da peça-pai e não pertencem a uma ficha
 * individual; a API só devolve como foto da unidade aquilo que ela possui.
 */
export function fotosEfetivasDaUnidade(unidade: { fotos?: unknown } | null | undefined, _imagensLegadas: unknown): string[] {
  const proprias = Array.isArray(unidade?.fotos) ? unidade.fotos.map(String).filter(Boolean) : [];
  return proprias;
}
