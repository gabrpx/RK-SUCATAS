// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Input } from './Input';

describe('<Input>', () => {
  afterEach(() => {
    cleanup();
  });


  it('renderiza label acima e associa htmlFor/id', () => {
    render(<Input label="E-mail" id="email" />);
    const input = screen.getByLabelText('E-mail');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).id).toBe('email');
  });

  it('exibe helper quando não há erro', () => {
    render(<Input label="X" helper="Ajuda" />);
    expect(screen.getByText('Ajuda')).toBeDefined();
  });

  it('substitui helper por error quando error existe', () => {
    render(<Input label="X" helper="Ajuda" error="Obrigatório" />);
    expect(screen.queryByText('Ajuda')).toBeNull();
    expect(screen.getByText('Obrigatório')).toBeDefined();
  });

  it('dispara onClear quando clearable e onClear passados', () => {
    const onClear = vi.fn();
    render(<Input label="X" value="abc" onChange={() => {}} clearable onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: /limpar/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
