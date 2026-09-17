import assert from "node:assert/strict";
import test from "node:test";
import {
  filterReminders,
  getMostUrgentReminder,
  getReminderPrioritySummary,
  getReminderCountdown,
  type Reminder,
} from "../../src/features/tarefas-preview/reminderModel.ts";

const reminders: Reminder[] = [
  {
    id: "medium",
    title: "Conferir bancada",
    description: "Revisar ferramenta antes do turno.",
    area: "Manutenção",
    priority: "media",
    dueLabel: "Hoje às 17:15",
    dueAt: 1_800_000,
    status: "ativo",
    recurrence: "Semanal",
    channels: ["Tela"],
  },
  {
    id: "critical",
    title: "Liberar retenção da transportadora",
    description: "Evita retenção do lote de despacho.",
    area: "Expedição",
    priority: "critica",
    dueLabel: "Atrasado há 15 min",
    dueAt: 300_000,
    status: "ativo",
    recurrence: "Único",
    channels: ["Coletor"],
  },
  {
    id: "high-completed",
    title: "Retornar orçamento",
    description: "Confirmar prazo com a oficina.",
    area: "Balcão",
    priority: "alta",
    dueLabel: "Concluído",
    dueAt: 0,
    status: "concluido",
    recurrence: "Único",
    channels: ["Tela"],
  },
];

test("prioriza o lembrete crítico ativo e informa sua contagem", () => {
  assert.deepEqual(getReminderPrioritySummary(reminders), {
    priority: "critica",
    count: 1,
    reminderId: "critical",
  });
});

test("encontra o lembrete operacional mais urgente e informa o tempo restante", () => {
  const urgent = getMostUrgentReminder(reminders);

  assert.equal(urgent?.id, "critical");
  assert.deepEqual(getReminderCountdown(urgent, 600_000), {
    state: "atrasado",
    totalSeconds: 300,
  });
  assert.deepEqual(getReminderCountdown(reminders[0], 600_000), {
    state: "restante",
    totalSeconds: 1200,
  });
});

test("filtra por estado e procura texto sem perder a ordem por urgência", () => {
  assert.deepEqual(
    filterReminders(reminders, "ativos", "").map((reminder) => reminder.id),
    ["critical", "medium"]
  );
  assert.deepEqual(
    filterReminders(reminders, "todos", "orçamento").map((reminder) => reminder.id),
    ["high-completed"]
  );
});
