// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMotionTier } from './useMotionTier';

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

describe('useMotionTier', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
  });

  it('retorna "reduced" quando prefers-reduced-motion está ativo', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMotionTier());
    expect(result.current).toBe('reduced');
  });

  it('retorna "low" quando deviceMemory < 4 e reduced-motion desativado', () => {
    mockMatchMedia(false);
    Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true });
    const { result } = renderHook(() => useMotionTier());
    expect(result.current).toBe('low');
  });

  it('retorna "showcase" quando deviceMemory >= 4 e reduced-motion desativado', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMotionTier());
    expect(result.current).toBe('showcase');
  });
});
