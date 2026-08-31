// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CommandPalette } from './CommandPalette';

// AnimatePresence tem exit animado — sem mockar, o conteúdo só some do DOM
// depois da animação. Mesmo padrão de Sheet.test.tsx: motion.tag vira o
// elemento puro, AnimatePresence some com o exit imediatamente.
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) => {
      const C = (props: any) => {
        const { initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, ...rest } = props;
        const Tag = tag as any;
        return <Tag {...rest} />;
      };
      C.displayName = `motion.${tag}`;
      return C;
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('<CommandPalette>', () => {
  afterEach(() => {
    cleanup();
  });

  const items = [
    { key: 'a', label: 'Ir pra Estoque', shortcut: 'g e', onSelect: vi.fn() },
    { key: 'b', label: 'Novo Cliente', shortcut: 'n c', onSelect: vi.fn() },
  ];
  it('filtra por query', () => {
    render(<CommandPalette open onOpenChange={() => {}} items={items} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cliente' } });
    // highlightMatch quebra o label em <span>Novo </span><span>Cliente</span>,
    // então o texto fica dividido entre nós — precisa de matcher por função
    // (getByText com regex simples não vê através da quebra de elementos).
    expect(screen.getByText((_, node) => node?.textContent === 'Novo Cliente')).toBeDefined();
    expect(screen.queryByText(/Ir pra Estoque/)).toBeNull();
  });
  it('Enter executa onSelect do primeiro resultado', () => {
    render(<CommandPalette open onOpenChange={() => {}} items={items} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cliente' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(items[1].onSelect).toHaveBeenCalled();
  });
});
