import type { Tarefa } from '../tarefas/types';

/** Select only this employee's participant receipt, never another employee's state. */
export function filtrarNotificacoesTarefa(tarefas: Tarefa[], usuarioId: string, lida: boolean): Tarefa[] {
  if (!usuarioId) return [];
  return tarefas.filter((tarefa) =>
    tarefa.participantes?.some((participante) => participante.usuario_id === usuarioId && participante.lida === lida)
  );
}
