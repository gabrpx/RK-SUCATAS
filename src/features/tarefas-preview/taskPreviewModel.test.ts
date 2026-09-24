import { describe, expect, it } from "vitest";
import { startPreviewTask } from "./taskPreviewModel";
import type { PreviewTask } from "./taskPreviewModel";

const pendingTask: PreviewTask = {
  id: "task-1",
  title: "Montar XRE",
  area: "Estoque",
  category: "estoque",
  priority: "normal",
  status: "aguardando",
  dueLabel: "Hoje, sem horário",
  estimateMinutes: 30,
  checklist: [],
  operatorIds: ["u-1"],
};

describe("startPreviewTask", () => {
  it("moves a waiting task to in-progress without completing it", () => {
    const started = startPreviewTask(pendingTask);

    expect(started.status).toBe("em-andamento");
    expect(started).not.toBe(pendingTask);
  });
});
