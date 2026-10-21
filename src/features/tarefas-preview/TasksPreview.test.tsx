// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ElementType, ReactNode } from 'react';
import { TasksPreview } from './TasksPreview';
import type { PreviewTask } from './taskPreviewModel';

vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) => {
        const {
          initial,
          animate,
          exit,
          transition,
          whileHover,
          whileTap,
          layout,
          layoutId,
          ...rest
        } = props;
        void initial;
        void animate;
        void exit;
        void transition;
        void whileHover;
        void whileTap;
        void layout;
        void layoutId;
        const Tag = tag as ElementType;
        return <Tag {...rest}>{children}</Tag>;
      };
      Component.displayName = `motion.${tag}`;
      return Component;
    },
  }),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
}));

vi.mock('@/src/components/ui/hooks/useConfirm', () => ({
  useConfirm: () => vi.fn(),
}));

const tarefa = (id: string, title: string, status: PreviewTask['status']): PreviewTask => ({
  id,
  title,
  area: 'Estoque',
  category: 'estoque',
  priority: 'normal',
  status,
  dueLabel: status === 'concluida' ? 'Concluída agora' : 'Hoje às 18:00',
  estimateMinutes: 20,
  operatorIds: ['ayrton'],
  instructions: `Instruções para ${title}`,
  checklist: [],
});

describe('<TasksPreview>', () => {
  afterEach(() => cleanup());

  it('exibe a aba Concluídas e mostra somente tarefas concluídas ao selecioná-la', () => {
    render(
      <TasksPreview
        integrated
        initialTasks={[
          tarefa('aberta-1', 'Tarefa ainda aberta', 'aguardando'),
          tarefa('concluida-1', 'Tarefa já concluída', 'concluida'),
        ]}
        initialReminders={[]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /Concluídas/i }));

    expect(screen.getByText('Tarefa já concluída')).toBeInTheDocument();
    expect(screen.queryByText('Tarefa ainda aberta')).not.toBeInTheDocument();
  });

  it('move a tarefa concluída pelo botão para a aba Concluídas e aplica o estado verde', async () => {
    const emAndamento = tarefa('execucao-1', 'Tarefa em execução', 'em-andamento');
    const concluida = { ...emAndamento, status: 'concluida' as const, dueLabel: 'Concluída agora' };
    const onAdvanceTask = vi.fn().mockResolvedValue(concluida);

    render(
      <TasksPreview
        integrated
        initialTasks={[emAndamento]}
        initialReminders={[]}
        onAdvanceTask={onAdvanceTask}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Tarefa em execução Instruções/i }));
    fireEvent.click(screen.getByRole('button', { name: /Concluir tarefa/i }));

    await waitFor(() => expect(onAdvanceTask).toHaveBeenCalledWith(emAndamento, 'concluida'));
    fireEvent.click(screen.getByRole('tab', { name: /Concluídas/i }));

    const article = screen.getAllByText('Tarefa em execução')
      .find((element) => element.closest('article'))
      ?.closest('article');
    expect(article).toHaveClass('border-emerald-200', 'bg-emerald-50/40');
  });
});
