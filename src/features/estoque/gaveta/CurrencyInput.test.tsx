// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

afterEach(cleanup);

describe('CurrencyInput', () => {
  it('formata dígitos como R$ pt-BR e emite número', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={null} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '125000' } });
    expect(onChange).toHaveBeenLastCalledWith(1250);
    expect((input as HTMLInputElement).value).toContain('1.250,00');
  });

  it('mostra valor inicial formatado', () => {
    render(<CurrencyInput value={80} onChange={() => {}} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toContain('80,00');
  });
});
