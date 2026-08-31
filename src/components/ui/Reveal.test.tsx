// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Reveal } from './Reveal';

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce') ? reduced : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('<Reveal>', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('renderiza children normalmente', () => {
    render(<Reveal>hello</Reveal>);
    expect(screen.getByText('hello')).toBeDefined();
  });
});
