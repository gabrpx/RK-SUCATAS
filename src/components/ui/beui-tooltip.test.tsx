// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Tooltip } from './beui-tooltip';

function mockHoverCapable() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover: hover'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  });
}

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockHoverCapable();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('shows tooltip content on mouseEnter after delay', () => {
    render(
      <Tooltip content="Estoque" side="right">
        <button>icon</button>
      </Tooltip>
    );

    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.mouseEnter(screen.getByText('icon'));
    act(() => { vi.advanceTimersByTime(150); });

    expect(screen.getByRole('tooltip')).toHaveTextContent('Estoque');
  });

  it('starts exit animation on mouseLeave', () => {
    render(
      <Tooltip content="Vendas" side="right">
        <button>icon</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('icon'));
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Vendas');

    fireEvent.mouseLeave(screen.getByText('icon'));
    act(() => { vi.advanceTimersByTime(50); });

    const tooltip = screen.queryByRole('tooltip');
    if (tooltip) {
      const opacity = tooltip.style.opacity;
      expect(Number(opacity)).toBeLessThan(1);
    }
  });

  it('sets aria-describedby on the trigger', () => {
    render(
      <Tooltip content="Dashboard" side="right">
        <button>icon</button>
      </Tooltip>
    );

    expect(screen.getByText('icon')).toHaveAttribute('aria-describedby');
  });
});
