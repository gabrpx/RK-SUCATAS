// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BulkInventoryComposer } from "./BulkInventoryComposer";

afterEach(cleanup);

vi.mock("./InventoryDrawer", () => ({
  InventoryDrawer: ({ isOpen, children, footer }: { isOpen: boolean; children: React.ReactNode; footer: React.ReactNode }) => isOpen ? <div>{children}<footer>{footer}</footer></div> : null,
  InventoryDialog: ({ isOpen, title, description, footer }: { isOpen: boolean; title: string; description: string; footer: React.ReactNode }) => isOpen ? <div role="dialog"><h2>{title}</h2><p>{description}</p>{footer}</div> : null,
}));

vi.mock("../estoque/EstoqueUploadFotos", () => ({
  EstoqueUploadFotos: ({ onArquivosSelecionados }: { onArquivosSelecionados: (files: File[]) => void }) => <button type="button" onClick={() => onArquivosSelecionados([new File(["foto"], "farol.jpg", { type: "image/jpeg" }), new File(["foto-2"], "farol-lado.jpg", { type: "image/jpeg" })])}>Escolher foto</button>,
}));

vi.mock("@/src/components/ui/Combobox", () => ({
  Combobox: ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => <label>{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Escolha</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>,
}));

const categorias = [{ id: "cat-farol", nome: "Farol", parent_id: null, ordem: 0 }];
const modelos = [{ id: "moto-cg", nome: "CG 160", parent_id: null, ordem: 0, ano: null, imagem_url: null }];
const pecas = [{ id: "peca-farol", codigoLegado: "RK-001", nome: "Farol CG 160", categoriaId: "cat-farol", compatibilidades: ["CG 160"], detalhes: "", origemDado: "real" as const }];

function preencher(nome: string) {
  fireEvent.change(screen.getByLabelText("Nome da peça"), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "cat-farol" } });
  fireEvent.change(screen.getByLabelText("Moto compatível"), { target: { value: "CG 160" } });
}

describe("BulkInventoryComposer", () => {
  it("enfileira peças, permite remover uma e mostra a quantidade no botão final", () => {
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} pecas={pecas} onFechar={() => {}} onSalvarItem={vi.fn()} />);

    preencher("Farol CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(screen.getByText("Farol CG 160")).toBeTruthy();
    expect(screen.getByRole("button", { name: /concluir adições \(1\)/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /remover farol cg 160/i }));
    expect(screen.queryByText("Farol CG 160")).toBeNull();
  });

  it("salva a fila e exibe o resumo de sucesso", async () => {
    const onSalvarItem = vi.fn().mockResolvedValue(undefined);
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} pecas={pecas} onFechar={() => {}} onSalvarItem={onSalvarItem} />);

    preencher("Farol CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    preencher("Farol auxiliar CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: /concluir adições \(2\)/i }));

    await waitFor(() => expect(onSalvarItem).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Tudo salvo no estoque")).toBeTruthy();
    expect(screen.getByText(/2 peças foram adicionadas/i)).toBeTruthy();
  });

  it("enfileira uma unidade de peça existente sem transformar o cadastro em peça nova", async () => {
    const onSalvarItem = vi.fn().mockResolvedValue(undefined);
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} pecas={pecas} onFechar={() => {}} onSalvarItem={onSalvarItem} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar existente" }));
    fireEvent.click(screen.getByRole("option", { name: /Farol CG 160/ }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: /concluir adições \(1\)/i }));

    await waitFor(() => expect(onSalvarItem).toHaveBeenCalledWith(expect.objectContaining({ modo: "existente", pecaId: "peca-farol", nome: "Farol CG 160" })));
    expect(await screen.findByText("Tudo salvo no estoque")).toBeTruthy();
  });

  it("mantém todas as fotos selecionadas na fila", async () => {
    const onSalvarItem = vi.fn().mockResolvedValue(undefined);
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} pecas={pecas} onFechar={() => {}} onSalvarItem={onSalvarItem} />);

    preencher("Farol CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Escolher foto" }));
    expect(screen.getByText("farol.jpg")).toBeTruthy();
    expect(screen.getByText("farol-lado.jpg")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: /concluir adições \(1\)/i }));

    await waitFor(() => expect(onSalvarItem).toHaveBeenCalledWith(expect.objectContaining({ fotos: expect.arrayContaining([expect.objectContaining({ name: "farol.jpg" }), expect.objectContaining({ name: "farol-lado.jpg" })]) })));
  });

  it("permite editar um item da fila sem duplicá-lo e preserva o grau", async () => {
    const onSalvarItem = vi.fn().mockResolvedValue(undefined);
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} pecas={pecas} onFechar={() => {}} onSalvarItem={onSalvarItem} />);

    preencher("Farol CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Grau A" }));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Farol CG 160" }));
    fireEvent.change(screen.getByLabelText("Nome da peça"), { target: { value: "Farol CG 160 revisado" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar item" }));
    expect(screen.getByText("Farol CG 160 revisado")).toBeTruthy();
    expect(screen.getByRole("button", { name: /concluir adições \(1\)/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /concluir adições \(1\)/i }));

    await waitFor(() => expect(onSalvarItem).toHaveBeenCalledWith(expect.objectContaining({ nome: "Farol CG 160 revisado", grau: "A" })));
  });

  it("protege a fila ao cancelar e só descarta após confirmação", () => {
    const onFechar = vi.fn();
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} pecas={pecas} onFechar={onFechar} onSalvarItem={vi.fn()} />);

    preencher("Farol CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar adicionando" }));
    expect(onFechar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair e descartar" }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});
