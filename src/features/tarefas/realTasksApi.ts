import { api } from "../../utils/api";
import type { RealReminderRecord, RealTaskRecord } from "./realTaskModel";

type ApiResult<T> = { success: boolean; data: T; error?: string };

export type RealOperator = { id: string; nome_exibicao: string };

export type CreateRealTaskInput = {
  titulo: string;
  descricao: string;
  prazo: string | null;
  prioridade: "baixa" | "media" | "alta";
  participantes_ids: string[];
  itens: Array<{ texto: string }>;
};

export const realTasksApi = {
  listTasks: (): Promise<ApiResult<RealTaskRecord[]>> => api.get("/api/tarefas"),
  listReminders: (): Promise<ApiResult<RealReminderRecord[]>> => api.get("/api/lembretes"),
  listOperators: (): Promise<ApiResult<RealOperator[]>> => api.get("/api/usuarios/responsaveis-tarefa"),
  createTask: (payload: CreateRealTaskInput): Promise<ApiResult<RealTaskRecord>> => api.post("/api/tarefas", payload),
  toggleChecklist: (taskId: string, itemId: string): Promise<ApiResult<RealTaskRecord>> => api.patch(`/api/tarefas/${taskId}/itens/${itemId}/toggle`, {}),
  startTask: (taskId: string): Promise<ApiResult<RealTaskRecord>> => api.patch(`/api/tarefas/${taskId}/iniciar`, {}),
  completeTask: (taskId: string): Promise<ApiResult<RealTaskRecord>> => api.patch(`/api/tarefas/${taskId}/concluir`, {}),
  reopenTask: (taskId: string): Promise<ApiResult<RealTaskRecord>> => api.patch(`/api/tarefas/${taskId}/reabrir`, {}),
  createReminder: (payload: { titulo: string; descricao: string; atribuido_para?: string; intervalo_minutos?: number | null; horario_fixo?: string | null }): Promise<ApiResult<RealReminderRecord>> => api.post("/api/lembretes", payload),
  completeReminder: (id: string): Promise<ApiResult<RealReminderRecord>> => api.patch(`/api/lembretes/${id}/concluir`, {}),
  reopenReminder: (id: string): Promise<ApiResult<RealReminderRecord>> => api.patch(`/api/lembretes/${id}/reabrir`, {}),
  deleteReminder: (id: string): Promise<ApiResult<null>> => api.delete(`/api/lembretes/${id}`),
  snoozeReminder: (id: string, horario_fixo: string): Promise<ApiResult<RealReminderRecord>> => api.patch(`/api/lembretes/${id}`, { horario_fixo, intervalo_minutos: null }),
};
