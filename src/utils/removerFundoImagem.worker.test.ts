import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@imgly/background-removal', () => ({
  removeBackground: vi.fn(),
}));

import { removeBackground } from '@imgly/background-removal';
import { processarMensagem } from './removerFundoImagem.worker';

// O worker roda fora do DOM: sem document, usa OffscreenCanvas (suportado em
// Web Workers no Safari 16.4+/Chrome/Firefox) pra compositar o recorte
// transparente em fundo branco. Stub cobre só a fatia da API que o worker
// realmente chama, mesmo espírito do stub de canvas em removerFundoImagem.test.ts.
function instalarStubsDeOffscreenCanvas() {
  const ctxFake = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvasFake: any = {
    getContext: () => ctxFake,
    convertToBlob: vi.fn().mockResolvedValue(new Blob(['fundo-branco'], { type: 'image/jpeg' })),
  };
  vi.stubGlobal('OffscreenCanvas', function OffscreenCanvas() { return canvasFake; } as unknown as typeof globalThis.OffscreenCanvas);
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10, height: 10, close: vi.fn() }));
}

describe('removerFundoImagem.worker: processarMensagem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sucesso: devolve { id, sucesso: true, blob } com o fundo composto em branco (JPEG)', async () => {
    instalarStubsDeOffscreenCanvas();
    vi.mocked(removeBackground).mockResolvedValue(new Blob(['recorte-transparente'], { type: 'image/png' }));

    const resultado = await processarMensagem({ id: 'foto-1', entrada: 'https://exemplo.com/foto.jpg' });

    expect(resultado.id).toBe('foto-1');
    expect(resultado.sucesso).toBe(true);
    expect(resultado.blob).toBeInstanceOf(Blob);
    expect(resultado.blob?.type).toBe('image/jpeg');
  });

  it('falha: removeBackground rejeitando devolve { id, sucesso: false, blob: null } sem lançar', async () => {
    vi.mocked(removeBackground).mockRejectedValue(new Error('modelo indisponível'));

    const resultado = await processarMensagem({ id: 'foto-2', entrada: 'https://exemplo.com/foto.jpg' });

    expect(resultado).toEqual({ id: 'foto-2', sucesso: false, blob: null });
  });
});
