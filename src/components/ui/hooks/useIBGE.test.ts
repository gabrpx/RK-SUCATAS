// @vitest-environment jsdom
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useUFs, useCidades } from './useIBGE';

afterEach(() => {
  cleanup();
});

describe('useIBGE', () => {
  it('useUFs retorna 27 UFs', async () => {
    const { result } = renderHook(() => useUFs());
    await waitFor(() => expect(result.current.length).toBe(27));
    expect(result.current.map((u) => u.sigla)).toContain('PB');
  });

  it('useCidades("PB") contém Juazeirinho', async () => {
    const { result } = renderHook(() => useCidades('PB'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toContain('Juazeirinho');
  });

  it('useCidades("") retorna vazio', () => {
    const { result } = renderHook(() => useCidades(''));
    expect(result.current.data).toEqual([]);
  });
});
