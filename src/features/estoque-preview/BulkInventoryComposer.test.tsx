// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BulkInventoryComposer } from "./BulkInventoryComposer";

afterEach(cleanup);

vi.mock("./InventoryDrawer", () => ({
  InventoryDrawer: ({ isOpen, children, footer }: { isOpen: boolean; children: React.ReactNode; footer: React.ReactNode }) => isOpen ? <div>{children}<footer>{footer}</footer></div> : null,
}));

vi.mock("../estoque/EstoqueUploadFotos", () => ({
  EstoqueUploadFotos: ({ onArquivosSelecionados }: { onArquivosSelecionados: (files: File[]) => void }) => <button type="button" onClick={() => onArquivosSelecionados([new File(["foto"], "farol.jpg", { type: "image/jpeg" })])}>Escolher foto</button>,
}));

vi.mock("@/src/components/ui/Combobox", () => ({
  Combobox: ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => <label>{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Escolha</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>,
}));

const categorias = [{ id: "cat-farol", nome: "Farol", parent_id: null, ordem: 0 }];
const modelos = [{ id: "moto-cg", nome: "CG 160", parent_id: null, ordem: 0, ano: null, imagem_url: null }];

function preencher(nome: string) {
  fireEvent.change(screen.getByLabelText("Nome da peça"), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "cat-farol" } });
  fireEvent.change(screen.getByLabelText("Moto compatível"), { target: { value: "CG 160" } });
}

describe("BulkInventoryComposer", () => {
  it("enfileira peças, permite remover uma e mostra a quantidade no botão final", () => {
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} onFechar={() => {}} onSalvarItem={vi.fn()} />);

    preencher("Farol CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(screen.getByText("Farol CG 160")).toBeTruthy();
    expect(screen.getByRole("button", { name: /concluir adições \(1\)/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /remover farol cg 160/i }));
    expect(screen.queryByText("Farol CG 160")).toBeNull();
  });

  it("salva a fila e exibe o resumo de sucesso", async () => {
    const onSalvarItem = vi.fn().mockResolvedValue(undefined);
    render(<BulkInventoryComposer aberto categorias={categorias} modelos={modelos} onFechar={() => {}} onSalvarItem={onSalvarItem} />);

    preencher("Farol CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    preencher("Farol auxiliar CG 160");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: /concluir adições \(2\)/i }));

    await waitFor(() => expect(onSalvarItem).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Tudo salvo no estoque")).toBeTruthy();
    expect(screen.getByText(/2 peças foram adicionadas/i)).toBeTruthy();
  });
});
