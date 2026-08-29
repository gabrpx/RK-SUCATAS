// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Combobox } from './Combobox';

// AnimatePresence tem exit animado (fade/scale) — sem mockar, o item some do
// DOM só depois da animação, o que atrapalharia asserts síncronos após
// abrir/fechar. Mesmo padrão de ClienteDetalheModal.test.tsx e
// Select.test.tsx (Task 11): motion.tag vira o elemento puro, AnimatePresence
// some com o exit imediatamente. layoutId também é descartado (R9).
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

const opts = Array.from({ length: 200 }, (_, i) => ({ value: `v${i}`, label: `Opção ${i}` }));

describe('<Combobox>', () => {
  afterEach(() => {
    cleanup();
  });

  it('filtra por busca case-insensitive', () => {
    render(<Combobox label="X" options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'opção 42' } });
    expect(screen.getByText('Opção 42')).toBeDefined();
    expect(screen.queryByText('Opção 1')).toBeNull();
  });
  it('escolhe uma opção', () => {
    const onChange = vi.fn();
    render(<Combobox label="X" options={opts.slice(0, 5)} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Opção 2'));
    expect(onChange).toHaveBeenCalledWith('v2');
  });
  it('lista com > 100 itens renderiza sem travar (virtual)', () => {
    render(<Combobox label="X" options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    // Só um subset renderiza (janela virtual)
    const items = screen.getAllByRole('option');
    expect(items.length).toBeLessThan(opts.length);
  });
});
