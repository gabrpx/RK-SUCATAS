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

/**
 * Navegação global da tela. Tem semântica única e é a ÚNICA fonte de estado do
 * contexto ativo (inclusive do CTA contextual do cabeçalho).
 */
export type PreviewWorkspaceTab = PreviewPrimaryTab | "lembretes";

/**
 * Filtros locais da fila prioritária. Não competem com a navegação global:
 * só existem dentro de "Meu turno" e só recortam a fila.
 */
export type PreviewQueueFilter = "todas" | "abertas" | "pendencias" | "grupo";

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
  paused?: boolean;
  pauseReason?: string;
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
      if (task.status !== "concluida" && !task.paused) summary.open += 1;
      if (task.status === "em-andamento" && !task.paused) summary.inProgress += 1;
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
    return tasks.filter((task) => task.status !== "concluida" && !task.paused);
  if (tab === "pendencias")
    return tasks.filter((task) => task.status === "aguardando" && !task.paused);
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

export function startPreviewTask(task: PreviewTask): PreviewTask {
  if (task.status !== "aguardando") return task;
  return { ...task, status: "em-andamento" };
}

export function isCollaborativePreviewTask(task: PreviewTask) {
  return (task.operatorIds?.length ?? 0) > 1;
}

export function filterPreviewTasksByQueueFilter(
  tasks: PreviewTask[],
  filter: PreviewQueueFilter
) {
  if (filter === "abertas")
    return tasks.filter((task) => task.status !== "concluida" && !task.paused);
  if (filter === "pendencias")
    return tasks.filter((task) => task.status === "aguardando" && !task.paused);
  if (filter === "grupo") return tasks.filter(isCollaborativePreviewTask);
  return tasks;
}

export function getPreviewQueueCounts(
  tasks: PreviewTask[]
): Record<PreviewQueueFilter, number> {
  return {
    todas: tasks.length,
    abertas: filterPreviewTasksByQueueFilter(tasks, "abertas").length,
    pendencias: filterPreviewTasksByQueueFilter(tasks, "pendencias").length,
    grupo: filterPreviewTasksByQueueFilter(tasks, "grupo").length,
  };
}

/**
 * Entidade que o CTA global deve criar no contexto ativo. Rótulo, ícone e
 * gatilho do cabeçalho derivam daqui para nunca divergirem da aba aberta.
 */
export function getPreviewWorkspaceEntity(
  tab: PreviewWorkspaceTab
): "tarefa" | "lembrete" {
  return tab === "lembretes" ? "lembrete" : "tarefa";
}

export function getPreviewWorkspaceCreateLabel(tab: PreviewWorkspaceTab) {
  return getPreviewWorkspaceEntity(tab) === "lembrete"
    ? "Novo lembrete"
    : "Nova tarefa";
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
