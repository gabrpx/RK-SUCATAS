// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ElementType, ReactNode } from 'react';
import { TaskComposer } from './TaskComposer';
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
          onExitComplete,
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
        void onExitComplete;
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

describe('<TaskComposer>', () => {
  afterEach(() => cleanup());

  it('inicia uma nova tarefa sem etapas de checklist pré-preenchidas', () => {
    render(<TaskComposer open onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.queryByDisplayValue('Conferir condição da peça')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Registrar localização no estoque')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar etapa/i })).toBeInTheDocument();
  });

  it('preenche a tarefa existente e envia os valores alterados no modo de edição', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const tarefa: PreviewTask = {
      id: 'task-1',
      title: 'Montar XRE',
      area: 'Estoque',
      category: 'estoque',
      priority: 'alta',
      status: 'aguardando',
      dueLabel: 'Hoje às 17:30',
      estimateMinutes: 30,
      operatorIds: ['ayrton'],
      instructions: 'Separar peças antes de iniciar.',
      checklist: [{ id: 'item-1', label: 'Conferir peças', completed: false, owner: 'ayrton' }],
    };

    render(
      <TaskComposer
        open
        initialTask={tarefa}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        operators={[{ id: 'ayrton', name: 'Ayrton', initials: 'AY', tone: 'bg-amber-100 text-amber-800 ring-amber-200' }]}
      />,
    );

    expect(screen.getByDisplayValue('Montar XRE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Conferir peças')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Montar XRE'), { target: { value: 'Montar XRE 300' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Montar XRE 300',
      checklistItems: [{ id: 'item-1', label: 'Conferir peças', owner: 'ayrton' }],
    })));
  });
});
