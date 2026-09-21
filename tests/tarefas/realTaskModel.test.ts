import assert from "node:assert/strict";
import { test } from "vitest";
import {
  toPreviewReminder,
  toPreviewTask,
  type RealReminderRecord,
  type RealTaskRecord,
} from "../../src/features/tarefas/realTaskModel.ts";

const user = (id: string, nome_exibicao: string) => ({ id, nome_exibicao });

test("converte tarefa real com checklist e participantes para o modelo visual", () => {
  const task: RealTaskRecord = {
    id: "task-1",
    titulo: "Separar peças para despacho",
    descricao: "Conferir o pedido antes da coleta.",
    prazo: "2026-09-18T18:30:00.000Z",
    status: "pendente",
    prioridade: "alta",
    tipo: "geral",
    atribuido_para: "u1",
    atribuido: user("u1", "Ayrton"),
    itens: [
      { id: "item-1", texto: "Conferir código", concluido: true, concluido_em: "2026-09-18T17:00:00.000Z", concluido_por: "u1" },
      { id: "item-2", texto: "Embalar pedido", concluido: false, concluido_em: null, concluido_por: null },
    ],
    participantes: [{ id: "part-1", usuario_id: "u1", concluido: false, concluido_em: null, lida: true, usuario: user("u1", "Ayrton") }],
  };

  assert.deepEqual(toPreviewTask(task, "2026-09-18T17:30:00.000Z"), {
    id: "task-1",
    title: "Separar peças para despacho",
    area: "Despacho",
    category: "despacho",
    priority: "alta",
    status: "aguardando",
    dueLabel: "Hoje às 15:30",
    estimateMinutes: 30,
    operatorIds: ["u1"],
    instructions: "Conferir o pedido antes da coleta.",
    checklist: [
      { id: "item-1", label: "Conferir código", completed: true, owner: "u1", completedAt: "2026-09-18T17:00:00.000Z" },
      { id: "item-2", label: "Embalar pedido", completed: false, owner: "u1" },
    ],
  });
});

test("converte lembrete real recorrente sem inventar canais", () => {
  const reminder: RealReminderRecord = {
    id: "rem-1",
    titulo: "Confirmar coleta",
    descricao: "Checar a janela com o transportador.",
    status: "pendente",
    intervalo_minutos: 60,
    proxima_notificacao_em: "2026-09-18T18:00:00.000Z",
    atribuido_para: "u2",
    atribuido: user("u2", "Ryan"),
  };

  const converted = toPreviewReminder(reminder, "2026-09-18T17:30:00.000Z");
  assert.equal(converted.id, "rem-1");
  assert.equal(converted.status, "ativo");
  assert.equal(converted.recurrence, "A cada 60 min");
  assert.deepEqual(converted.channels, ["Tela"]);
  assert.equal(converted.area, "Tarefas");
});
