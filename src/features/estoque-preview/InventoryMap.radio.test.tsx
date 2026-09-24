// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrioridadeRadioGroup } from "./InventoryMap";

afterEach(cleanup);

describe("PrioridadeRadioGroup", () => {
  it("só a opção marcada entra no Tab e as setas movem o foco marcando a próxima", () => {
    const onEscolher = vi.fn();
    render(<PrioridadeRadioGroup rotulo="Prioridade de Farol em A-01" atual={1} onEscolher={onEscolher} />);
    const [principal, secundaria, eventual] = screen.getAllByRole("radio");
    expect(screen.getByRole("radiogroup", { name: "Prioridade de Farol em A-01" })).toBeTruthy();
    expect([principal.tabIndex, secundaria.tabIndex, eventual.tabIndex]).toEqual([0, -1, -1]);

    principal.focus();
    fireEvent.keyDown(principal, { key: "ArrowRight" });
    expect(onEscolher).toHaveBeenLastCalledWith(2);
    expect(document.activeElement).toBe(secundaria);

    fireEvent.keyDown(principal, { key: "ArrowLeft" });
    expect(onEscolher).toHaveBeenLastCalledWith(3);
    expect(document.activeElement).toBe(eventual);

    fireEvent.keyDown(eventual, { key: "Home" });
    expect(document.activeElement).toBe(principal);
    expect(onEscolher).toHaveBeenCalledTimes(2);
  });
});
