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

export function getReminderCountdown(reminder: Reminder | null, now: number) {
  if (!reminder) return { state: "vazio" as const, totalSeconds: 0 };

  const difference = reminder.dueAt - now;
  return {
    state: difference < 0 ? "atrasado" as const : "restante" as const,
    totalSeconds: Math.ceil(Math.abs(difference) / 1000),
  };
}
