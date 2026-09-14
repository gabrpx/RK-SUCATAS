// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const refreshData = vi.fn().mockResolvedValue(undefined);
const moverPecaGaveta = vi.fn();

vi.mock('../../../context/DataContext', () => ({ useData: () => ({ refreshData }) }));
vi.mock('./api', () => ({
  gavetasApi: { moverPecaGaveta: (...args: unknown[]) => moverPecaGaveta(...args) },
}));

import { useMoverPecasGaveta } from './hooks';

afterEach(() => {
  refreshData.mockClear();
  moverPecaGaveta.mockReset();
});

describe('useMoverPecasGaveta', () => {
  it('move várias peças e atualiza o estoque uma única vez', async () => {
    moverPecaGaveta.mockResolvedValue({ success: true, data: {} });
    const { result } = renderHook(() => useMoverPecasGaveta());

    let resposta: Awaited<ReturnType<typeof result.current.moverEmLote>>;
    await act(async () => { resposta = await result.current.moverEmLote(['a', 'b', 'c'], 'g1'); });

    expect(moverPecaGaveta).toHaveBeenCalledTimes(3);
    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(resposta!.sucesso.sort()).toEqual(['a', 'b', 'c']);
    expect(resposta!.falhas).toEqual([]);
  });

  it('informa falha parcial sem desfazer os itens já movidos', async () => {
    moverPecaGaveta.mockImplementation((id: string) => Promise.resolve(
      id === 'b' ? { success: false, error: 'boom' } : { success: true, data: {} }
    ));
    const { result } = renderHook(() => useMoverPecasGaveta());

    let resposta: Awaited<ReturnType<typeof result.current.moverEmLote>>;
    await act(async () => { resposta = await result.current.moverEmLote(['a', 'b', 'c'], 'g1'); });

    expect(resposta!.sucesso.sort()).toEqual(['a', 'c']);
    expect(resposta!.falhas).toEqual([{ id: 'b', error: 'boom' }]);
    expect(refreshData).toHaveBeenCalledTimes(1);
  });
});
