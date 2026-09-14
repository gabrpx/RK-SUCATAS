// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimePicker } from './TimePicker';

describe('<TimePicker>', () => {
  it('renderiza valor', () => {
    render(<TimePicker label="Hora" value="14:30" onChange={() => {}} />);
    expect((screen.getByLabelText('Hora') as HTMLInputElement).value).toBe('14:30');
  });
  it('mascara digits em HH:mm', () => {
    const onChange = vi.fn();
    render(<TimePicker label="H" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('H'), { target: { value: '0930' } });
    expect(onChange).toHaveBeenCalledWith('09:30');
  });
});
