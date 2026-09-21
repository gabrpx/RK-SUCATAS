import { useState } from "react";
import { TasksPreview } from "../tarefas-preview/TasksPreview";
import type { DemoOperator } from "../tarefas-preview/TaskComposer";
import type { PreviewTask } from "../tarefas-preview/taskPreviewModel";
import type { Reminder } from "../tarefas-preview/reminderModel";
import { realTasksApi } from "./realTasksApi";
import { toPreviewReminder, toPreviewTask } from "./realTaskModel";
import { useRealTasks } from "./useRealTasks";

const OPERATOR_TONES = [
  "bg-blue-100 text-blue-700 ring-blue-200",
  "bg-amber-100 text-amber-800 ring-amber-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-slate-100 text-slate-700 ring-slate-200",
];

function toOperators(users: Array<{ id: string; nome_exibicao: string }>): DemoOperator[] {
  return users.map((user, index) => ({
    id: user.id,
    name: user.nome_exibicao,
    initials: user.nome_exibicao.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    tone: OPERATOR_TONES[index % OPERATOR_TONES.length],
  }));
}

function toDueIso(time: string): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function toPriority(priority: PreviewTask["priority"]): "baixa" | "media" | "alta" {
  return priority === "normal" ? "media" : priority === "critica" ? "alta" : priority;
}

export function RealTasksView() {
  const { tasks, reminders, operators: users, loading, error, refetch } = useRealTasks();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const operators = toOperators(users);

  const runMutation = async <T,>(operation: () => Promise<T>, transform: (value: T) => PreviewTask | null) => {
    try {
      setMutationError(null);
      return transform(await operation());
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Não foi possível salvar a alteração");
      return null;
    }
  };

  const createTask = (input: Parameters<NonNullable<React.ComponentProps<typeof TasksPreview>["onCreateTask"]>>[0]) =>
    runMutation(
      async () => {
        const result = await realTasksApi.createTask({
          titulo: input.title,
          descricao: input.instructions,
          prazo: toDueIso(input.dueTime),
          prioridade: toPriority(input.priority),
          participantes_ids: input.operatorIds,
          itens: input.checklistLabels.filter(Boolean).map((texto) => ({ texto })),
        });
        if (!result.success) throw new Error(result.error || "Não foi possível criar a tarefa");
        return result.data;
      },
      (value) => toPreviewTask(value as never)
    );

  const toggleChecklist = (taskId: string, checklistId: string) =>
    runMutation(
      async () => {
        const result = await realTasksApi.toggleChecklist(taskId, checklistId);
        if (!result.success) throw new Error(result.error || "Não foi possível atualizar o checklist");
        return result.data;
      },
      (value) => toPreviewTask(value as never)
    );

  const advanceTask = (task: PreviewTask, nextStatus: PreviewTask["status"]) =>
    runMutation(
      async () => {
        const action = nextStatus === "concluida"
          ? realTasksApi.completeTask
          : task.status === "concluida"
            ? realTasksApi.reopenTask
            : realTasksApi.startTask;
        const result = await action(task.id);
        if (!result.success) throw new Error(result.error || "Não foi possível atualizar a tarefa");
        return result.data;
      },
      (value) => toPreviewTask(value as never)
    );

  const updateReminders = async (previous: Reminder[], next: Reminder[]) => {
    try {
      const previousById = new Map(previous.map((item) => [item.id, item]));
      const nextById = new Map(next.map((item) => [item.id, item]));
      for (const reminder of previous) {
        if (!nextById.has(reminder.id)) {
          const result = await realTasksApi.deleteReminder(reminder.id);
          if (!result.success) throw new Error(result.error || "Não foi possível excluir o lembrete");
          continue;
        }
        const changed = nextById.get(reminder.id)!;
        if (reminder.status !== changed.status) {
          const result = changed.status === "concluido" ? await realTasksApi.completeReminder(reminder.id) : await realTasksApi.reopenReminder(reminder.id);
          if (!result.success) throw new Error(result.error || "Não foi possível atualizar o lembrete");
        } else if (reminder.dueAt !== changed.dueAt && Number.isFinite(changed.dueAt)) {
          const result = await realTasksApi.snoozeReminder(reminder.id, new Date(changed.dueAt).toISOString());
          if (!result.success) throw new Error(result.error || "Não foi possível adiar o lembrete");
        }
      }
      for (const reminder of next) {
        if (previousById.has(reminder.id)) continue;
        const result = await realTasksApi.createReminder({
          titulo: reminder.title,
          descricao: reminder.description,
          intervalo_minutos: reminder.recurrence === "Diário" ? 1440 : reminder.recurrence === "Semanal" ? 10080 : null,
          horario_fixo: reminder.recurrence === "Único" && Number.isFinite(reminder.dueAt) ? new Date(reminder.dueAt).toISOString() : null,
        });
        if (!result.success) throw new Error(result.error || "Não foi possível criar o lembrete");
      }
      await refetch();
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : "Não foi possível salvar o lembrete");
      await refetch();
    }
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f8fafc] text-sm text-slate-600">Carregando tarefas reais…</div>;
  }

  return (
    <TasksPreview
      initialTasks={tasks}
      initialReminders={reminders}
      operators={operators}
      integrated
      onCreateTask={createTask}
      onToggleChecklist={toggleChecklist}
      onAdvanceTask={advanceTask}
      onRemindersChange={updateReminders}
      errorMessage={mutationError || error}
    />
  );
}
