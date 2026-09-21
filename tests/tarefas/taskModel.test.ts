import { test } from 'vitest';
import assert from 'node:assert/strict';
import { getTaskSummary, sortTasksByFocus, type Task } from '../../src/features/tarefas/taskModel.ts';

const dueSoon = new Date(Date.now() + 30 * 60 * 1000).toISOString();

const tasks: Task[] = [
  {
    id: 'task-1',
    title: 'Liberar pedido 4821 para despacho',
    status: 'ready',
    priority: 'high',
    impact: 'high',
    dueLabel: 'vence em 35 min',
    dueAt: dueSoon,
    estimateMinutes: 20,
    owner: 'Você',
    area: 'Expedição',
    context: 'Pedido #4821',
    reason: 'Bloqueia o despacho de hoje',
    tags: ['SLA', 'despacho'],
  },
  {
    id: 'task-2',
    title: 'Revisar fotos do lote de carenagens',
    status: 'blocked',
    priority: 'critical',
    impact: 'medium',
    dueLabel: 'aguardando retorno',
    // O bloqueio não deve entrar no contador de urgência do teste. Mantemos
    // o prazo relativo para a suíte continuar determinística após a virada
    // do dia, sem depender do relógio do ambiente.
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    estimateMinutes: 45,
    owner: 'Você',
    area: 'Catálogo',
    context: 'Lote 24-B',
    reason: 'Aguardando aprovação de qualidade',
    tags: ['bloqueada'],
  },
];

test('ordena a fila pela urgência operacional e mantém a justificativa', () => {
  const ordered = sortTasksByFocus([...tasks]);

  assert.equal(ordered[0].id, 'task-1');
  assert.equal(ordered[0].reason, 'Bloqueia o despacho de hoje');
});

test('resume a operação sem confundir bloqueios com tarefas abertas', () => {
  assert.deepEqual(getTaskSummary(tasks), {
    total: 2,
    open: 1,
    blocked: 1,
    dueSoon: 1,
    completed: 0,
  });
});
