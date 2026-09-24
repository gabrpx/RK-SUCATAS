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
  it('fecha a lista com Escape e escolhe uma opção com teclado', () => {
    const onChange = vi.fn();
    render(<Combobox label="X" options={opts.slice(0, 5)} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    const option = screen.getByRole('option', { name: 'Opção 2' });
    option.focus();
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('v2');

    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByPlaceholderText(/buscar/i), { key: 'Escape' });
    expect(screen.queryByRole('option', { name: 'Opção 2' })).toBeNull();
  });
  it('lista com > 100 itens renderiza sem travar (virtual)', () => {
    render(<Combobox label="X" options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    // Só um subset renderiza (janela virtual)
    const items = screen.getAllByRole('option');
    expect(items.length).toBeLessThan(opts.length);
  });

  it('aria-labelledby combina id do label + id do valor quando label passado', () => {
    render(<Combobox label="Cidade" options={opts.slice(0, 5)} value="v2" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    const aria = btn.getAttribute('aria-labelledby');
    expect(aria).toBeTruthy();
    const parts = aria!.split(' ');
    expect(parts).toHaveLength(2);
    parts.forEach((id) => {
      expect(document.getElementById(id)).not.toBeNull();
    });
  });

  it('aria-labelledby ausente quando label não passado', () => {
    render(<Combobox options={opts.slice(0, 3)} value="" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-labelledby')).toBeNull();
  });

  it('navega pelas opções com setas e escolhe com Enter, sem depender de Tab', () => {
    const onChange = vi.fn();
    render(<Combobox label="X" options={opts.slice(0, 5)} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    // O mock de motion remonta o elemento a cada render: consulte de novo.
    const busca = () => screen.getByRole('combobox');
    fireEvent.keyDown(busca(), { key: 'ArrowDown' });
    fireEvent.keyDown(busca(), { key: 'ArrowDown' });
    expect(busca().getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Opção 2' }).id);
    fireEvent.keyDown(busca(), { key: 'ArrowUp' });
    fireEvent.keyDown(busca(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('v1');
  });

  it('Escape fecha só a lista, interrompe a propagação e devolve o foco ao campo', () => {
    const escapeNoDocumento = vi.fn();
    document.addEventListener('keydown', escapeNoDocumento, { capture: true });
    render(<Combobox label="X" options={opts.slice(0, 5)} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(escapeNoDocumento).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button'));
    document.removeEventListener('keydown', escapeNoDocumento, { capture: true });
  });

  it('abre com seta para baixo a partir do campo fechado', () => {
    render(<Combobox label="X" options={opts.slice(0, 5)} value="v3" onChange={() => {}} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(screen.getByRole('combobox').getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Opção 3' }).id);
  });
});
