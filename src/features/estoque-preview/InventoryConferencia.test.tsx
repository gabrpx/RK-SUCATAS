// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryConferencia, pecasComFichasSobrando } from "./InventoryConferencia";
import type { PecaEstoque, UnidadeEstoque } from "./inventoryPreviewModel";

afterEach(cleanup);

const peca: PecaEstoque = { id: "peca-1", codigoLegado: "RK-900", nome: "Farol CG 160", categoriaId: "cat-1", compatibilidades: [], detalhes: "", origemDado: "real" };
const pecaSobra: PecaEstoque = { ...peca, id: "peca-2", codigoLegado: "RK-901", nome: "Pisca Titan", fichasExcedentes: 1 };
const unidade = (id: string, sku: string, pecaId = "peca-1", extra: Partial<UnidadeEstoque> = {}): UnidadeEstoque => ({
  id, sku, pecaId, individualizada: true, codigoLegado: "RK-900", grau: "B", preco: 120, fotoUrl: null, origem: null, endereco: "A-01", estado: "disponivel", detalhes: null, ...extra,
});
const unidades = [
  unidade("u1", "RK-900-01", "peca-1", { vendidaEm: "2026-09-24T10:00:00Z", estado: "arquivada" }),
  unidade("u2", "RK-900-02"),
  unidade("u3", "RK-900-03", "peca-1", { estado: "reservada" }),
  unidade("s1", "RK-901-01", "peca-2"),
  unidade("s2", "RK-901-02", "peca-2"),
];
const baixa = { id: "b1", venda_id: "v1", unidade_id: "u1", estoque_id: "peca-1", criada_em: "2026-09-24T10:00:00Z", venda: { data: "2026-09-24", nome_item: "Farol CG 160", cliente_nome: "Balcão", valor_total: 120 } };

function renderizar(onConferir = vi.fn().mockResolvedValue(true), onBaixarExcedente = vi.fn().mockResolvedValue(true)) {
  render(<InventoryConferencia aberto onFechar={() => undefined} baixas={[baixa]} sobras={pecasComFichasSobrando([peca, pecaSobra], unidades)} pecas={[peca, pecaSobra]} unidades={unidades} podeAlterar onConferir={onConferir} onBaixarExcedente={onBaixarExcedente} />);
  return { onConferir, onBaixarExcedente };
}

describe("InventoryConferencia", () => {
  it("confirma a unidade baixada automaticamente", async () => {
    const { onConferir } = renderizar();
    expect(screen.getByRole("dialog", { name: "Conferência do estoque" })).toBeTruthy();
    expect(screen.getByText(/Venda de 24\/09\/2026 · Balcão/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar que RK-900-01 foi a vendida" }));
    await waitFor(() => expect(onConferir).toHaveBeenCalledWith(baixa, null));
  });

  it("troca pela unidade que saiu, oferecendo só livres e sem reserva", async () => {
    const { onConferir } = renderizar();
    fireEvent.click(screen.getByRole("button", { name: /Foi outra/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Unidade que realmente saiu/ }));
    expect(screen.queryByRole("option", { name: /RK-900-03/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /RK-900-02/ }));
    fireEvent.click(screen.getByRole("button", { name: /Trocar e devolver RK-900-01/ }));
    await waitFor(() => expect(onConferir).toHaveBeenCalledWith(baixa, "u2"));
  });

  it("lista a ficha sobrando de venda antiga com a ação de baixa", async () => {
    const { onBaixarExcedente } = renderizar();
    expect(screen.getByText(/1 ficha sobrando/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Marcar RK-901-02 como já vendida" }));
    await waitFor(() => expect(onBaixarExcedente).toHaveBeenCalledWith(expect.objectContaining({ id: "s2" })));
  });
});
