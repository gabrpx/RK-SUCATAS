// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClientesAgenda } from './ClientesAgenda';
import type { Tarefa } from '../../tarefas/types';

const visitas: Tarefa[] = [
  {
    id: 'visita-1', tipo: 'visita', titulo: 'Conferir retrovisor', descricao: null,
    prazo: '2026-10-08T13:30:00.000Z', atribuido_para: 'usuario-1', criado_por: 'usuario-1',
    status: 'pendente', prioridade: 'alta', cliente_id: 'cliente-1', concluida_em: null,
    criado_em: '2026-10-01T12:00:00.000Z', atualizado_em: '2026-10-01T12:00:00.000Z',
    atribuido: { id: 'usuario-1', nome_exibicao: 'Carlos' }, criador: null,
    cliente: { id: 'cliente-1', nome: 'Ana Souza', telefone: '83999999999' }, itens: [],
  },
];

describe('ClientesAgenda', () => {
  afterEach(cleanup);

  it('exibe somente tarefas de visita e permite abrir o cliente vinculado', () => {
    const onOpenCliente = vi.fn();
    render(<ClientesAgenda tarefas={[...visitas, { ...visitas[0], id: 'tarefa-geral', tipo: 'geral', titulo: 'Organizar prateleira' }]} onOpenCliente={onOpenCliente} />);

    expect(screen.getByText('Conferir retrovisor')).toBeTruthy();
    expect(screen.queryByText('Organizar prateleira')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Abrir cliente Ana Souza/i }));
    expect(onOpenCliente).toHaveBeenCalledWith('cliente-1');
  });

  it('distingue carregamento, vazio e falha recuperável', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ClientesAgenda tarefas={[]} loading onRetry={onRetry} />);
    expect(screen.getByRole('status').textContent).toMatch(/Carregando visitas/i);

    rerender(<ClientesAgenda tarefas={[]} onRetry={onRetry} />);
    expect(screen.getByText(/Nenhuma visita agendada/i)).toBeTruthy();

    rerender(<ClientesAgenda tarefas={[]} error="Falha temporária" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Falha temporária');
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
