// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

afterEach(cleanup);

describe('<CurrencyInput>', () => {
  it('renderiza valor em BRL', () => {
    render(<CurrencyInput label="Preço" value={12345} onChange={() => {}} />);
    expect((screen.getByLabelText('Preço') as HTMLInputElement).value).toContain('123,45');
  });
  it('emite cents ao digitar', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Preço" value={0} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Preço'), { target: { value: 'R$ 12,34' } });
    expect(onChange).toHaveBeenCalledWith(1234);
  });
  it('mantém R$ visível e permite apagar somente o valor numérico', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Preço" value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Preço') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.parentElement?.textContent).toContain('R$');
    fireEvent.change(input, { target: { value: '12,50' } });
    expect(onChange).toHaveBeenLastCalledWith(1250);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input.parentElement?.textContent).toContain('R$');
  });
  it('stepper +/- respeita stepCents', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="P" value={500} onChange={onChange} showStepper stepCents={100} />);
    fireEvent.click(screen.getByRole('button', { name: /aumentar/i }));
    expect(onChange).toHaveBeenLastCalledWith(600);
    fireEvent.click(screen.getByRole('button', { name: /diminuir/i }));
    expect(onChange).toHaveBeenLastCalledWith(400);
  });
});
