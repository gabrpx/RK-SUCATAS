// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

vi.mock('../../utils/removerFundoImagem', () => ({
  removerFundoImagem: vi.fn(() => Promise.resolve({ sucesso: true, blob: new Blob(['x'], { type: 'image/jpeg' }) })),
}));
vi.mock('./api', () => ({
  uploadImagemEstoque: vi.fn(() => Promise.resolve({ success: true, url: 'https://cdn/sem-fundo.jpg' })),
  estoqueApi: {},
}));
vi.mock('../../utils/comprimirImagem', () => ({
  comprimirImagem: vi.fn((arquivo: File) => Promise.resolve({ arquivo })),
}));
vi.mock('../../components/ui/toast', () => ({
  aviso: { falha: vi.fn(), sucesso: vi.fn(), atencao: vi.fn() },
}));

import { removerFundoImagem } from '../../utils/removerFundoImagem';
import { uploadImagemEstoque } from './api';
import { useRemocaoFundoFotos } from './useRemocaoFundoFotos';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe('useRemocaoFundoFotos', () => {
  it('iniciarTodas dispara uma remoção por foto e produz uma prévia pra cada', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg', 'https://cdn/b.jpg']));

    await waitFor(() => expect(result.current.previews).toHaveLength(2));
    expect(removerFundoImagem).toHaveBeenCalledTimes(2);
    expect(result.current.previews.map((p) => p.originalUrl).sort()).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
  });

  it('iniciarTodas ignora foto que já tem prévia pronta, pra não reprocessar à toa', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(1));

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg', 'https://cdn/b.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(2));
    expect(removerFundoImagem).toHaveBeenCalledTimes(2);
  });

  it('aprovar sobe a foto e registra a troca em fotosProcessadas', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(1));

    let urlNova: string | null = null;
    await act(async () => {
      urlNova = await result.current.aprovar('https://cdn/a.jpg');
    });

    expect(uploadImagemEstoque).toHaveBeenCalledTimes(1);
    expect(urlNova).toBe('https://cdn/sem-fundo.jpg');
    expect(result.current.fotosProcessadas).toEqual({ 'https://cdn/a.jpg': 'https://cdn/sem-fundo.jpg' });
    expect(result.current.previews).toHaveLength(0);
  });

  it('falha na remoção não cria prévia e libera o slot de processamento', async () => {
    vi.mocked(removerFundoImagem).mockResolvedValueOnce({ sucesso: false } as any);
    const { result } = renderHook(() => useRemocaoFundoFotos());

    await act(async () => {
      await result.current.iniciar('https://cdn/a.jpg', 'https://cdn/a.jpg');
    });

    expect(result.current.previews).toHaveLength(0);
    expect(result.current.processandoUrls.size).toBe(0);
  });

  it('limparTudo descarta prévias e revoga os blobs', async () => {
    const { result } = renderHook(() => useRemocaoFundoFotos());

    act(() => result.current.iniciarTodas(['https://cdn/a.jpg']));
    await waitFor(() => expect(result.current.previews).toHaveLength(1));

    act(() => result.current.limparTudo());

    expect(result.current.previews).toHaveLength(0);
    expect(result.current.fotosProcessadas).toEqual({});
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
