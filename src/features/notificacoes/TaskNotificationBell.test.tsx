// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskNotificationBell } from './TaskNotificationBell';
import { tarefasApi } from '../tarefas/api';
import type { Tarefa } from '../tarefas/types';

vi.mock('../tarefas/api', () => ({
  tarefasApi: {
    listar: vi.fn(),
    marcarLida: vi.fn(),
  },
}));

const tarefa = (id: string, usuario_id: string, lida: boolean) => ({
  id,
  titulo: `Tarefa ${id}`,
  prazo: null,
  itens: [],
  participantes: [{ usuario_id, lida }],
}) as Tarefa;

describe('TaskNotificationBell', () => {
  beforeEach(() => {
    vi.mocked(tarefasApi.listar).mockResolvedValue({
      success: true,
      data: [tarefa('pendente', 'u-atual', false), tarefa('visualizada', 'u-atual', true), tarefa('outra-pessoa', 'u-outro', false)],
    });
  });

  afterEach(() => cleanup());

  it('shows only the employee unread count and opens a task without marking it read from the inbox', async () => {
    const onOpenTask = vi.fn();
    render(<TaskNotificationBell currentUserId="u-atual" onOpenTask={onOpenTask} />);

    const bell = await screen.findByRole('button', { name: 'Notificações de tarefas: 1 pendentes' });
    fireEvent.click(bell);
    fireEvent.click(await screen.findByRole('button', { name: /Tarefa pendente/ }));

    expect(onOpenTask).toHaveBeenCalledWith('pendente');
    expect(tarefasApi.marcarLida).not.toHaveBeenCalled();
    expect(screen.queryByText('Tarefa outra-pessoa')).not.toBeInTheDocument();
  });

  it('shows read receipts only in the Visualizadas tab', async () => {
    render(<TaskNotificationBell currentUserId="u-atual" onOpenTask={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notificações de tarefas: 1 pendentes' }));
    fireEvent.click(screen.getByRole('tab', { name: /Visualizadas/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Tarefa visualizada/ })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Tarefa pendente/ })).not.toBeInTheDocument();
  });

  it('closes on Escape and on outside click', async () => {
    render(<TaskNotificationBell currentUserId="u-atual" onOpenTask={() => {}} />);
    const bell = await screen.findByRole('button', { name: 'Notificações de tarefas: 1 pendentes' });
    fireEvent.click(bell);
    expect(await screen.findByRole('dialog', { name: 'Notificações de tarefas' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notificações de tarefas' })).not.toBeInTheDocument());

    fireEvent.click(bell);
    expect(await screen.findByRole('dialog', { name: 'Notificações de tarefas' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notificações de tarefas' })).not.toBeInTheDocument());
  });
});
