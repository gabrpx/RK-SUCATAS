// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ElementType } from 'react';
import '@testing-library/jest-dom/vitest';
import { TasksNavigationDock } from './TasksNavigationDock';

vi.mock('../hooks/usePermissao', () => ({
  usePermissao: () => ({ pode: () => true }),
}));

vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = (props: Record<string, unknown>) => {
        const { initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, style, ...rest } = props;
        const Tag = tag as ElementType;
        return <Tag {...rest} style={style} />;
      };
      Component.displayName = `motion.${tag}`;
      return Component;
    },
  }),
  useMotionValue: (value: number) => ({ get: () => value, set: vi.fn() }),
  useSpring: (value: unknown) => value,
  useTransform: (value: { get: () => number }, transform: (value: number) => unknown) => ({ get: () => transform(value.get()) }),
  AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
}));

describe('<TasksNavigationDock>', () => {
  afterEach(() => cleanup());

  it('mantém os atalhos principais no mobile e agrupa as demais opções em Mais', () => {
    render(<TasksNavigationDock activeTab="tarefas" onTabChange={vi.fn()} onLogoutClick={vi.fn()} />);

    expect(screen.getByTestId('tasks-navigation-mobile')).toBeInTheDocument();
    expect(within(screen.getByTestId('tasks-navigation-mobile')).getByRole('button', { name: 'Mais opções de navegação' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('tasks-navigation-mobile')).getByRole('button', { name: 'Mais opções de navegação' }));

    const dialog = screen.getByRole('dialog', { name: 'Mais opções de navegação' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Clientes' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('renderiza o tooltip fora da região que pode rolar horizontalmente', () => {
    render(<TasksNavigationDock activeTab="tarefas" onTabChange={vi.fn()} onLogoutClick={vi.fn()} />);

    const desktopButton = screen.getAllByRole('button', { name: 'Dashboard' })[0];
    fireEvent.pointerEnter(desktopButton);

    const tooltip = screen.getByRole('tooltip', { name: 'Dashboard' });
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.closest('[data-dock-scroll-region]')).toBeNull();
  });

  it('esconde o tooltip ao sair do botão e evita o tooltip nativo persistente do navegador', () => {
    render(<TasksNavigationDock activeTab="tarefas" onTabChange={vi.fn()} onLogoutClick={vi.fn()} />);

    const button = screen.getAllByRole('button', { name: 'Dashboard' })[0];
    expect(button).not.toHaveAttribute('title');

    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
