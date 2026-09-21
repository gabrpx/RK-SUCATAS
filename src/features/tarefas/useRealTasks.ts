import { useCallback, useEffect, useRef, useState } from "react";
import { realTasksApi, type RealOperator } from "./realTasksApi";
import { toPreviewReminder, toPreviewTask, type RealReminderRecord, type RealTaskRecord } from "./realTaskModel";
import type { PreviewTask } from "../tarefas-preview/taskPreviewModel";
import type { Reminder } from "../tarefas-preview/reminderModel";

const POLL_INTERVAL_MS = 20_000;

export function useRealTasks() {
  const [tasks, setTasks] = useState<PreviewTask[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [operators, setOperators] = useState<RealOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [tasksResult, remindersResult, operatorsResult] = await Promise.all([
        realTasksApi.listTasks(),
        realTasksApi.listReminders(),
        realTasksApi.listOperators(),
      ]);
      if (!tasksResult.success) throw new Error(tasksResult.error || "Não foi possível carregar tarefas");
      if (!remindersResult.success) throw new Error(remindersResult.error || "Não foi possível carregar lembretes");
      if (!operatorsResult.success) throw new Error(operatorsResult.error || "Não foi possível carregar responsáveis");
      const now = new Date().toISOString();
      setTasks((tasksResult.data as RealTaskRecord[]).map((task) => toPreviewTask(task, now)));
      setReminders((remindersResult.data as RealReminderRecord[]).map((reminder) => toPreviewReminder(reminder, now)));
      setOperators(operatorsResult.data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao carregar a operação de tarefas");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  return { tasks, reminders, operators, loading, error, refetch: load, setTasks, setReminders };
}
