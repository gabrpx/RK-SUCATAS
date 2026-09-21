import assert from "node:assert/strict";
import { test } from "vitest";
import { getHorizontalOverflowState } from "../../src/features/tarefas-preview/previewOverflowModel.ts";

test("não mostra fades quando a faixa cabe inteira", () => {
  assert.deepEqual(
    getHorizontalOverflowState({ scrollLeft: 0, scrollWidth: 320, clientWidth: 320 }),
    { isScrollable: false, canScrollLeft: false, canScrollRight: false },
  );
});

test("mostra somente o fade de saída no início", () => {
  assert.deepEqual(
    getHorizontalOverflowState({ scrollLeft: 0, scrollWidth: 640, clientWidth: 320 }),
    { isScrollable: true, canScrollLeft: false, canScrollRight: true },
  );
});

test("mostra os dois fades no meio e somente o esquerdo no fim", () => {
  assert.deepEqual(
    getHorizontalOverflowState({ scrollLeft: 120, scrollWidth: 640, clientWidth: 320 }),
    { isScrollable: true, canScrollLeft: true, canScrollRight: true },
  );
  assert.deepEqual(
    getHorizontalOverflowState({ scrollLeft: 320, scrollWidth: 640, clientWidth: 320 }),
    { isScrollable: true, canScrollLeft: true, canScrollRight: false },
  );
});

test("tolera arredondamento de layout nos limites", () => {
  assert.deepEqual(
    getHorizontalOverflowState({ scrollLeft: 0.5, scrollWidth: 640.5, clientWidth: 320 }),
    { isScrollable: true, canScrollLeft: false, canScrollRight: true },
  );
  assert.deepEqual(
    getHorizontalOverflowState({ scrollLeft: 320.5, scrollWidth: 640.5, clientWidth: 320 }),
    { isScrollable: true, canScrollLeft: true, canScrollRight: false },
  );
});
