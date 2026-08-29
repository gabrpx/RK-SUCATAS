// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Button } from './button';

// Magnetic (usado pelo variant accent-cta) checa `pointer:coarse` via
// matchMedia pra decidir se desliga o efeito no touch; jsdom não implementa
// matchMedia, então precisa do mesmo mock usado em Reveal.test.tsx.
function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('<Button>', () => {
  beforeEach(() => {
    mockMatchMedia();
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza label', () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole('button', { name: 'OK' })).toBeDefined();
  });

  it('aceita variant accent-cta sem quebrar', () => {
    render(<Button variant="accent-cta">Confirmar</Button>);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDefined();
  });

  it('aceita variant positive', () => {
    render(<Button variant="positive">Ok</Button>);
    expect(screen.getByRole('button', { name: 'Ok' })).toBeDefined();
  });

  it('aceita size mobile', () => {
    render(<Button size="mobile">Tap</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-11');
  });
});
