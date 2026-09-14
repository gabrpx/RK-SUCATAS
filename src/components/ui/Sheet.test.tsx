// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Sheet } from './Sheet';

// AnimatePresence tem exit animado — sem mockar, o conteúdo só some do DOM
// depois da animação. Mesmo padrão de Select.test.tsx/ClienteDetalheModal.test.tsx:
// motion.tag vira o elemento puro, AnimatePresence some com o exit imediatamente.
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

describe('<Sheet>', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza título e children quando aberto', () => {
    render(<Sheet isOpen title="X" onClose={() => {}}>body</Sheet>);
    expect(screen.getByText('X')).toBeDefined();
    expect(screen.getByText('body')).toBeDefined();
  });
  it('fecha ao Escape', () => {
    const onClose = vi.fn();
    render(<Sheet isOpen title="X" onClose={onClose}>body</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
