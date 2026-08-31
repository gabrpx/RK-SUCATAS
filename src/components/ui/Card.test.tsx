// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Card } from './Card';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

describe('Card', () => {
  it('renderiza variant="default" com className repassado e children', () => {
    render(
      <Card className="custom-class" data-testid="card">
        conteúdo
      </Card>
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-class');
    expect(card).toHaveTextContent('conteúdo');
  });

  it('aplica shadow-glow-accent quando variant="highlight"', () => {
    render(
      <Card variant="highlight" data-testid="card-highlight">
        destaque
      </Card>
    );
    expect(screen.getByTestId('card-highlight')).toHaveClass('shadow-glow-accent');
  });
});
