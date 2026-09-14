// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { DocInput } from './DocInput';

afterEach(cleanup);

describe('<DocInput>', () => {
  it('formata como CPF até 11 dígitos', () => {
    render(<DocInput label="Doc" value="12345678900" onChange={() => {}} />);
    expect((screen.getByLabelText('Doc') as HTMLInputElement).value).toBe('123.456.789-00');
  });
  it('formata como CNPJ para 14 dígitos', () => {
    render(<DocInput label="Doc" value="12345678000199" onChange={() => {}} />);
    expect((screen.getByLabelText('Doc') as HTMLInputElement).value).toBe('12.345.678/0001-99');
  });
  it('emite onValidityChange com kind correto', () => {
    const onValid = vi.fn();
    const { rerender } = render(
      <DocInput label="Doc" value="52998224725" onChange={() => {}} onValidityChange={onValid} />
    );
    expect(onValid).toHaveBeenCalledWith(true, 'cpf');
    rerender(<DocInput label="Doc" value="11444777000161" onChange={() => {}} onValidityChange={onValid} />);
    expect(onValid).toHaveBeenLastCalledWith(true, 'cnpj');
  });
});
