// Helpers compartilhados entre a TarefasView e o TarefaCards (grade de cards
// expansíveis). Antes viviam só na TarefasView; extraídos pra os dois usarem
// sem duplicação.
import { arrayMove } from '@dnd-kit/sortable';
import type { StatusTone } from '../../components/ui/StatusBadge';
import type { Tarefa, TarefaItem, TarefaParticipante, TarefaPrioridade, TarefaStatus } from './types';

export const PRIORIDADE_LABELS: Record<TarefaPrioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
export const PRIORIDADE_TONS: Record<TarefaPrioridade, StatusTone> = { baixa: 'neutral', media: 'warning', alta: 'danger' };

export function formatarPrazo(prazo: string | null) {
  if (!prazo) return null;
  return new Date(prazo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function estaVencida(tarefa: Tarefa) {
  return tarefa.status === 'pendente' && !!tarefa.prazo && new Date(tarefa.prazo).getTime() < Date.now();
}

// Converte o valor do <input type="datetime-local"> (sem timezone) pra ISO,
// e o inverso, pra reabrir o form de edição já preenchido.
export function paraDatetimeLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { formatarMomentoRelativo } from '../../utils/tempoRelativo';

export function ordenarTarefas(tarefas: Tarefa[]): Tarefa[] {
  return [...tarefas].sort((a, b) => {
    const aConcluida = a.status === 'concluida' ? 1 : 0;
    const bConcluida = b.status === 'concluida' ? 1 : 0;
    return aConcluida - bConcluida;
  });
}

export function progressoChecklist(tarefa: Pick<Tarefa, 'itens'>): { feitos: number; total: number } | null {
  const total = tarefa.itens?.length ?? 0;
  if (total === 0) return null;
  return { feitos: tarefa.itens.filter((i) => i.concluido).length, total };
}

// Reordena o checklist pro drag-and-drop no painel expandido (ver
// TarefaCards) — activeId sai de onde está e entra na posição de overId.
// Se algum dos dois ids não existir na lista, devolve a lista original
// intacta em vez de quebrar (dnd-kit pode disparar onDragEnd com over null
// em drags cancelados).
export function moverItem(itens: TarefaItem[], activeId: string, overId: string): TarefaItem[] {
  const oldIndex = itens.findIndex((i) => i.id === activeId);
  const newIndex = itens.findIndex((i) => i.id === overId);
  if (oldIndex === -1 || newIndex === -1) return itens;
  return arrayMove(itens, oldIndex, newIndex);
}

// Dentre as tarefas SELECIONADAS pra "concluir em lote" (grade de cards,
// modo de seleção), devolve só os ids que de fato podem ser concluídos por
// um PATCH direto: já concluída não precisa (pula), e tarefa com checklist
// se conclui sozinha ao marcar os itens (mesma regra do menu individual —
// ver `t.itens.length === 0` em TarefasView).
export function elegiveisParaConcluirEmLote(tarefas: Tarefa[], selecionadas: Set<string>): string[] {
  return tarefas
    .filter((t) => selecionadas.has(t.id) && t.status !== 'concluida' && t.itens.length === 0 && (t.participantes?.length ?? 0) === 0)
    .map((t) => t.id);
}

// Progresso "X/Y concluídos" da barra de participantes (Fase 1) — null
// quando a tarefa não tem participantes (modelo antigo, sem barra pra
// mostrar). Espelha progressoParticipantes do backend (tarefas.ts).
export function progressoParticipantes(participantes: TarefaParticipante[] | undefined): { feitos: number; total: number } | null {
  if (!participantes || participantes.length === 0) return null;
  return { feitos: participantes.filter((p) => p.concluido).length, total: participantes.length };
}

// "Aguardando aprovação": todo participante já marcou a própria parte, mas
// quem criou ainda não finalizou. Espelha aguardandoAprovacao do backend —
// nunca persistido, sempre derivado das duas listas na hora de renderizar.
export function aguardandoAprovacao(tarefa: { status: TarefaStatus; participantes?: TarefaParticipante[] }): boolean {
  const participantes = tarefa.participantes ?? [];
  if (participantes.length === 0 || tarefa.status !== 'pendente') return false;
  return participantes.every((p) => p.concluido);
}

// Se `usuarioId` é "dono" da tarefa — o atribuido_para (modelo antigo) OU um
// dos participantes (modelo novo). Espelha souParticipante do backend.
export function souParticipante(tarefa: { atribuido_para: string; participantes?: TarefaParticipante[] }, usuarioId: string | null): boolean {
  if (!usuarioId) return false;
  if (tarefa.atribuido_para === usuarioId) return true;
  return (tarefa.participantes ?? []).some((p) => p.usuario_id === usuarioId);
}
