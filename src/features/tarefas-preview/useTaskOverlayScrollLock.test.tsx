// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useTaskOverlayScrollLock } from "./useTaskOverlayScrollLock";

function Overlay({ open }: { open: boolean }) {
  useTaskOverlayScrollLock(open);
  return null;
}

describe("useTaskOverlayScrollLock", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.overflow = "";
    document.documentElement.style.overscrollBehavior = "";
    document.body.style.overflow = "";
    document.body.style.overscrollBehavior = "";
  });

  it("bloqueia o scroll do fundo e restaura os estilos ao fechar", () => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "scroll";

    const view = render(<Overlay open />);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.overscrollBehavior).toBe("none");

    view.rerender(<Overlay open={false} />);
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("scroll");
    expect(document.body.style.overscrollBehavior).toBe("");
  });
});
