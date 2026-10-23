export const BULK_SAVE_CONCURRENCY = 4;

/** Executa operações independentes com um limite de requests simultâneos. */
export async function mapComConcorrencia<T, R>(
  itens: readonly T[],
  tarefa: (item: T, indice: number) => Promise<R>,
  limite = BULK_SAVE_CONCURRENCY,
): Promise<R[]> {
  if (itens.length === 0) return [];
  const resultados = new Array<R>(itens.length);
  let proximoIndice = 0;
  const trabalhadores = Array.from({ length: Math.min(Math.max(1, limite), itens.length) }, async () => {
    while (true) {
      const indice = proximoIndice;
      proximoIndice += 1;
      if (indice >= itens.length) return;
      resultados[indice] = await tarefa(itens[indice], indice);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}

