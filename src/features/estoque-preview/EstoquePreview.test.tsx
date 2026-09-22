// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EstoquePreview } from "./EstoquePreview";

afterEach(cleanup);

describe("EstoquePreview", () => {
  it("abre no atendimento com dados reais demonstrativos e métricas derivadas", () => {
    render(<EstoquePreview />);

    expect(screen.getByRole("heading", { name: "Estoque" })).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Resumo operacional do estoque" })
    ).toBeTruthy();
    expect(screen.getByText(/Rabeta · RK-810/)).toBeTruthy();
    expect(screen.getByText("unidades físicas no estoque")).toBeTruthy();
    expect(screen.getByText("Ritmo de organização")).toBeTruthy();
  });

  it("abre a ficha completa de uma unidade no drawer operacional", () => {
    render(<EstoquePreview />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhes de RK-810-01" })
    );

    expect(
      screen.getByRole("dialog", { name: "Detalhes da unidade RK-810-01" })
    ).toBeTruthy();
    expect(screen.getByText("Informações da unidade")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Histórico" })).toBeTruthy();
  });

  it("abre o drawer de criação com a primeira unidade", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));

    expect(
      screen.getByRole("dialog", { name: "Nova peça e primeira unidade" })
    ).toBeTruthy();
    expect(screen.getByText("Primeira unidade")).toBeTruthy();
  });

  it("indica uma peça semelhante e permite usar o cadastro existente antes de duplicá-lo", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.change(screen.getByLabelText("Nome da Peça"), {
      target: { value: "SUPORTE DE PLACA CG 150" },
    });

    expect(screen.getByText("Já existe uma peça parecida")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Usar existente: RK-792/i }));
    expect(screen.getByDisplayValue("RK-792 · SUPORTE DE PLACA \(RABETA\) CG 150 MIX \(09\/13\)")).toBeTruthy();
  });

  it("não deixa texto livre anexar uma unidade à primeira peça do catálogo", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.click(screen.getByRole("button", { name: /^Usar existente/i }));
    fireEvent.change(screen.getByLabelText("Peça existente"), {
      target: { value: "uma peça que não está no catálogo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByRole("alert").textContent).toContain("Escolha a peça existente antes de continuar.");
  });

  it("deixa explícito no cursor quando uma unidade pode ser aberta", () => {
    render(<EstoquePreview />);

    expect(screen.getByRole("button", { name: "Ver detalhes de RK-810-01" }).className).toContain("cursor-pointer");
  });

  it("mantém o conteúdo de cada aba em um painel animado", () => {
    render(<EstoquePreview />);

    expect(screen.getAllByRole("tabpanel")).toHaveLength(4);
  });

  it("busca por código legado e alterna para lista", () => {
    render(<EstoquePreview />);

    fireEvent.change(screen.getByRole("searchbox", { name: /Buscar no estoque/i }), {
      target: { value: "RK-315" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualização em lista" }));

    expect(screen.getByText("ESCAPAMENTO HONDA CB TWISTER 250F")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByText("SUPORTE DE PLACA (RABETA) CG 150")).toBeNull();
  });

  it("abre o cadastro, salva uma unidade e mostra a nova unidade", async () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.change(screen.getByLabelText("Nome da Peça"), {
      target: { value: "Nova peça demonstrativa" },
    });
    expect(screen.getByRole("dialog", { name: /Nova peça e primeira unidade/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar unidade/i }));

    await waitFor(() => expect(screen.getByText("NOVO-001-01")).toBeTruthy());
    expect(screen.getByText(/Unidade adicionada/)).toBeTruthy();
  });

  it("edita e arquiva uma unidade preservando o acesso ao histórico", async () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: /Ações de RK-810-01/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Editar unidade/i }));
    fireEvent.change(screen.getByLabelText("Preço da unidade"), {
      target: { value: "175" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    expect(screen.getByText(/Unidade atualizada/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Ações de RK-810-01/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Arquivar unidade/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar arquivamento/i }));
    expect(screen.getByText(/Unidade arquivada/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Arquivados/i }));
    expect(screen.getByText("RK-810-01")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Restaurar RK-810-01/i }));
    expect(screen.getByText(/Unidade restaurada/)).toBeTruthy();
  });

  it("organiza uma seção no mapa e mantém oito seções por prateleira", () => {
    render(<EstoquePreview />);
    fireEvent.click(screen.getByRole("tab", { name: /Mapa físico/i }));

    expect(screen.getByText("Prateleira P01")).toBeTruthy();
    expect(screen.getAllByText(/P01-S/)).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: /Editar P01-S02/i }));
    fireEvent.click(screen.getByRole("button", { name: /Categoria: Escapamentos/i }));
    expect(screen.getByText("Escapamentos")).toBeTruthy();
  });
});
