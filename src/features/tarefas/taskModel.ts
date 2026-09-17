export type TaskStatus = 'ready' | 'in-progress' | 'waiting' | 'blocked' | 'review' | 'completed';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskImpact = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  impact: TaskImpact;
  dueLabel: string;
  dueAt: string;
  estimateMinutes: number;
  owner: string;
  area: string;
  context: string;
  reason: string;
  tags: string[];
}

const priorityWeight: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const impactWeight: Record<TaskImpact, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function focusScore(task: Task) {
  const statusPenalty = task.status === 'blocked' || task.status === 'waiting' ? -18 : 0;
  const dueTime = Date.parse(task.dueAt);
  const hoursUntilDue = Number.isNaN(dueTime) ? 24 : Math.max(0, (dueTime - Date.now()) / 3_600_000);
  const urgency = Math.max(0, 24 - Math.min(hoursUntilDue, 24)) / 8;

  return priorityWeight[task.priority] * 10 + impactWeight[task.impact] * 2 + urgency + statusPenalty;
}

export function sortTasksByFocus(tasks: Task[]) {
  return tasks.sort((a, b) => focusScore(b) - focusScore(a));
}

export function getTaskSummary(tasks: Task[]) {
  return tasks.reduce(
    (summary, task) => {
      summary.total += 1;
      if (task.status === 'completed') summary.completed += 1;
      if (task.status === 'blocked') summary.blocked += 1;
      if (task.status !== 'completed' && task.status !== 'blocked' && task.status !== 'waiting') summary.open += 1;

      const dueTime = Date.parse(task.dueAt);
      if (!Number.isNaN(dueTime) && dueTime - Date.now() <= 3_600_000 && task.status !== 'completed') {
        summary.dueSoon += 1;
      }

      return summary;
    },
    { total: 0, open: 0, blocked: 0, dueSoon: 0, completed: 0 },
  );
}
