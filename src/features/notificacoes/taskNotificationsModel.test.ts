import { describe, expect, it } from 'vitest';
import { filtrarNotificacoesTarefa } from './taskNotificationsModel';
import type { Tarefa } from '../tarefas/types';

const tarefa = (id: string, usuario_id: string, lida: boolean) => ({
  id,
  participantes: [{ usuario_id, lida }],
}) as Tarefa;

describe('filtrarNotificacoesTarefa', () => {
  it('shows only the current employee receipts in the requested read state', () => {
    const tarefas = [
      tarefa('pendente-minha', 'u-atual', false),
      tarefa('lida-minha', 'u-atual', true),
      tarefa('pendente-outra', 'u-outra', false),
    ];

    expect(filtrarNotificacoesTarefa(tarefas, 'u-atual', false).map((item) => item.id)).toEqual(['pendente-minha']);
    expect(filtrarNotificacoesTarefa(tarefas, 'u-atual', true).map((item) => item.id)).toEqual(['lida-minha']);
  });
});
