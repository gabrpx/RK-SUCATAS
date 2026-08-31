// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Textarea } from './Textarea';

afterEach(cleanup);

describe('<Textarea>', () => {
  it('renderiza label associado', () => {
    render(<Textarea label="Descrição" />);
    expect(screen.getByLabelText('Descrição')).toBeDefined();
  });
  it('showCount exibe contador atualizado', () => {
    render(<Textarea label="X" showCount maxLength={100} defaultValue="hello" />);
    expect(screen.getByText('5 / 100')).toBeDefined();
  });
  it('showCount atualiza ao digitar', () => {
    render(<Textarea label="X" showCount maxLength={100} />);
    const t = screen.getByLabelText('X') as HTMLTextAreaElement;
    fireEvent.change(t, { target: { value: 'abc' } });
    expect(screen.getByText('3 / 100')).toBeDefined();
  });
});
