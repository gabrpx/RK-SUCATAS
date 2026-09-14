// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Select } from './Select';

// AnimatePresence tem exit animado (fade/scale) — sem mockar, o item some do
// DOM só depois da animação, e o teste de Escape (síncrono) veria o item
// ainda presente. Mesmo padrão usado em ClienteDetalheModal.test.tsx e
// PendenciasUnificadasTab.test.tsx: motion.tag vira o elemento puro,
// AnimatePresence some com o exit imediatamente.
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
  { value: 'c', label: 'Gama' },
];

describe('<Select>', () => {
  afterEach(() => {
    cleanup();
  });

  it('mostra label do valor selecionado', () => {
    render(<Select label="X" options={opts} value="b" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Beta');
  });
  it('abre listbox no click e escolhe uma opção', () => {
    const onChange = vi.fn();
    render(<Select label="X" options={opts} value="" onChange={onChange} placeholder="Escolha" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Gama'));
    expect(onChange).toHaveBeenCalledWith('c');
  });
  it('fecha com Escape', () => {
    render(<Select label="X" options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('aria-labelledby combina id do label + id do valor quando label passado', () => {
    render(<Select label="Estado" options={opts} value="b" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    const aria = btn.getAttribute('aria-labelledby');
    expect(aria).toBeTruthy();
    const parts = aria!.split(' ');
    expect(parts).toHaveLength(2);
    // Ambos os ids devem existir no DOM
    parts.forEach((id) => {
      expect(document.getElementById(id)).not.toBeNull();
    });
  });

  it('aria-labelledby ausente quando label não passado', () => {
    render(<Select options={opts} value="a" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-labelledby')).toBeNull();
  });
});
