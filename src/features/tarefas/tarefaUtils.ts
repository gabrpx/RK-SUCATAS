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

// Formata um ISO como "24/08 às 14:30 · 2h atrás". `agora` é injetável só
// pra os testes não dependerem do relógio real.
export function formatarMomentoRelativo(iso: string | null, agora = Date.now()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const abs = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ');
  const diff = agora - d.getTime();
  const min = 60_000, hora = 60 * min, dia = 24 * hora;
  let rel: string;
  if (diff < min) rel = 'agora';
  else if (diff < hora) rel = `${Math.floor(diff / min)}min atrás`;
  else if (diff < dia) rel = `${Math.floor(diff / hora)}h atrás`;
  else if (diff < 2 * dia) rel = 'ontem';
  else rel = `${Math.floor(diff / dia)}d atrás`;
  return `${abs} · ${rel}`;
}

export function progressoChecklist(tarefa: Pick<Tarefa, 'itens'>): { feitos: number; total: number } | null {
  const total = tarefa.itens?.length ?? 0;
  if (total === 0) return null;
  return { feitos: tarefa.itens.filter((i) => i.concluido).length, total };
}
