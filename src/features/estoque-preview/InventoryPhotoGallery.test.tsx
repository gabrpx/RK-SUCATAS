// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InventoryPhotoGallery } from "./InventoryPhotoGallery";

afterEach(cleanup);

describe("InventoryPhotoGallery", () => {
  it("mostra cada foto inteira e oferece pontos discretos para navegar", () => {
    render(<InventoryPhotoGallery fotos={["foto-a.jpg", "foto-b.jpg", "foto-c.jpg"]} sku="RK-010-01" origem="unidade" />);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getAllByRole("img")[0].className).toContain("object-contain");
    expect(screen.getAllByRole("img")[0].parentElement?.className).toContain("aspect-[4/3]");
    expect(screen.getAllByRole("button", { name: /Mostrar foto/ })).toHaveLength(3);
    expect(screen.getByLabelText("Fotos da unidade")).toBeTruthy();
  });

  it("identifica fotos do produto quando não há fotos próprias da unidade", () => {
    render(<InventoryPhotoGallery fotos={["produto.jpg"]} sku="RK-010-01" origem="produto" />);
    expect(screen.getByAltText("Fotos do produto, foto 1, unidade RK-010-01")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mostrar foto/ })).toBeNull();
  });
});
