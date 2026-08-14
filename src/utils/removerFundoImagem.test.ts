import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@imgly/background-removal', () => ({
  removeBackground: vi.fn(),
}));

import { removeBackground } from '@imgly/background-removal';
import { removerFundoImagem } from './removerFundoImagem';

// removerFundoImagem usa canvas (document.createElement('canvas') +
// createImageBitmap) pra compositar o recorte transparente em fundo branco —
// vitest roda em ambiente Node por padrão (sem jsdom/canvas real), então os
// testes stubam só a fatia da API de canvas que a função realmente chama.
function instalarStubsDeCanvas() {
  const ctxFake = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvasFake: any = {
    width: 0,
    height: 0,
    getContext: () => ctxFake,
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['fundo-branco'], { type: 'image/jpeg' })),
  };
  vi.stubGlobal('document', { createElement: () => canvasFake });
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10, height: 10, close: () => {} }));
}

describe('removerFundoImagem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sucesso: devolve { sucesso: true, blob } com o fundo composto em branco (JPEG)', async () => {
    instalarStubsDeCanvas();
    vi.mocked(removeBackground).mockResolvedValue(new Blob(['recorte-transparente'], { type: 'image/png' }));

    const resultado = await removerFundoImagem('https://exemplo.com/foto.jpg');

    expect(resultado.sucesso).toBe(true);
    expect(resultado.blob).toBeInstanceOf(Blob);
    expect(resultado.blob?.type).toBe('image/jpeg');
  });

  // Nunca lança: se a lib de remoção de fundo falhar (modelo não carrega,
  // WASM bloqueado, imagem não suportada), o usuário segue publicando o
  // anúncio com a foto original — sem isso, uma falha aqui travaria a
  // publicação inteira.
  it('falha: removeBackground rejeitando devolve { sucesso: false, blob: null } sem lançar', async () => {
    vi.mocked(removeBackground).mockRejectedValue(new Error('modelo indisponível'));

    const resultado = await removerFundoImagem('https://exemplo.com/foto.jpg');

    expect(resultado).toEqual({ sucesso: false, blob: null });
  });
});
