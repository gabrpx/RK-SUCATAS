import { describe, expect, it } from "vitest";
import { mapParticipantReadReceipts, mergePreviewTasksFromServer, startPreviewTask } from "./taskPreviewModel";
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

describe("mergePreviewTasksFromServer", () => {
  it("preserva em-andamento durante o polling quando o servidor ainda retorna aguardando", () => {
    const local = [{ ...pendingTask, status: "em-andamento" as const }];
    const incoming = [{ ...pendingTask, title: "Título atualizado" }];

    expect(mergePreviewTasksFromServer(local, incoming)).toEqual([
      { ...incoming[0], status: "em-andamento" },
    ]);
  });

  it("aceita a conclusão persistida pelo servidor", () => {
    const local = [{ ...pendingTask, status: "em-andamento" as const }];
    const incoming = [{ ...pendingTask, status: "concluida" as const }];

    expect(mergePreviewTasksFromServer(local, incoming)).toEqual(incoming);
  });
});

describe("mapParticipantReadReceipts", () => {
  it("keeps each employee's read status and tolerates missing user joins", () => {
    expect(mapParticipantReadReceipts([
      { usuario_id: "u-1", lida: true, usuario: { nome_exibicao: "Ana Lima" } },
      { usuario_id: "u-2", lida: false, usuario: null },
    ])).toEqual([
      { userId: "u-1", name: "Ana Lima", read: true },
      { userId: "u-2", name: "Funcionário", read: false },
    ]);
  });
});
