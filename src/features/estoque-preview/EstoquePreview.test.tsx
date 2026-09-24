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
    expect(screen.getByText(/inclui quantidades legadas sem ficha/)).toBeTruthy();
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

  it("fecha o menu de ações com Escape", async () => {
    render(<EstoquePreview />);

    fireEvent.click(screen.getByRole("button", { name: /Ações de RK-810-01/i }));
    expect(screen.getByRole("menuitem", { name: /Editar unidade/i })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("menuitem", { name: /Editar unidade/i })).toBeNull());
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

  it("usa as abas segmentadas da tela Tarefas e troca o painel com animação", async () => {
    render(<EstoquePreview />);

    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Atendimento/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Atendimento" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Organizar/ }));
    expect(await screen.findByRole("tabpanel", { name: "Organizar" })).toBeTruthy();
  });

  it("busca por código legado e alterna para lista", async () => {
    render(<EstoquePreview />);

    fireEvent.change(screen.getByRole("searchbox", { name: /Buscar no estoque/i }), {
      target: { value: "RK-315" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualização em lista" }));

    await waitFor(() => expect(screen.getAllByText("ESCAPAMENTO HONDA CB TWISTER 250F")).toHaveLength(1));
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

    fireEvent.click(await screen.findByRole("tab", { name: /Arquivados/i }));
    expect(await screen.findByText("RK-810-01")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Restaurar RK-810-01/i }));
    expect(await screen.findByText(/Unidade restaurada/)).toBeTruthy();
  });

  it("busca e designa várias categorias na mesma seção do mapa", async () => {
    render(<EstoquePreview />);
    fireEvent.click(screen.getByRole("tab", { name: /Mapa físico/i }));

    expect(await screen.findByRole("region", { name: "Mapa físico do estoque" })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(/P01-S/)).toHaveLength(8));
    fireEvent.click(screen.getAllByRole("button", { name: "Designar categorias" })[1]);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar categoria/ }));
    fireEvent.click(screen.getByRole("option", { name: "Escapamentos" }));
    expect(screen.getByRole("button", { name: "Remover Escapamentos de P01-S02" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar categoria/ }));
    fireEvent.click(screen.getByRole("option", { name: "Embreagem" }));
    expect(screen.getByRole("button", { name: "Remover Embreagem de P01-S02" })).toBeTruthy();
  });

  it("reserva uma unidade para um cliente cadastrado com sinal e libera depois", async () => {
    render(<EstoquePreview />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhes de RK-810-01" }));
    fireEvent.click(screen.getByRole("button", { name: /^Reservar$/ }));

    const campoCliente = await screen.findByLabelText("Cliente da reserva");
    const confirmar = screen.getByRole("button", { name: /Confirmar reserva/ }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);

    fireEvent.focus(campoCliente);
    fireEvent.change(campoCliente, { target: { value: "demonstração A" } });
    fireEvent.mouseDown(screen.getByRole("button", { name: /Cliente demonstração A/ }));
    expect(screen.getByText("Cliente cadastrado vinculado à reserva.")).toBeTruthy();
    expect(screen.getByText(/^Vence em .*\(7 × 24 h a partir de agora\)\.$/)).toBeTruthy();
    // Sinal vem preenchido com 20% do preço; sem forma de pagamento não confirma.
    expect((screen.getByLabelText("Valor do sinal") as HTMLInputElement).value).toBe("30,00");
    expect(confirmar.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Forma de pagamento do sinal/ }));
    fireEvent.click(screen.getByRole("option", { name: "PIX" }));

    fireEvent.click(screen.getByRole("button", { name: /Confirmar reserva/ }));

    const reserva = await screen.findByRole("region", { name: "Reserva ativa" });
    expect(reserva.textContent).toContain("Cliente demonstração A");
    expect(reserva.textContent).toContain("Cliente cadastrado");
    expect(reserva.textContent).toContain("(83) 90000-0001");
    expect(reserva.textContent).toContain("Sinal de R$");
    expect(screen.queryByRole("button", { name: /^Reservar$/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Liberar reserva/ }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Reserva ativa" })).toBeNull());
    expect(screen.getByRole("button", { name: /^Reservar$/ })).toBeTruthy();
  });

  it("aceita reserva de balcão só com o nome, bloqueia prazo inválido e sinal abaixo de 20%", async () => {
    render(<EstoquePreview />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhes de RK-810-01" }));
    fireEvent.click(screen.getByRole("button", { name: /^Reservar$/ }));
    fireEvent.change(await screen.findByLabelText("Cliente da reserva"), { target: { value: "Pedro do balcão" } });
    fireEvent.click(screen.getByRole("button", { name: /Forma de pagamento do sinal/ }));
    fireEvent.click(screen.getByRole("option", { name: "DINHEIRO" }));
    fireEvent.change(screen.getByLabelText("Prazo da reserva em dias"), { target: { value: "45" } });
    expect((screen.getByRole("button", { name: /Confirmar reserva/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Prazo da reserva em dias"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Valor do sinal"), { target: { value: "29,99" } });
    expect((screen.getByRole("button", { name: /Confirmar reserva/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Valor do sinal"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar reserva/ }));
    const reserva = await screen.findByRole("region", { name: "Reserva ativa" });
    expect(reserva.textContent).toContain("Pedro do balcão");
    expect(reserva.textContent).toContain("Sem cadastro de cliente");
    expect(reserva.textContent).toMatch(/Sinal de R\$\s50,00/);
  });

  it("não oferece reserva para unidade sem preço e aponta para a edição", async () => {
    render(<EstoquePreview />);
    fireEvent.click(screen.getByRole("button", { name: /Ações de RK-810-01/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Editar unidade/i }));
    fireEvent.change(await screen.findByLabelText("Preço da unidade"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhes de RK-810-01" }));
    expect(await screen.findByText(/Defina o preço antes de reservar/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Reservar$/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Definir preço" })).toBeTruthy();
  });

  it("mostra na aba Histórico os eventos registrados, com data e autoria", async () => {
    render(<EstoquePreview />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalhes de RK-792-03" }));
    fireEvent.click(screen.getByRole("tab", { name: /Histórico/ }));
    expect(await screen.findByText("Linha do tempo registrada")).toBeTruthy();
    expect(await screen.findByText("Reservada para Cliente demonstração A")).toBeTruthy();
    expect(screen.getAllByText(/Sinal de R\$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/autor não registrado/)).toBeTruthy();
    expect(screen.queryByText("Rastreabilidade preservada")).toBeNull();
  });

  it("separa localizadas de disponíveis numa faixa de indicadores igual à de Tarefas", () => {
    render(<EstoquePreview />);
    const resumo = screen.getByRole("region", { name: "Resumo operacional do estoque" });
    expect(resumo.textContent).toContain("Disponíveis");
    expect(resumo.textContent).toContain("Localizadas");
    expect(resumo.textContent).toContain("reservadas continuam no mesmo lugar");
    // Mesmo comportamento da faixa de Tarefas: no celular desliza de lado,
    // sem empurrar a página inteira para os lados.
    expect(resumo.className).toContain("overflow-x-auto");
    expect(resumo.firstElementChild?.className).toContain("min-w-[920px]");
  });

  it("oferece Adicionar unidade como botão na lista quando a peça está sem estoque", async () => {
    render(<EstoquePreview />);
    fireEvent.change(screen.getByRole("searchbox", { name: /Buscar no estoque/i }), { target: { value: "RK-825" } });
    fireEvent.click(screen.getByRole("button", { name: "Visualização em lista" }));
    const adicionar = await screen.findAllByRole("button", { name: "Adicionar unidade a RK-825" });
    fireEvent.click(adicionar[adicionar.length - 1]);
    expect(await screen.findByRole("dialog", { name: "Nova peça e primeira unidade" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Peça existente.*FAROL DIANTEIRO/i })).toBeTruthy();
  });

  it("Escape fecha primeiro a lista do combobox e só depois o drawer", async () => {
    render(<EstoquePreview />);
    fireEvent.click(screen.getByRole("button", { name: "Nova peça" }));
    fireEvent.click(screen.getByRole("button", { name: /Categoria Escolha uma categoria/i }));
    const busca = screen.getByPlaceholderText("Buscar…");
    fireEvent.keyDown(busca, { key: "Escape" });
    await waitFor(() => expect(screen.queryByPlaceholderText("Buscar…")).toBeNull());
    expect(screen.getByRole("dialog", { name: "Nova peça e primeira unidade" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Categoria Escolha uma categoria/i }));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nova peça e primeira unidade" })).toBeNull());
  });
});
