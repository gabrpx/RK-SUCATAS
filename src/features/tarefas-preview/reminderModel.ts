export type ReminderPriority = "critica" | "alta" | "media" | "baixa";
export type ReminderStatus = "ativo" | "concluido";
export type ReminderFilter = "todos" | "ativos" | "atrasados" | "concluidos";

export interface Reminder {
  id: string;
  title: string;
  description: string;
  area: string;
  priority: ReminderPriority;
  dueLabel: string;
  dueAt: number;
  status: ReminderStatus;
  recurrence: string;
  channels: string[];
  isOverdue?: boolean;
}

const priorityWeight: Record<ReminderPriority, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function sortRemindersByPriority(reminders: Reminder[]) {
  return [...reminders].sort(
    (first, second) => priorityWeight[first.priority] - priorityWeight[second.priority]
  );
}

export function filterReminders(
  reminders: Reminder[],
  filter: ReminderFilter,
  query: string
) {
  const normalizedQuery = normalize(query.trim());

  return sortRemindersByPriority(reminders).filter((reminder) => {
    const matchesFilter =
      filter === "todos" ||
      (filter === "ativos" && reminder.status === "ativo") ||
      (filter === "atrasados" && reminder.isOverdue) ||
      (filter === "concluidos" && reminder.status === "concluido");
    const searchable = normalize(
      `${reminder.title} ${reminder.description} ${reminder.area} ${reminder.priority}`
    );

    return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}

export function getReminderPrioritySummary(reminders: Reminder[]) {
  const activeReminders = sortRemindersByPriority(
    reminders.filter((reminder) => reminder.status === "ativo")
  );
  const highest = activeReminders[0];

  if (!highest) return { priority: null, count: 0, reminderId: null };

  return {
    priority: highest.priority,
    count: activeReminders.filter(
      (reminder) => reminder.priority === highest.priority
    ).length,
    reminderId: highest.id,
  };
}

export function getMostUrgentReminder(reminders: Reminder[]) {
  const activeReminders = reminders.filter((reminder) => reminder.status === "ativo");

  return [...activeReminders].sort((first, second) => {
    const overdueDifference = Number(Boolean(second.isOverdue)) - Number(Boolean(first.isOverdue));
    if (overdueDifference) return overdueDifference;

    const priorityDifference = priorityWeight[first.priority] - priorityWeight[second.priority];
    if (priorityDifference) return priorityDifference;

    return first.dueAt - second.dueAt;
  })[0] ?? null;
}

/** Presets de "quando lembrar" oferecidos na criação (sem dropdown nativo). */
export type ReminderSchedulePreset = "30min" | "1h" | "3h" | "amanha";

export const reminderSchedulePresets: Array<{
  id: ReminderSchedulePreset;
  label: string;
  note: string;
  minutes: number;
}> = [
  { id: "30min", label: "Em 30 min", note: "Próxima meia hora", minutes: 30 },
  { id: "1h", label: "Em 1 hora", note: "Ainda neste turno", minutes: 60 },
  { id: "3h", label: "Em 3 horas", note: "Fim do turno", minutes: 180 },
  { id: "amanha", label: "Amanhã", note: "Abertura do próximo turno", minutes: 24 * 60 },
];

export function formatReminderClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getReminderSchedule(
  preset: ReminderSchedulePreset,
  now: number
): { dueAt: number; dueLabel: string } {
  const option =
    reminderSchedulePresets.find((item) => item.id === preset) ??
    reminderSchedulePresets[0];
  const dueAt = now + option.minutes * 60 * 1000;

  return {
    dueAt,
    dueLabel:
      preset === "amanha"
        ? `Amanhã às ${formatReminderClock(dueAt)}`
        : `Hoje às ${formatReminderClock(dueAt)} · ${option.label.toLocaleLowerCase("pt-BR")}`,
  };
}

/**
 * Alvo de um adiamento. A confirmação precisa mostrar o novo horário ANTES de
 * aplicar, por isso o cálculo é puro e reaproveitado pelo diálogo e pela ação.
 */
export function getReminderSnoozeTarget(
  reminder: Reminder,
  now: number,
  minutes = 30
): { dueAt: number; dueLabel: string; clock: string } {
  const base = Math.max(reminder.dueAt, now);
  const dueAt = base + minutes * 60 * 1000;
  const clock = formatReminderClock(dueAt);

  return { dueAt, clock, dueLabel: `Adiado · hoje às ${clock}` };
}

export function countActiveReminders(reminders: Reminder[]) {
  return reminders.filter((reminder) => reminder.status === "ativo").length;
}

export function getReminderCountdown(reminder: Reminder | null, now: number) {
  if (!reminder) return { state: "vazio" as const, totalSeconds: 0 };

  const difference = reminder.dueAt - now;
  return {
    state: difference < 0 ? "atrasado" as const : "restante" as const,
    totalSeconds: Math.ceil(Math.abs(difference) / 1000),
  };
}
