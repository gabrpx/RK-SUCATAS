// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Drawer } from './Drawer';

// Drawer é alias do Sheet — mesmo mock de motion/react (R9), pelo mesmo
// motivo: AnimatePresence com exit animado precisa sumir sincronamente no teste.
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

describe('<Drawer>', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza como side sheet', () => {
    render(<Drawer isOpen title="Novo cliente" onClose={() => {}}>form</Drawer>);
    expect(screen.getByText('Novo cliente')).toBeDefined();
    expect(screen.getByText('form')).toBeDefined();
  });
});
