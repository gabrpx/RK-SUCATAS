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
    expect(screen.getByText("inclui quantidades legadas sem ficha")).toBeTruthy();
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

  it("não reaproveita dados de um cadastro cancelado ao abrir outro", async () => {
    render(<EstoquePreview />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova peça" }));
    fireEvent.change(screen.getByLabelText("Nome da Peça"), { target: { value: "Peça abandonada" } });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nova peça" }));
    expect((screen.getByLabelText("Nome da Peça") as HTMLInputElement).value).toBe("");
  });

  it("indica uma peça semelhante e permite usar o cadastro existente antes de duplicá-lo", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.change(screen.getByLabelText("Nome da Peça"), {
      target: { value: "SUPORTE DE PLACA CG 150" },
    });

    expect(screen.getByText("Já existe uma peça parecida")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Usar existente: RK-792/i }));
    expect(screen.getByRole("button", { name: /Peça existente.*SUPORTE DE PLACA/i })).toBeTruthy();
  });

  it("não deixa texto livre anexar uma unidade à primeira peça do catálogo", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.click(screen.getByRole("button", { name: /^Usar existente/i }));
    fireEvent.click(screen.getByRole("button", { name: /Peça existente/ }));
    fireEvent.change(screen.getByPlaceholderText("Buscar…"), {
      target: { value: "uma peça que não está no catálogo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByRole("alert").textContent).toContain("Escolha a peça existente antes de continuar.");
  });

  it("fecha o menu de ações com Escape", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: /Ações de RK-810-01/i }));
    expect(screen.getByRole("menuitem", { name: /Editar unidade/i })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menuitem", { name: /Editar unidade/i })).toBeNull();
  });

  it("mostra a categoria escolhida na conferência final e move o foco para cada etapa", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.change(screen.getByLabelText("Nome da Peça"), {
      target: { value: "Nova peça com categoria" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Categoria/ }));
    fireEvent.click(screen.getByRole("option", { name: "Escapamentos" }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(document.activeElement).toBe(screen.getByLabelText("Preço da unidade"));

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Prateleira e seção/ }));

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByText("Categoria")).toBeTruthy();
    expect(screen.getByText("Escapamentos")).toBeTruthy();
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
    expect(screen.getByRole("region", { name: "Lista de itens do estoque" })).toBeTruthy();
    expect(screen.queryByText("SUPORTE DE PLACA (RABETA) CG 150")).toBeNull();
  });

  it("apresenta todas as peças existentes em um dropdown animado", () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.click(screen.getByRole("button", { name: /Usar existente/i }));
    fireEvent.click(screen.getByRole("button", { name: /Peça existente/ }));

    expect(screen.getByRole("option", { name: /RK-810/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /RK-792/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /RK-315/ })).toBeTruthy();
  });

  it("mantém o painel de itens rolável sem barra visível e expõe o ritmo de organização", () => {
    render(<EstoquePreview />);

    const viewport = screen.getByRole("region", { name: "Lista de itens do estoque" });
    expect(viewport.className).toContain("overflow-hidden");
    expect(screen.getByText("Ritmo de organização")).toBeTruthy();
    expect(screen.getByText(/Role dentro do painel/)).toBeTruthy();
  });

  it("abre o cadastro, salva uma unidade e mostra a nova unidade", async () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.change(screen.getByLabelText("Nome da Peça"), {
      target: { value: "Nova peça demonstrativa" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Categoria Escolha uma categoria/i }));
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(screen.getByRole("dialog", { name: /Nova peça e primeira unidade/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar unidade/i }));

    expect(screen.getByText(/Unidade adicionada/)).toBeTruthy();
    const scrollViewport = screen.getByRole("region", { name: "Lista de itens do estoque" }).firstElementChild as HTMLElement;
    Object.defineProperties(scrollViewport, { scrollTop: { value: 900, configurable: true }, clientHeight: { value: 200, configurable: true }, scrollHeight: { value: 1000, configurable: true } });
    fireEvent.scroll(scrollViewport);
    await waitFor(() => expect(screen.getByText("NOVO-001-01")).toBeTruthy());
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

  it("busca e designa várias categorias na mesma seção do mapa", () => {
    render(<EstoquePreview />);
    fireEvent.click(screen.getByRole("tab", { name: /Mapa físico/i }));

    expect(screen.getByRole("region", { name: "Mapa físico do estoque" })).toBeTruthy();
    expect(screen.getAllByText(/P01-S/)).toHaveLength(8);
    fireEvent.click(screen.getAllByRole("button", { name: "Designar categorias" })[1]);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar categoria/ }));
    fireEvent.click(screen.getByRole("option", { name: "Escapamentos" }));
    expect(screen.getByRole("button", { name: "Remover Escapamentos de P01-S02" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar categoria/ }));
    fireEvent.click(screen.getByRole("option", { name: "Embreagem" }));
    expect(screen.getByRole("button", { name: "Remover Embreagem de P01-S02" })).toBeTruthy();
  });

  it("reserva uma unidade para um cliente cadastrado e libera depois", async () => {
    render(<EstoquePreview />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhes de RK-810-01" }));
    fireEvent.click(screen.getByRole("button", { name: /^Reservar$/ }));

    const confirmar = screen.getByRole("button", { name: /Confirmar reserva/ }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);

    const campoCliente = screen.getByLabelText("Cliente da reserva");
    fireEvent.focus(campoCliente);
    fireEvent.change(campoCliente, { target: { value: "demonstração A" } });
    fireEvent.mouseDown(screen.getByRole("button", { name: /Cliente demonstração A/ }));
    expect(screen.getByText("Cliente cadastrado vinculado à reserva.")).toBeTruthy();
    expect(screen.getByText(/^Vence em .*às 18h\.$/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar reserva/ }));

    const reserva = await screen.findByRole("region", { name: "Reserva ativa" });
    expect(reserva.textContent).toContain("Cliente demonstração A");
    expect(reserva.textContent).toContain("Cliente cadastrado");
    expect(reserva.textContent).toContain("(83) 90000-0001");
    expect(screen.queryByRole("button", { name: /^Reservar$/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Liberar reserva/ }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Reserva ativa" })).toBeNull());
    expect(screen.getByRole("button", { name: /^Reservar$/ })).toBeTruthy();
  });

  it("aceita reserva de balcão só com o nome e bloqueia prazo inválido", async () => {
    render(<EstoquePreview />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhes de RK-810-01" }));
    fireEvent.click(screen.getByRole("button", { name: /^Reservar$/ }));
    fireEvent.change(screen.getByLabelText("Cliente da reserva"), { target: { value: "Pedro do balcão" } });
    fireEvent.change(screen.getByLabelText("Prazo da reserva em dias"), { target: { value: "45" } });
    expect((screen.getByRole("button", { name: /Confirmar reserva/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Prazo da reserva em dias"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar reserva/ }));
    const reserva = await screen.findByRole("region", { name: "Reserva ativa" });
    expect(reserva.textContent).toContain("Pedro do balcão");
    expect(reserva.textContent).toContain("Sem cadastro de cliente");
  });
});
