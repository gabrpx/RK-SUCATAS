import assert from "node:assert/strict";
import test from "node:test";
import {
  countActiveReminders,
  filterReminders,
  formatReminderClock,
  getMostUrgentReminder,
  getReminderPrioritySummary,
  getReminderCountdown,
  getReminderSchedule,
  getReminderSnoozeTarget,
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

test("conta apenas lembretes ativos para o contador da aba", () => {
  assert.equal(countActiveReminders(reminders), 2);
  assert.equal(countActiveReminders([]), 0);
});

test("o adiamento calcula e expõe o novo horário antes de ser confirmado", () => {
  const now = 1_000_000;
  const target = getReminderSnoozeTarget(reminders[1], now, 30);

  // o lembrete está atrasado: o adiamento parte de agora, não do prazo vencido
  assert.equal(target.dueAt, now + 30 * 60 * 1000);
  assert.equal(target.clock, formatReminderClock(target.dueAt));
  assert.ok(target.dueLabel.includes(target.clock));

  const future = getReminderSnoozeTarget(reminders[0], now, 30);
  assert.equal(future.dueAt, reminders[0].dueAt + 30 * 60 * 1000);
});

test("os presets de quando lembrar geram prazo e rótulo coerentes", () => {
  const now = 1_000_000;

  assert.equal(getReminderSchedule("30min", now).dueAt, now + 30 * 60 * 1000);
  assert.equal(getReminderSchedule("1h", now).dueAt, now + 60 * 60 * 1000);
  assert.equal(getReminderSchedule("3h", now).dueAt, now + 180 * 60 * 1000);

  const tomorrow = getReminderSchedule("amanha", now);
  assert.equal(tomorrow.dueAt, now + 24 * 60 * 60 * 1000);
  assert.ok(tomorrow.dueLabel.startsWith("Amanhã"));
  assert.ok(getReminderSchedule("1h", now).dueLabel.startsWith("Hoje"));
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
