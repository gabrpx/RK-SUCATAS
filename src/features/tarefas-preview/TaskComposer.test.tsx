// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ElementType, ReactNode } from 'react';
import { TaskComposer } from './TaskComposer';

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
});
