// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MultiSelect } from './MultiSelect';

// AnimatePresence tem exit animado (fade/scale) — sem mockar, o item some do
// DOM só depois da animação. Mesmo padrão de Select.test.tsx / Combobox.test.tsx
// (R9): motion.tag vira o elemento puro, AnimatePresence some com o exit
// imediatamente. layoutId também é descartado.
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

const opts = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('<MultiSelect>', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza chip por valor selecionado', () => {
    render(<MultiSelect label="X" options={opts} value={['a', 'b']} onChange={() => {}} />);
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
  });
  it('remove chip ao clicar no X', () => {
    const onChange = vi.fn();
    render(<MultiSelect label="X" options={opts} value={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: /remover/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});
