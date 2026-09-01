// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TarefaCards } from './TarefaCards';
import type { Tarefa, TarefaItem } from './types';

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

// Item do checklist marcado por alguém (Tarefa 2 — "Tarefa para Todos"): cada
// linha criada pro "todos" é independente, então cada uma tem seu próprio
// concluido_por/concluido_por_usuario — a UI precisa mostrar quem concluiu
// cada item, não só que ele foi concluído.
function itemChecklist(overrides: Partial<TarefaItem> = {}): TarefaItem {
  return {
    id: 'item-1',
    texto: 'Ligar pro cliente',
    concluido: false,
    ordem: 0,
    concluido_em: null,
    concluido_por: null,
    concluido_por_usuario: null,
    ...overrides,
  };
}

const mockTarefaComChecklist: Tarefa = {
  id: 'tarefa-checklist-1',
  titulo: 'Tarefa com checklist',
  descricao: null,
  prazo: null,
  atribuido_para: 'user-1',
  criado_por: 'user-2',
  status: 'pendente',
  prioridade: 'media',
  tipo: 'geral',
  cliente_id: null,
  concluida_em: null,
  criado_em: '2026-01-01T00:00:00Z',
  atualizado_em: '2026-01-01T00:00:00Z',
  atribuido: { id: 'user-1', nome_exibicao: 'João Silva' },
  criador: { id: 'user-2', nome_exibicao: 'Admin User' },
  cliente: null,
  itens: [],
};

// Abre o painel de detalhes clicando no título do card (mesmo clique que o
// usuário faria) — o checklist só é renderizado dentro do painel expandido.
function abrirPainel(container: HTMLElement, titulo: string) {
  const titulos = Array.from(container.querySelectorAll('h2, p')).filter((el) => el.textContent === titulo);
  fireEvent.click(titulos[0]);
}

describe('ItemChecklistArrastavel — linha "Concluído por"', () => {
  it('mostra "Concluído por X há Y" (tempo curto e relativo, sem data absoluta) quando o item concluído tem concluido_por_usuario', () => {
    const tarefa: Tarefa = {
      ...mockTarefaComChecklist,
      itens: [itemChecklist({ id: 'i1', concluido: true, concluido_em: '2026-01-01T10:00:00Z', concluido_por: 'user-9', concluido_por_usuario: { id: 'user-9', nome_exibicao: 'Eduardo' } })],
    };
    const { container } = render(<TarefaCards tarefas={[tarefa]} />);
    abrirPainel(container, 'Tarefa com checklist');

    // Escopado à <li> do item (não ao container inteiro): o painel também
    // mostra "Designada em: ..." com formatarMomentoRelativo (data absoluta +
    // "às"), que é uma linha DIFERENTE e continua correta como está — só a
    // linha do item concluído precisa ser "há X" curto e sem data absoluta.
    const linhaDoItem = Array.from(container.querySelectorAll('li')).find((li) => li.textContent?.includes('Ligar pro cliente'));
    expect(linhaDoItem).toBeTruthy();
    // formatarTempoRelativoCurto — "há Xmin"/"há Xh"/"ontem"/"há Xd"/"agora",
    // nunca a data absoluta (sem "às", sem "/") — bate com o exemplo do spec
    // ("Concluído por Eduardo há 2 horas") em vez do formato "abs · rel atrás"
    // de formatarMomentoRelativo.
    expect(linhaDoItem!.textContent).toMatch(/Concluído por Eduardo (agora|ontem|há \d+(min|h|d))/);
    expect(linhaDoItem!.textContent).not.toContain('às');
  });

  it('não mostra a linha "Concluído por" quando o item não está concluído', () => {
    const tarefa: Tarefa = {
      ...mockTarefaComChecklist,
      itens: [itemChecklist({ id: 'i1', concluido: false })],
    };
    const { container } = render(<TarefaCards tarefas={[tarefa]} />);
    abrirPainel(container, 'Tarefa com checklist');

    expect(container.textContent).not.toContain('Concluído por');
  });

  it('não mostra a linha "Concluído por" quando o item está concluído mas sem concluido_por_usuario (dado antigo)', () => {
    const tarefa: Tarefa = {
      ...mockTarefaComChecklist,
      itens: [itemChecklist({ id: 'i1', concluido: true, concluido_em: '2026-01-01T10:00:00Z', concluido_por: 'user-9', concluido_por_usuario: null })],
    };
    const { container } = render(<TarefaCards tarefas={[tarefa]} />);
    abrirPainel(container, 'Tarefa com checklist');

    expect(container.textContent).not.toContain('Concluído por');
  });
});
