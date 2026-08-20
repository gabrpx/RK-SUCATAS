// Helpers compartilhados entre a TarefasView e o TarefaCards (grade de cards
// expansíveis). Antes viviam só na TarefasView; extraídos pra os dois usarem
// sem duplicação.
import type { StatusTone } from '../../components/ui/StatusBadge';
import type { Tarefa, TarefaPrioridade } from './types';

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
