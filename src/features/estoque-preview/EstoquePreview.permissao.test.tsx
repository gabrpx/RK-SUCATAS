// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Usuário sem estoque.editar/estoque.criar (ex.: perfil de consulta).
vi.mock("../../hooks/usePermissao", () => ({
  usePermissao: () => ({ isAdmin: false, permissoes: { estoque: { ver: true } }, pode: (chave: string) => chave === "estoque.ver" }),
}));

import { EstoquePreview } from "./EstoquePreview";

afterEach(cleanup);

describe("EstoquePreview sem permissão de edição", () => {
  it("vira tela de consulta: sem Nova peça, menus de ação, reserva ou edição", async () => {
    render(<EstoquePreview />);
    expect(screen.queryByRole("button", { name: "Nova peça" })).toBeNull();
    expect(screen.getByText("Somente consulta")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ações de RK-810-01/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de RK-810-01" }));
    expect(await screen.findByRole("dialog", { name: "Detalhes da unidade RK-810-01" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Reservar$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Editar unidade/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Arquivar$/ })).toBeNull();
  });
});
