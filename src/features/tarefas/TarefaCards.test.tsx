// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TarefaCards } from './TarefaCards';
import type { Tarefa } from './types';

// Mock tarefa base
const mockTarefa: Tarefa = {
  id: 'test-1',
  titulo: 'Test Task',
  descricao: null,
  prazo: null,
  atribuido_para: 'user-1',
  criado_por: 'user-2',
  status: 'pendente' as const,
  prioridade: 'media' as const,
  tipo: 'geral' as const,
  cliente_id: null,
  concluida_em: null,
  criado_em: '2026-01-01T00:00:00Z',
  atualizado_em: '2026-01-01T00:00:00Z',
  atribuido: {
    id: 'user-1',
    nome_exibicao: 'João Silva',
  },
  criador: {
    id: 'user-2',
    nome_exibicao: 'Admin User',
  },
  cliente: null,
  itens: [],
};

const mockTarefaSemAtribuicao: Tarefa = {
  ...mockTarefa,
  id: 'test-2',
  atribuido_para: 'user-3',
  atribuido: null,
};

describe('TarefaCards - Responsible Person Badge', () => {
  it('Renders the responsible person badge text when mostrarResponsavel is true and tarefa.atribuido is set', () => {
    const { container } = render(
      <TarefaCards
        tarefas={[mockTarefa]}
        mostrarResponsavel={true}
      />
    );

    // Check if the responsible person's name appears in the collapsed card badges
    const badgeText = container.textContent;
    expect(badgeText).toContain('João Silva');
  });

  it('Does not render any responsible-person badge when mostrarResponsavel is false/omitted', () => {
    const { container } = render(
      <TarefaCards
        tarefas={[mockTarefa]}
        mostrarResponsavel={false}
      />
    );

    // The responsible person name should NOT appear in the card section
    // Check via text matching that it's not in the visible collapsed card
    const text = container.textContent;
    // "Pendente" is in the status badge, but João Silva should not be near it
    expect(text).toContain('Pendente');
    expect(text).not.toContain('João Silva');
  });

  it('Does not render the badge when atribuido is null, even if mostrarResponsavel is true', () => {
    const { container } = render(
      <TarefaCards
        tarefas={[mockTarefaSemAtribuicao]}
        mostrarResponsavel={true}
      />
    );

    // The responsible person name should NOT be visible when atribuido is null
    const text = container.textContent;
    expect(text).not.toContain('João Silva');
  });

  it('Does not render badge when mostrarResponsavel is omitted (undefined)', () => {
    const { container } = render(
      <TarefaCards
        tarefas={[mockTarefa]}
        // mostrarResponsavel not provided (undefined)
      />
    );

    // The responsible person name should NOT be visible
    const text = container.textContent;
    expect(text).not.toContain('João Silva');
  });
});
