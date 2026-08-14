// Corpo real da remoção de fundo, rodando dentro de um Web Worker — ver
// removerFundoImagem.ts pro porquê: onnxruntime-web só evita bloquear a
// thread que chama session.run() quando device:'gpu' (WebGPU), que não é
// garantido em todo navegador/iOS. Rodando aqui dentro, o bloqueio fica
// isolado no worker e a main thread (e a UI) nunca trava.
//
// Sem DOM aqui: usa OffscreenCanvas em vez de document.createElement('canvas')
// — suportado em Web Workers desde Safari 16.4/Chrome/Firefox.

export interface ResultadoRemocaoFundoWorker {
  id: string;
  sucesso: boolean;
  blob: Blob | null;
}

const QUALIDADE_JPEG = 0.85;

async function aplicarFundoBranco(recorte: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(recorte);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D não disponível');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALIDADE_JPEG });
}

export async function processarMensagem(mensagem: { id: string; entrada: File | Blob | string }): Promise<ResultadoRemocaoFundoWorker> {
  const { id, entrada } = mensagem;
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const recorte = await removeBackground(entrada);
    const blob = await aplicarFundoBranco(recorte);
    return { id, sucesso: true, blob };
  } catch (err) {
    console.warn('Falha ao remover fundo da imagem (worker):', err);
    return { id, sucesso: false, blob: null };
  }
}

// self só existe em contexto real de worker (não durante os testes, que
// importam processarMensagem diretamente).
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = async (event: MessageEvent<{ id: string; entrada: File | Blob | string }>) => {
    const resultado = await processarMensagem(event.data);
    (self as unknown as Worker).postMessage(resultado);
  };
}
