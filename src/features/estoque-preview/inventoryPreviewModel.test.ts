import { describe, expect, it } from "vitest";
import {
  adicionarUnidade,
  arquivarUnidade,
  buscarPecas,
  criarEstoqueDemo,
  diasRestantesReserva,
  editarUnidade,
  getMetricas,
  getSecoesDaPrateleira,
  liberarReservaUnidade,
  podeReservar,
  reservarUnidade,
  restaurarUnidade,
} from "./inventoryPreviewModel";

describe("inventoryPreviewModel", () => {
  it("converte os registros auditados em categorias e unidades individuais", () => {
    const estoque = criarEstoqueDemo();

    expect(estoque.categorias.map((categoria) => categoria.nome)).toEqual([
      "Rabeta",
      "Escapamentos",
      "Embreagem",
    ]);
    expect(estoque.pecas).toHaveLength(9);
    expect(
      estoque.unidades
        .filter((unidade) => unidade.codigoLegado === "RK-792")
        .map((unidade) => unidade.sku)
    ).toEqual(["RK-792-01", "RK-792-02", "RK-792-03"]);
    expect(estoque.unidades).toHaveLength(10);
    expect(estoque.unidades.every((unidade) => unidade.fotoUrl === null)).toBe(
      true
    );
  });

  it.each([
    ["suporte de placa", "SUPORTE DE PLACA (RABETA) CBX TWISTER 250"],
    ["rabeta", "SUPORTE DE PLACA (RABETA) CBX TWISTER 250"],
    ["twister 250", "SUPORTE DE PLACA (RABETA) CBX TWISTER 250"],
    ["RK-315", "ESCAPAMENTO HONDA CB TWISTER 250F"],
    ["RK-792-02", "SUPORTE DE PLACA (RABETA) CG 150 MIX (09/13)"],
    ["P03-S01", "EMBREAGEM COMPLETA COM CAMPANA FACTOR 150"],
  ])("busca %s em todos os campos operacionais", (termo, esperado) => {
    const resultado = buscarPecas(criarEstoqueDemo(), termo);

    expect(resultado.some((item) => item.peca.nome === esperado)).toBe(true);
  });

  it("deriva métricas e mapa da mesma lista de unidades", () => {
    const estoque = criarEstoqueDemo();
    const metricas = getMetricas(estoque);
    const secoes = getSecoesDaPrateleira(estoque, "P01");

    expect(metricas.totalAtivas).toBe(10);
    expect(metricas.reservadas).toBe(1);
    expect(metricas.paraOrganizar).toBe(1);
    expect(metricas.semEstoque).toBe(1);
    expect(metricas.valorEmEstoque).toBe(2279.4);
    expect(buscarPecas(estoque, "").find((item) => item.peca.codigoLegado === "RK-825")?.unidades).toHaveLength(0);
    expect(secoes).toHaveLength(8);
    expect(secoes[0]?.categoria?.nome).toBe("Rabeta");
    expect(secoes[0]?.categorias.map((categoria) => categoria.nome)).toEqual(["Rabeta"]);
    expect(secoes[0]?.unidades).toHaveLength(4);
    expect(secoes[1]?.unidades).toHaveLength(0);
  });

  it("adiciona exatamente uma unidade a uma peça existente", () => {
    const estoque = criarEstoqueDemo();
    const depois = adicionarUnidade(estoque, {
      pecaId: "peca-rk-315",
      preco: 430,
      grau: "B",
      origem: null,
      fotoUrl: null,
      endereco: "P02-S01",
    });

    expect(depois.unidades).toHaveLength(11);
    expect(depois.unidades.at(-1)).toMatchObject({
      pecaId: "peca-rk-315",
      sku: "RK-315-02",
      preco: 430,
      origem: null,
      endereco: "P02-S01",
    });
  });

  it("edita uma unidade sem criar cópia e atualiza o mapa derivado", () => {
    const estoque = criarEstoqueDemo();
    const depois = editarUnidade(estoque, "unidade-rk-803-01", {
      preco: 285,
      endereco: "P04-S02",
      grau: "C",
    });

    expect(depois.unidades).toHaveLength(10);
    expect(
      depois.unidades.find((unidade) => unidade.id === "unidade-rk-803-01")
    ).toMatchObject({ preco: 285, endereco: "P04-S02", grau: "C" });
    expect(getSecoesDaPrateleira(depois, "P04")[1]?.unidades).toHaveLength(1);
  });

  it("arquiva preservando histórico e restaura a mesma unidade", () => {
    const estoque = criarEstoqueDemo();
    const arquivado = arquivarUnidade(
      estoque,
      "unidade-rk-810-01",
      "Duplicidade conferida",
      "2026-09-21T16:00:00.000Z"
    );

    expect(getMetricas(arquivado).totalAtivas).toBe(9);
    expect(getMetricas(arquivado).arquivadas).toBe(1);
    expect(getSecoesDaPrateleira(arquivado, "P01")[0]?.unidades).toHaveLength(
      3
    );
    expect(
      arquivado.unidades.find((unidade) => unidade.id === "unidade-rk-810-01")
    ).toMatchObject({
      estado: "arquivada",
      motivoArquivamento: "Duplicidade conferida",
      arquivadaEm: "2026-09-21T16:00:00.000Z",
    });

    const restaurado = restaurarUnidade(arquivado, "unidade-rk-810-01");
    expect(getMetricas(restaurado).totalAtivas).toBe(10);
    expect(getMetricas(restaurado).arquivadas).toBe(0);
  });

  it("reserva para cliente cadastrado e libera devolvendo o estado físico", () => {
    const estoque = criarEstoqueDemo();
    const alvo = estoque.unidades.find((item) => item.estado === "disponivel")!;
    const reservado = reservarUnidade(estoque, alvo.id, { clienteId: "cli-1", nome: " Maria ", telefone: "(83) 9", reservadaAte: "2026-09-29T21:00:00.000Z" });
    const unidade = reservado.unidades.find((item) => item.id === alvo.id)!;
    expect(unidade).toMatchObject({ estado: "reservada", reservadaPara: "Maria", reservaClienteId: "cli-1", reservaTelefone: "(83) 9" });
    expect(podeReservar(unidade)).toBe(false);
    const liberado = liberarReservaUnidade(reservado, alvo.id).unidades.find((item) => item.id === alvo.id)!;
    expect(liberado.estado).toBe(alvo.endereco ? "disponivel" : "organizar");
    expect(liberado.reservaClienteId).toBeUndefined();
    expect(liberado.reservadaPara).toBeUndefined();
  });

  it("não reserva unidade arquivada nem quantidade sem ficha", () => {
    const estoque = criarEstoqueDemo();
    const alvo = estoque.unidades[0];
    const arquivado = arquivarUnidade(estoque, alvo.id, "teste");
    const tentativa = reservarUnidade(arquivado, alvo.id, { clienteId: null, nome: "João", reservadaAte: "2026-09-29T21:00:00.000Z" });
    expect(tentativa.unidades.find((item) => item.id === alvo.id)!.estado).toBe("arquivada");
    expect(podeReservar({ ...alvo, individualizada: false })).toBe(false);
  });

  it("conta dias de calendário até o vencimento da reserva", () => {
    const agora = new Date(2026, 8, 22, 17, 40);
    expect(diasRestantesReserva(new Date(2026, 8, 29, 18, 0).toISOString(), agora)).toBe(7);
    expect(diasRestantesReserva(new Date(2026, 8, 22, 18, 0).toISOString(), agora)).toBe(0);
    expect(diasRestantesReserva(new Date(2026, 8, 20, 18, 0).toISOString(), agora)).toBe(0);
    expect(diasRestantesReserva("data inválida", agora)).toBe(0);
  });
});
