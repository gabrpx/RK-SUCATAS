import type {
  PreviewTask,
  PreviewTaskCategory,
  PreviewTaskPriority,
  PreviewTaskStatus,
} from "../tarefas-preview/taskPreviewModel";
import type { Reminder } from "../tarefas-preview/reminderModel";

export type RealTaskRecord = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  prazo: string | null;
  status: "pendente" | "em_andamento" | "concluida";
  prioridade: "baixa" | "media" | "alta";
  tipo: "geral" | "visita";
  atribuido_para: string;
  atribuido: { id: string; nome_exibicao: string } | null;
  itens: Array<{
    id: string;
    texto: string;
    concluido: boolean;
    concluido_em: string | null;
    concluido_por: string | null;
  }>;
  participantes?: Array<{
    id: string;
    usuario_id: string;
    concluido: boolean;
    concluido_em: string | null;
    lida: boolean;
    usuario: { id: string; nome_exibicao: string } | null;
  }>;
};

export type RealReminderRecord = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "pendente" | "concluido";
  intervalo_minutos: number | null;
  proxima_notificacao_em: string | null;
  atribuido_para: string;
  atribuido: { id: string; nome_exibicao: string } | null;
};

function formatDateTime(value: string | null, nowIso: string): string {
  if (!value) return "Sem horário definido";
  const date = new Date(value);
  const now = new Date(nowIso);
  const dateText = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const nowText = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(now);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return dateText === nowText ? `Hoje às ${time}` : `${dateText} às ${time}`;
}

function categoryForTask(task: RealTaskRecord): PreviewTaskCategory {
  const text = `${task.titulo ?? ""} ${task.descricao ?? ""}`.toLocaleLowerCase("pt-BR");
  if (/(despach|frete|coleta|envio)/.test(text)) return "despacho";
  if (/(limpez|higien|bancada)/.test(text)) return "limpeza";
  if (/(organiza|cadastro|confer|invent[aá]rio|pe[cç]a)/.test(text)) return "organizacao";
  if (task.tipo === "visita") return "outro";
  return "outro";
}

function priorityForTask(priority: RealTaskRecord["prioridade"]): PreviewTaskPriority {
  return priority === "media" ? "normal" : priority;
}

function statusForTask(status: RealTaskRecord["status"]): PreviewTaskStatus {
  if (status === "concluida") return "concluida";
  if (status === "em_andamento") return "em-andamento";
  return "aguardando";
}

export function toPreviewTask(task: RealTaskRecord, nowIso = new Date().toISOString()): PreviewTask {
  const participants = task.participantes ?? [];
  const operatorIds = participants.length
    ? participants.map((participant) => participant.usuario_id)
    : [task.atribuido_para];
  const fallbackTitle = task.itens[0]?.texto || "Tarefa sem título";

  return {
    id: task.id,
    title: task.titulo?.trim() || fallbackTitle,
    area: categoryForTask(task) === "outro" ? "Operação" : categoryForTask(task)[0].toUpperCase() + categoryForTask(task).slice(1),
    category: categoryForTask(task),
    priority: priorityForTask(task.prioridade),
    status: statusForTask(task.status),
    dueLabel: formatDateTime(task.prazo, nowIso),
    estimateMinutes: 30,
    operatorIds,
    instructions: task.descricao ?? undefined,
    checklist: task.itens.map((item) => ({
      id: item.id,
      label: item.texto,
      completed: item.concluido,
      owner: item.concluido_por ?? operatorIds[0] ?? "admin",
      ...(item.concluido_em ? { completedAt: item.concluido_em } : {}),
    })),
  };
}

export function toPreviewReminder(reminder: RealReminderRecord, nowIso = new Date().toISOString()): Reminder {
  const dueAt = reminder.proxima_notificacao_em ? new Date(reminder.proxima_notificacao_em).getTime() : Number.POSITIVE_INFINITY;
  const recurrence = reminder.intervalo_minutos == null ? "Único" : `A cada ${reminder.intervalo_minutos} min`;
  return {
    id: reminder.id,
    title: reminder.titulo,
    description: reminder.descricao ?? "Lembrete operacional persistido no sistema.",
    area: "Tarefas",
    priority: "media",
    dueLabel: formatDateTime(reminder.proxima_notificacao_em, nowIso),
    dueAt,
    status: reminder.status === "concluido" ? "concluido" : "ativo",
    recurrence,
    channels: ["Tela"],
    isOverdue: Number.isFinite(dueAt) && dueAt < new Date(nowIso).getTime() && reminder.status !== "concluido",
  };
}
