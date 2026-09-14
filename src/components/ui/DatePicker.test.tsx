// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatePicker } from './DatePicker';

afterEach(cleanup);

describe('<DatePicker>', () => {
  it('renderiza valor em pt-BR dd/MM/yyyy', () => {
    render(<DatePicker label="D" value={new Date(2026, 7, 28)} onChange={() => {}} />);
    expect((screen.getByLabelText('D') as HTMLInputElement).value).toBe('28/08/2026');
  });
  it('parse manual do input dispara onChange', () => {
    const onChange = vi.fn();
    render(<DatePicker label="D" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('D'), { target: { value: '15/03/2027' } });
    fireEvent.blur(screen.getByLabelText('D'));
    expect(onChange).toHaveBeenCalledWith(new Date(2027, 2, 15));
  });
});
