// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Select } from './Select';
import { PopoverContent, PopoverRoot, PopoverTrigger } from './popover';

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
  MotionConfig: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
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
    expect(screen.getByRole('combobox')).toHaveTextContent('Beta');
  });
  it('abre listbox no click e escolhe uma opção', () => {
    const onChange = vi.fn();
    render(<Select label="X" options={opts} value="" onChange={onChange} placeholder="Escolha" />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Gama'));
    expect(onChange).toHaveBeenCalledWith('c');
  });
  it('fecha com Escape', () => {
    render(<Select label="X" options={opts} value="" onChange={() => {}} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('aria-labelledby referencia o label quando label passado', () => {
    render(<Select label="Estado" options={opts} value="b" onChange={() => {}} />);
    const btn = screen.getByRole('combobox');
    const aria = btn.getAttribute('aria-labelledby');
    expect(aria).toBeTruthy();
    expect(aria!.split(' ')).toHaveLength(1);
    expect(document.getElementById(aria!)).not.toBeNull();
  });

  it('aria-labelledby ausente quando label não passado', () => {
    render(<Select options={opts} value="a" onChange={() => {}} />);
    const btn = screen.getByRole('combobox');
    expect(btn.getAttribute('aria-labelledby')).toBeNull();
  });

  it('separa o destaque de hover da opção selecionada e ancora o menu ao gatilho', () => {
    render(<Select label="Estado" options={opts} value="b" onChange={() => {}} renderOption={(option, state) => `${option.label} · sel=${state.selected} · foco=${state.highlighted}`} />);
    fireEvent.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    expect(listbox.className).toContain('top-full');
    expect(listbox.className).not.toContain('mt-14');
    fireEvent.mouseEnter(screen.getByText('Alpha · sel=false · foco=false').closest('[role="option"]')!);
    expect(screen.getByText('Alpha · sel=false · foco=true')).toBeInTheDocument();
    expect(screen.getByText('Beta · sel=true · foco=false')).toBeInTheDocument();
  });

  it('seleciona a opção ativa com setas e Enter', () => {
    const onChange = vi.fn();
    render(<Select label="Estado" options={opts} value="b" onChange={onChange} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('Escape fecha apenas o Select aninhado e mantém aberto o popover pai', () => {
    render(<PopoverRoot><PopoverTrigger>Filtros</PopoverTrigger><PopoverContent><Select label="Período" options={opts} value="a" onChange={() => {}} /></PopoverContent></PopoverRoot>);
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const select = screen.getByRole('combobox');
    fireEvent.click(select);
    fireEvent.keyDown(select, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute('aria-expanded', 'true');
    expect(select).toHaveAttribute('aria-expanded', 'false');
  });
});
