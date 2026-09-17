export type PreviewTaskStatus = "em-andamento" | "aguardando" | "concluida";
export type PreviewTaskPriority = "critica" | "alta" | "normal" | "baixa";
export type PreviewTaskCategory =
  | "despacho"
  | "organizacao"
  | "limpeza"
  | "estoque"
  | "outro";
export type PreviewPrimaryTab =
  | "turno"
  | "abertas"
  | "pendencias"
  | "concluidas";

export interface PreviewChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  owner: string;
  completedAt?: string;
}

export interface PreviewTask {
  id: string;
  title: string;
  area: string;
  category: PreviewTaskCategory;
  priority: PreviewTaskPriority;
  status: PreviewTaskStatus;
  dueLabel: string;
  estimateMinutes: number;
  checklist: PreviewChecklistItem[];
  operatorIds?: string[];
  instructions?: string;
}

export interface PreviewTaskCreateInput {
  id: string;
  title: string;
  category: PreviewTaskCategory;
  priority: PreviewTaskPriority;
  operatorIds: string[];
  instructions: string;
  checklistLabels: string[];
  checklistOwners?: string[];
  dueTime?: string;
}

export interface PreviewCategoryBreakdown {
  category: PreviewTaskCategory;
  total: number;
  open: number;
  completed: number;
  completionRate: number;
  share: number;
}

export interface PreviewTaskExecutionSummary {
  isCollaborative: boolean;
  responsibleCount: number;
  completedChecklistItems: number;
  totalChecklistItems: number;
  percentage: number;
  primaryAction: "Iniciar tarefa" | "Concluir tarefa" | "Reabrir tarefa";
}

export function getPreviewTaskDeadline(
  category: PreviewTaskCategory,
  dueTime?: string
) {
  if (category === "despacho") return "Hoje às 16:30";
  return dueTime ? `Hoje às ${dueTime}` : "Hoje, sem horário";
}

export function createPreviewTask(input: PreviewTaskCreateInput): PreviewTask {
  const owner = input.operatorIds[0] ?? "admin";

  return {
    id: input.id,
    title: input.title.trim(),
    area:
      input.category === "organizacao"
        ? "Organização"
        : input.category[0].toUpperCase() + input.category.slice(1),
    category: input.category,
    priority: input.priority,
    status: "aguardando",
    dueLabel: getPreviewTaskDeadline(input.category, input.dueTime),
    estimateMinutes: input.category === "despacho" ? 25 : 30,
    operatorIds: input.operatorIds,
    instructions: input.instructions.trim(),
    checklist: input.checklistLabels
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label, index) => ({
        id: `${input.id}-${index + 1}`,
        label,
        completed: false,
        owner: input.checklistOwners?.[index] ?? owner,
      })),
  };
}

export function getPreviewSummary(tasks: PreviewTask[]) {
  return tasks.reduce(
    (summary, task) => {
      if (task.status !== "concluida") summary.open += 1;
      if (task.status === "em-andamento") summary.inProgress += 1;
      summary.totalChecklistItems += task.checklist.length;
      summary.completedChecklistItems += task.checklist.filter(
        (item) => item.completed
      ).length;
      return summary;
    },
    {
      open: 0,
      inProgress: 0,
      completedChecklistItems: 0,
      totalChecklistItems: 0,
    }
  );
}

export function getPreviewCategoryBreakdown(
  tasks: PreviewTask[]
): PreviewCategoryBreakdown[] {
  const categories: PreviewTaskCategory[] = [
    "organizacao",
    "estoque",
    "limpeza",
    "despacho",
    "outro",
  ];
  const totalTasks = tasks.length;

  return categories.map((category) => {
    const categoryTasks = tasks.filter((task) => task.category === category);
    const completed = categoryTasks.filter(
      (task) => task.status === "concluida"
    ).length;
    const total = categoryTasks.length;

    return {
      category,
      total,
      open: total - completed,
      completed,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      share: totalTasks ? Math.round((total / totalTasks) * 100) : 0,
    };
  });
}

export function filterPreviewTasksByPrimaryTab(
  tasks: PreviewTask[],
  tab: PreviewPrimaryTab
) {
  if (tab === "turno") return tasks;
  if (tab === "abertas")
    return tasks.filter((task) => task.status !== "concluida");
  if (tab === "pendencias")
    return tasks.filter((task) => task.status === "aguardando");
  return tasks.filter((task) => task.status === "concluida");
}

export function getPreviewTaskExecutionSummary(
  task: PreviewTask
): PreviewTaskExecutionSummary {
  const totalChecklistItems = task.checklist.length;
  const completedChecklistItems = task.checklist.filter(
    (item) => item.completed
  ).length;
  const responsibleCount = task.operatorIds?.length ?? 1;

  return {
    isCollaborative: responsibleCount > 1,
    responsibleCount,
    completedChecklistItems,
    totalChecklistItems,
    percentage: totalChecklistItems
      ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
      : 0,
    primaryAction:
      task.status === "em-andamento"
        ? "Concluir tarefa"
        : task.status === "concluida"
        ? "Reabrir tarefa"
        : "Iniciar tarefa",
  };
}

export function getNextPreviewTaskStatus(
  status: PreviewTaskStatus
): PreviewTaskStatus {
  if (status === "aguardando") return "em-andamento";
  if (status === "em-andamento") return "concluida";
  return "aguardando";
}

export function filterPreviewTasks(
  tasks: PreviewTask[],
  filters: { query: string; status: "todas" | PreviewTaskStatus }
) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("pt-BR");

  return tasks.filter((task) => {
    const matchesStatus =
      filters.status === "todas" || task.status === filters.status;
    const searchable =
      `${task.title} ${task.area} ${task.category} ${task.priority}`.toLocaleLowerCase(
        "pt-BR"
      );
    return (
      matchesStatus &&
      (!normalizedQuery || searchable.includes(normalizedQuery))
    );
  });
}
