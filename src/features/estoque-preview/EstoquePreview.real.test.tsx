// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Modo real (/estoque dentro do app): API mockada, mesmo formato das rotas.
const mocks = vi.hoisted(() => ({
  listarEstoque: vi.fn(),
  atualizarUnidade: vi.fn(),
  organizarUnidade: vi.fn(),
  listarOrganizacao: vi.fn(),
  editarUnidade: vi.fn(),
  conferirBaixa: vi.fn(),
  baixarFichaExcedente: vi.fn(),
}));

vi.mock("../estoque/api", () => ({
  estoqueApi: { listar: mocks.listarEstoque, atualizarUnidade: mocks.atualizarUnidade, organizarUnidade: mocks.organizarUnidade },
}));
vi.mock("../../lib/catalogApi", () => ({
  categoriasApi: { listar: async () => ({ success: true, data: [{ id: "cat-1", nome: "Iluminação", parent_id: null, ordem: 1 }] }) },
  modelosMotoApi: { listar: async () => ({ success: true, data: [] }) },
  formasPagamentoApi: { listar: async () => ({ success: true, data: [{ id: "forma-1", nome: "PIX", natureza: "avista" }] }) },
}));
vi.mock("../clientes/api", () => ({ clientesApi: { listar: async () => ({ success: true, data: [] }) } }));
vi.mock("./organizacaoApi", () => ({
  RECURSOS_DEMONSTRACAO: { clienteNaReserva: true, reservaComSinal: true, baixaAutomatica: true },
  organizacaoApi: {
    listar: mocks.listarOrganizacao,
    editarUnidade: mocks.editarUnidade,
    conferirBaixa: mocks.conferirBaixa,
    baixarFichaExcedente: mocks.baixarFichaExcedente,
    historico: async () => ({ success: true, data: { eventos: [], autoriaRegistrada: true } }),
    descartarFotos: async () => ({ success: true, data: { descartadas: [] } }),
  },
  enviarFotoUnidade: vi.fn(),
}));

import { EstoquePreview } from "./EstoquePreview";

const ficha = (id: string, sku: number, extra: Record<string, unknown> = {}) => ({
  id, estoque_id: "peca-1", sku, nome: null, avaria: false, avaria_descricao: null, descricao: null, fotos: [], valor: 120,
  condicao_nota: 6, vendida_em: null, arquivada_em: null, endereco_id: "local-1", origem_identificacao: null,
  criado_em: "2026-09-01T10:00:00Z", atualizado_em: "2026-09-01T10:00:00Z", ...extra,
});
const peca = (id: string, codigo: string, nome: string, quantidade: number, unidades: unknown[]) => ({
  id, codigo, nome, categoria_id: "cat-1", categoria: { nome: "Iluminação" }, modelo_moto_id: null, modelo_moto: null, modelos_compativeis: [],
  condicao: "original", condicao_nota: 6, nota_cadastro: null, ano: null, valor: 120, quantidade, imagens: [], descricao: null,
  ativo: true, criado_em: "2026-09-01", atualizado_em: "2026-09-01", anuncio_ml_url: null, anuncio_fb_url: null, componentes: null,
  unidades_incompletas: [], unidades,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listarEstoque.mockResolvedValue({ success: true, data: [
    // Farol: 1 unidade vendida por baixa automática + 1 livre.
    peca("peca-1", "RK-900", "Farol CG 160", 1, [ficha("u1", 901, { vendida_em: "2026-09-24T10:00:00Z" }), ficha("u2", 902)]),
    // Pisca: quantidade 1, mas 2 fichas livres (venda antiga sem unidade).
    peca("peca-2", "RK-901", "Pisca Titan", 1, [ficha("s1", 911, { estoque_id: "peca-2" }), ficha("s2", 912, { estoque_id: "peca-2" })]),
  ] });
  mocks.listarOrganizacao.mockResolvedValue({ success: true, data: {
    locais: [{ id: "local-1", codigo: "A-01", deposito: "Principal", zona: "A", prateleira: "P1", secao: "S1", descricao: null, ativo: true }],
    categorias: [], reservas: [],
    baixasPendentes: [{ id: "b1", venda_id: "v1", unidade_id: "u1", estoque_id: "peca-1", criada_em: "2026-09-24T10:00:00Z", venda: { data: "2026-09-24", nome_item: "Farol CG 160", cliente_nome: "Balcão", valor_total: 120 } }],
    recursos: { clienteNaReserva: true, reservaComSinal: true, baixaAutomatica: true },
  } });
  mocks.editarUnidade.mockResolvedValue({ success: true, data: { id: "u2" } });
  mocks.conferirBaixa.mockResolvedValue({ success: true, data: { id: "b1" } });
  mocks.baixarFichaExcedente.mockResolvedValue({ success: true, data: { id: "s2" } });
});
afterEach(cleanup);

describe("EstoquePreview dentro do app (dados reais)", () => {
  it("usa a moldura do app e leva às ferramentas antigas", async () => {
    const abrirAntigo = vi.fn();
    render(<EstoquePreview embutido onAbrirEstoqueAntigo={abrirAntigo} />);
    expect(await screen.findByText("Estoque real · sincronizado")).toBeTruthy();
    // Mesma casca da tela Tarefas: cabeçalho claro com a marca e o estado da conexão.
    expect(screen.getByText("RK Sucatas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Anúncios e ferramentas antigas/ }));
    expect(abrirAntigo).toHaveBeenCalledTimes(1);
  });

  it("abre já filtrado quando vem do alerta de estoque baixo do Dashboard", async () => {
    const aplicado = vi.fn();
    render(<EstoquePreview embutido filtroEstoqueBaixoInicial onFiltroEstoqueBaixoAplicado={aplicado} />);
    await screen.findByText("Estoque real · sincronizado");
    expect(screen.getByRole("button", { name: "Estoque baixo (1–2)" }).getAttribute("aria-pressed")).toBe("true");
    expect(aplicado).toHaveBeenCalled();
  });

  it("mostra a conferência pendente e confirma a baixa automática", async () => {
    render(<EstoquePreview embutido />);
    expect(await screen.findByText("2 conferências pendentes.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Conferir agora/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Conferência do estoque" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar que 901 foi a vendida" }));
    await waitFor(() => expect(mocks.conferirBaixa).toHaveBeenCalledWith("b1", null));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Marcar 912 como já vendida" }));
    await waitFor(() => expect(mocks.baixarFichaExcedente).toHaveBeenCalledWith("s2"));
  });

  it("não conta a ficha sobrando como disponível e sinaliza no cartão da peça", async () => {
    render(<EstoquePreview embutido />);
    expect(await screen.findByText(/1 ficha sobrando fora da conta/)).toBeTruthy();
    expect(screen.getByText("1 ficha sobrando.")).toBeTruthy();
  });

  it("salva a edição da unidade numa única chamada", async () => {
    render(<EstoquePreview embutido />);
    await screen.findByText("Estoque real · sincronizado");
    fireEvent.click(screen.getByRole("button", { name: "Ações de 902" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Editar unidade/i }));
    fireEvent.change(await screen.findByLabelText("Preço da unidade"), { target: { value: "175" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    await waitFor(() => expect(mocks.editarUnidade).toHaveBeenCalledTimes(1));
    // Só o preço mudou: nota, endereço e origem não são reenviados.
    expect(mocks.editarUnidade).toHaveBeenCalledWith("u2", { valor: 175 });
    expect(mocks.atualizarUnidade).not.toHaveBeenCalled();
    expect(mocks.organizarUnidade).not.toHaveBeenCalled();
  });

  it("mostra o preço editado de imediato e restaura se a gravação falhar", async () => {
    let rejectUpdate: (reason: Error) => void = () => {};
    mocks.editarUnidade.mockImplementation(() => new Promise((_resolve, reject) => { rejectUpdate = reject; }));
    render(<EstoquePreview embutido />);
    await screen.findByText("Estoque real · sincronizado");
    fireEvent.click(screen.getByRole("button", { name: "Ações de 902" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Editar unidade/i }));
    fireEvent.change(await screen.findByLabelText("Preço da unidade"), { target: { value: "175" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    expect(document.body.textContent).toContain("175,00");
    rejectUpdate(new Error("Falha simulada"));
    await waitFor(() => expect(document.body.textContent).not.toContain("175,00"));
  });

  it("volta ao catálogo na mesma posição depois de trocar de aba", async () => {
    render(<EstoquePreview embutido />);
    await screen.findByText("Estoque real · sincronizado");
    const painel = () => within(screen.getByRole("region", { name: "Lista de itens do estoque" })).getByText(/Todos os itens carregados|Role para carregar/).parentElement as HTMLDivElement;
    painel().scrollTop = 240;
    fireEvent.scroll(painel());
    fireEvent.click(screen.getByRole("tab", { name: /Organizar/ }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Lista de itens do estoque" })).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: /Atendimento/ }));
    await screen.findByRole("region", { name: "Lista de itens do estoque" });
    await waitFor(() => expect(painel().scrollTop).toBe(240));
  });

  it("sem conexão, não mostra peças de demonstração dentro do app", async () => {
    mocks.listarEstoque.mockResolvedValue({ success: false, error: "Servidor fora do ar" });
    render(<EstoquePreview embutido />);
    expect(await screen.findByText("Não foi possível carregar o estoque.")).toBeTruthy();
    expect(screen.queryByText(/Rabeta/)).toBeNull();
    expect(screen.queryByRole("tab", { name: /Atendimento/ })).toBeNull();
    expect((screen.getByRole("button", { name: "Nova peça" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
