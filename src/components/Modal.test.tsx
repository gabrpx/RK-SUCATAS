// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Modal } from './Modal';

afterEach(() => {
  cleanup();
});

describe('<Modal>', () => {
  it('renderiza título e body quando isOpen', () => {
    render(<Modal isOpen title="X" onClose={() => {}}>corpo</Modal>);
    expect(screen.getByText('X')).toBeDefined();
    expect(screen.getByText('corpo')).toBeDefined();
  });
  it('não renderiza content quando isOpen=false', () => {
    render(<Modal isOpen={false} title="X" onClose={() => {}}>corpo</Modal>);
    expect(screen.queryByText('corpo')).toBeNull();
  });
  it('chama onClose ao clicar no X', () => {
    const onClose = vi.fn();
    render(<Modal isOpen title="X" onClose={onClose}>corpo</Modal>);
    fireEvent.click(screen.getByRole('button', { name: '' }));   // botão X (sem label visível, mas único role button)
    expect(onClose).toHaveBeenCalled();
  });
  it('renderiza footer quando passado', () => {
    render(<Modal isOpen title="X" onClose={() => {}} footer={<div>footer!</div>}>corpo</Modal>);
    expect(screen.getByText('footer!')).toBeDefined();
  });
});
