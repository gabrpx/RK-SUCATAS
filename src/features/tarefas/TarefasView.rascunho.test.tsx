// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TarefasView } from './TarefasView';

const state = vi.hoisted(() => ({ tarefas: [] as unknown[], loading: false }));
vi.mock('./useTarefas', () => ({ useTarefas: () => ({ ...state, setTarefas: vi.fn(), error: null, refetch: vi.fn() }) }));
vi.mock('../../hooks/usePermissao', () => ({ usePermissao: () => ({ isAdmin: true, pode: () => true }) }));
vi.mock('./api', () => ({ tarefasApi: { listarResponsaveisPossiveis: () => Promise.resolve({ success: true, data: [{ id: 'u1', nome_exibicao: 'Equipe' }] }) } }));

beforeEach(() => { state.tarefas = []; state.loading = false; });

it('preserva o rascunho de Nova tarefa após atualizar a lista', async () => {
  const view = render(<TarefasView />);
  const novo = await screen.findByRole('button', { name: /Nova tarefa/i });
  await waitFor(() => expect(novo.hasAttribute('disabled')).toBe(false));
  fireEvent.click(novo);
  const titulo = screen.getByPlaceholderText(/Buscar peça no fornecedor/i) as HTMLInputElement;
  fireEvent.change(titulo, { target: { value: 'Rascunho em andamento' } });
  state.tarefas = [{ id: 't1', titulo: 'Nova tarefa recebida', status: 'pendente', itens: [], prioridade: 'media', tipo: 'geral' }];
  view.rerender(<TarefasView />);
  expect(titulo.value).toBe('Rascunho em andamento');
  expect(screen.getByRole('dialog', { name: 'Nova tarefa' })).toBeTruthy();
});
