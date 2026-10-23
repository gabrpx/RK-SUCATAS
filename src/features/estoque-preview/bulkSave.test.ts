import { describe, expect, it } from "vitest";
import { mapComConcorrencia } from "./bulkSave";

describe("mapComConcorrencia", () => {
  it("processa todos os itens, preserva a ordem e respeita o limite", async () => {
    let simultaneas = 0;
    let pico = 0;
    const resultado = await mapComConcorrencia([1, 2, 3, 4, 5, 6], async (item) => {
      simultaneas += 1;
      pico = Math.max(pico, simultaneas);
      await Promise.resolve();
      simultaneas -= 1;
      return item * 2;
    }, 2);

    expect(resultado).toEqual([2, 4, 6, 8, 10, 12]);
    expect(pico).toBeLessThanOrEqual(2);
  });

  it("não cria trabalhadores quando a entrada está vazia", async () => {
    await expect(mapComConcorrencia([], async () => "nunca")).resolves.toEqual([]);
  });
});

