import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import type { TasksPreviewProps } from '../tarefas-preview/TasksPreview';
import type { TaskComposerInput } from '../tarefas-preview/TaskComposer';
import { mapParticipantReadReceipts, type PreviewTask, type PreviewTaskCategory, type PreviewTaskPriority } from '../tarefas-preview/taskPreviewModel';
import type { Reminder } from '../tarefas-preview/reminderModel';
import type { Tarefa, UsuarioResumo as TarefaUsuario } from './types';
import type { Lembrete } from '../lembretes/types';
import { tarefasApi } from './api';
import { lembretesApi } from '../lembretes/api';
import { usePermissao } from '../../hooks/usePermissao';

type IntegratedProps = {
  tarefas: ReturnType<typeof import('./useTarefas').useTarefas>;
  lembretes: ReturnType<typeof import('../lembretes/useLembretes').useLembretes>;
  Preview: ComponentType<TasksPreviewProps>;
  initialTaskId?: string | null;
  onInitialTaskHandled?: (taskId: string) => void;
};

const operatorTones = [
  'bg-blue-100 text-blue-700 ring-blue-200',
  'bg-amber-100 text-amber-800 ring-amber-200',
  'bg-violet-100 text-violet-700 ring-violet-200',
  'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'bg-rose-100 text-rose-700 ring-rose-200',
];

function nomeCurto(nome: string) {
  return nome.trim().split(/\s+/)[0] || 'Equipe';
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return partes.length > 1 ? `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase() : (partes[0]?.slice(0, 2) || 'EQ').toUpperCase();
}

function formatarPrazoPreview(iso: string | null) {
  if (!iso) return 'Sem prazo definido';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function categoriaDaTarefa(tarefa: Tarefa): PreviewTaskCategory {
  return tarefa.tipo === 'visita' ? 'despacho' : 'estoque';
}

function prioridadeDaTarefa(tarefa: Tarefa): PreviewTaskPriority {
  if (tarefa.prioridade === 'alta') return 'alta';
  if (tarefa.prioridade === 'baixa') return 'baixa';
  return 'normal';
}

function tarefaParaPreview(tarefa: Tarefa): PreviewTask {
  const participantes = tarefa.participantes ?? [];
  const operatorIds = participantes.length > 0 ? participantes.map((p) => p.usuario_id) : [tarefa.atribuido_para];
  const categoria = categoriaDaTarefa(tarefa);
  const checklist = tarefa.itens.map((item) => ({
    id: item.id,
    label: item.texto,
    completed: item.concluido,
    owner: item.concluido_por || tarefa.atribuido_para,
    ...(item.concluido_em ? { completedAt: new Date(item.concluido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } : {}),
  }));
  const emAndamento = checklist.some((item) => item.completed) && checklist.some((item) => !item.completed);

  return {
    id: tarefa.id,
    title: tarefa.titulo || tarefa.itens[0]?.texto || 'Tarefa operacional',
    area: categoria === 'despacho' ? 'Despacho' : 'Estoque',
    category: categoria,
    priority: prioridadeDaTarefa(tarefa),
    status: tarefa.status === 'concluida' ? 'concluida' : emAndamento ? 'em-andamento' : 'aguardando',
    paused: Boolean(tarefa.pausada),
    pauseReason: tarefa.pausa_motivo || undefined,
    dueLabel: tarefa.status === 'concluida' ? `Concluída ${formatarPrazoPreview(tarefa.concluida_em)}` : formatarPrazoPreview(tarefa.prazo),
    estimateMinutes: 30,
    operatorIds,
    instructions: tarefa.descricao || 'Nenhuma instrução adicional registrada.',
    checklist,
    readReceipts: mapParticipantReadReceipts(participantes),
  };
}

function lembreteParaPreview(lembrete: Lembrete): Reminder {
  const dueAt = lembrete.proxima_notificacao_em ? new Date(lembrete.proxima_notificacao_em).getTime() : new Date(lembrete.atualizado_em).getTime();
  const isOverdue = lembrete.status === 'pendente' && dueAt < Date.now();
  const recurrence = lembrete.intervalo_minutos == null ? 'Disparo único' : `A cada ${lembrete.intervalo_minutos} min`;
  return {
    id: lembrete.id,
    title: lembrete.titulo,
    description: lembrete.descricao || 'Alerta operacional persistido no sistema.',
    area: 'Operação geral',
    // A API real ainda não possui prioridade; média evita inventar uma
    // classificação que não existe no contrato persistido.
    priority: 'media',
    dueLabel: lembrete.status === 'concluido' ? 'Concluído' : new Date(dueAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    dueAt,
    status: lembrete.status === 'concluido' ? 'concluido' : 'ativo',
    recurrence,
    channels: ['Tela'],
    isOverdue,
  };
}

function operadorResumo(usuarios: TarefaUsuario[]) {
  return usuarios.map((usuario, index) => ({
    id: usuario.id,
    name: nomeCurto(usuario.nome_exibicao),
    initials: iniciais(usuario.nome_exibicao),
    tone: operatorTones[index % operatorTones.length],
  }));
}

function dataParaPrazo(dueTime: string) {
  if (!dueTime) return null;
  const now = new Date();
  const [hours, minutes] = dueTime.split(':').map(Number);
  now.setHours(hours || 0, minutes || 0, 0, 0);
  return now.toISOString();
}

export function TarefasPreviewIntegrated({ tarefas, lembretes, Preview, initialTaskId, onInitialTaskHandled }: IntegratedProps) {
  const { pode } = usePermissao();
  const canCreate = pode('tarefas.criar');
  const taskList = tarefas.tarefas;
  const reminderList = lembretes.lembretes;
  const [possibleOperators, setPossibleOperators] = useState<TarefaUsuario[]>([]);
  const [possibleOperatorsLoading, setPossibleOperatorsLoading] = useState(false);
  const [possibleOperatorsError, setPossibleOperatorsError] = useState<string | null>(null);

  useEffect(() => {
    if (!canCreate) {
      setPossibleOperators([]);
      setPossibleOperatorsLoading(false);
      setPossibleOperatorsError(null);
      return;
    }

    let active = true;
    setPossibleOperatorsLoading(true);
    setPossibleOperatorsError(null);
    tarefasApi.listarResponsaveisPossiveis()
      .then((response) => {
        if (!active) return;
        if (!response.success) {
          setPossibleOperatorsError(response.error || 'Não foi possível carregar os responsáveis');
          return;
        }
        setPossibleOperators(response.data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPossibleOperatorsError(error instanceof Error ? error.message : 'Não foi possível carregar os responsáveis');
      })
      .finally(() => {
        if (active) setPossibleOperatorsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canCreate]);

  const previewTasks = useMemo(() => taskList.map(tarefaParaPreview), [taskList]);
  const previewReminders = useMemo(() => reminderList.map(lembreteParaPreview), [reminderList]);
  const operators = useMemo(() => {
    const users = new Map<string, TarefaUsuario>(possibleOperators.map((user) => [user.id, user]));
    taskList.forEach((tarefa) => {
      if (tarefa.atribuido) users.set(tarefa.atribuido.id, tarefa.atribuido);
      tarefa.participantes?.forEach((participante) => {
        if (participante.usuario) users.set(participante.usuario.id, participante.usuario);
      });
    });
    return operadorResumo([...users.values()]);
  }, [possibleOperators, taskList]);

  const mapUpdatedTask = useCallback(async (id: string, result: Promise<{ success: boolean; data: Tarefa; error?: string }>) => {
    const response = await result;
    if (!response.success) throw new Error(response.error || 'Não foi possível atualizar a tarefa');
    tarefas.setTarefas((current) => current.map((item) => item.id === id ? response.data : item));
    return tarefaParaPreview(response.data);
  }, [tarefas]);

  const onTaskOpened = useCallback(async (id: string) => {
    const currentUserId = localStorage.getItem('user_id') || '';
    const task = taskList.find((item) => item.id === id);
    const receipt = task?.participantes?.find((participant) => participant.usuario_id === currentUserId);
    if (!task || !receipt || receipt.lida) return null;

    const response = await tarefasApi.marcarLida(id);
    if (!response.success) throw new Error(response.error || 'Não foi possível registrar a visualização');
    const atualizada: Tarefa = {
      ...task,
      participantes: task.participantes?.map((participant) =>
        participant.usuario_id === currentUserId ? { ...participant, lida: true } : participant
      ),
    };
    tarefas.setTarefas((current) => current.map((item) => item.id === id ? atualizada : item));
    return tarefaParaPreview(atualizada);
  }, [taskList, tarefas]);

  const onCreateTask = useCallback(async (input: Parameters<NonNullable<TasksPreviewProps['onCreateTask']>>[0]) => {
    if (!canCreate) return null;
    const owner = input.operatorIds[0] || localStorage.getItem('user_id') || '';
    const payload = {
      titulo: input.title,
      descricao: input.instructions || null,
      prazo: dataParaPrazo(input.dueTime),
      atribuido_para: owner,
      participantes_ids: input.operatorIds.length > 1 ? input.operatorIds : undefined,
      prioridade: input.priority === 'alta' || input.priority === 'critica' ? 'alta' as const : input.priority === 'baixa' ? 'baixa' as const : 'media' as const,
      tipo: input.category === 'despacho' ? 'visita' as const : 'geral' as const,
      itens: input.checklistLabels.filter(Boolean).map((texto) => ({ texto })),
    };
    const response = await tarefasApi.criar(payload);
    if (!response.success) throw new Error(response.error || 'Não foi possível criar a tarefa');
    tarefas.setTarefas((current) => [response.data, ...current]);
    return tarefaParaPreview(response.data);
  }, [canCreate, tarefas]);

  const onToggleChecklist = useCallback(async (taskId: string, checklistId: string) => {
    return mapUpdatedTask(taskId, tarefasApi.alternarItem(taskId, checklistId));
  }, [mapUpdatedTask]);

  const onAdvanceTask = useCallback(async (task: PreviewTask) => {
    const real = taskList.find((item) => item.id === task.id);
    if (!real) return null;
    const result = real.status === 'concluida' ? tarefasApi.reabrir(real.id) : tarefasApi.concluir(real.id);
    return mapUpdatedTask(real.id, result);
  }, [mapUpdatedTask, taskList]);

  const canEdit = pode('tarefas.editar');
  const onPauseTask = useCallback(async (taskId: string, motivo: string) => {
    if (!canEdit) return null;
    return mapUpdatedTask(taskId, tarefasApi.pausar(taskId, motivo));
  }, [canEdit, mapUpdatedTask]);

  const onResumeTask = useCallback(async (taskId: string) => {
    if (!canEdit) return null;
    return mapUpdatedTask(taskId, tarefasApi.despausar(taskId));
  }, [canEdit, mapUpdatedTask]);

  const onUpdateTask = useCallback(async (taskId: string, input: TaskComposerInput) => {
    if (!canEdit) return null;
    const response = await tarefasApi.atualizar(taskId, {
      titulo: input.title,
      descricao: input.instructions || null,
      prazo: dataParaPrazo(input.dueTime),
      atribuido_para: input.operatorIds[0] || localStorage.getItem('user_id') || '',
      participantes_ids: input.operatorIds,
      prioridade: input.priority === 'alta' || input.priority === 'critica' ? 'alta' : input.priority === 'baixa' ? 'baixa' : 'media',
      tipo: input.category === 'despacho' ? 'visita' : 'geral',
      itens: input.checklistItems.filter((item) => item.label.trim()).map((item) => ({ id: item.id, texto: item.label })),
    });
    if (!response.success) throw new Error(response.error || 'Não foi possível editar a tarefa');
    tarefas.setTarefas((current) => current.map((item) => item.id === taskId ? response.data : item));
    return tarefaParaPreview(response.data);
  }, [canEdit, tarefas]);

  const canDelete = pode('tarefas.excluir');
  const onDeleteTask = useCallback(async (taskId: string) => {
    if (!canDelete) throw new Error('Você não tem permissão para excluir tarefas');
    const response = await tarefasApi.excluir(taskId);
    if (!response.success) throw new Error(response.error || 'Não foi possível excluir a tarefa');
    tarefas.setTarefas((current) => current.filter((item) => item.id !== taskId));
  }, [canDelete, tarefas]);

  const onRemindersChange = useCallback(async (previous: Reminder[], next: Reminder[]) => {
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const nextById = new Map(next.map((item) => [item.id, item]));
    for (const reminder of previous) {
      if (!nextById.has(reminder.id)) {
        await lembretesApi.excluir(reminder.id);
        continue;
      }
      const updated = nextById.get(reminder.id)!;
      if (updated.status !== reminder.status) {
        if (updated.status === 'concluido') await lembretesApi.concluir(reminder.id);
        else await lembretesApi.reabrir(reminder.id);
      }
    }
    for (const reminder of next) {
      if (previousById.has(reminder.id)) continue;
      const minutos = reminder.recurrence === 'Diário' ? 1440 : reminder.recurrence === 'Semanal' ? 10080 : null;
      await lembretesApi.criar({
        titulo: reminder.title,
        descricao: reminder.description,
        atribuido_para: localStorage.getItem('user_id') || undefined,
        intervalo_minutos: minutos,
        horario_fixo: minutos == null ? new Date(reminder.dueAt).toISOString() : null,
      });
    }
    await lembretes.refetch();
  }, [lembretes]);

  return (
    <Preview
      initialTasks={previewTasks}
      initialReminders={previewReminders}
      operators={operators}
      onCreateTask={onCreateTask}
      onToggleChecklist={onToggleChecklist}
      onAdvanceTask={onAdvanceTask}
      onPauseTask={canEdit ? onPauseTask : undefined}
      onResumeTask={canEdit ? onResumeTask : undefined}
      onUpdateTask={canEdit ? onUpdateTask : undefined}
      onDeleteTask={canDelete ? onDeleteTask : undefined}
      onRemindersChange={onRemindersChange}
      onTaskOpened={onTaskOpened}
      initialTaskId={initialTaskId}
      onInitialTaskHandled={onInitialTaskHandled}
      currentUserId={localStorage.getItem('user_id') || ''}
      canViewReadReceipts={canCreate}
      errorMessage={tarefas.error || lembretes.error || possibleOperatorsError}
      loading={tarefas.loading || lembretes.loading || possibleOperatorsLoading}
      integrated
    />
  );
}
