// Soma um Map<id, contagem> sobre uma lista de ids (ex: "quanto esse nó tem
// somando ele mesmo + toda a subárvore abaixo dele"). Não é específico de
// categoria nem de moto — quem chama já resolveu a lista de descendentes via
// getDescendantIds de categoriaTree.ts/motoTree.ts, isso aqui só soma.
export function sumWithDescendants(descendantIds: string[], countMap: Map<string, number>): number {
  return descendantIds.reduce((soma, id) => soma + (countMap.get(id) ?? 0), 0);
}
