// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { PhoneInput } from './PhoneInput';

afterEach(cleanup);

describe('<PhoneInput>', () => {
  it('exibe valor formatado a partir de dígitos', () => {
    render(<PhoneInput label="Tel" value="83999999999" onChange={() => {}} />);
    const input = screen.getByLabelText('Tel') as HTMLInputElement;
    expect(input.value).toBe('(83) 9 9999-9999');
  });
  it('emite onChange com dígitos puros ao digitar', () => {
    const onChange = vi.fn();
    render(<PhoneInput label="Tel" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Tel');
    fireEvent.change(input, { target: { value: '(83) 9 9999-9999' } });
    expect(onChange).toHaveBeenCalledWith('83999999999');
  });
});
