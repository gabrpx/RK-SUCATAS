// Remove o fundo da foto no próprio navegador (WASM, @imgly/background-removal)
// antes de anexar ao anúncio do Mercado Livre — peça com fundo branco vende
// mais. Processamento 100% client-side: sem rota nova no backend, sem custo
// por imagem, sem chave de API. A lib baixa o modelo ONNX/WASM do CDN da
// IMG.LY em runtime na primeira vez que roda (cacheado pelo navegador
// depois) — não precisa de nenhuma env var.
//
// Nunca lança: se qualquer etapa falhar (lib não carrega, imagem não
// suportada, navegador sem WASM), devolve blob: null e deixa o chamador
// seguir com a foto original — mesmo contrato de comprimirImagem.ts.

export interface ResultadoRemocaoFundo {
  sucesso: boolean;
  /** null quando falhou — chamador mantém a foto original */
  blob: Blob | null;
}

const QUALIDADE_JPEG = 0.85;

// @imgly/background-removal devolve PNG com fundo transparente — o Mercado
// Livre não valoriza transparência em foto de anúncio, então composita em
// branco antes de exportar (mesma técnica de comprimirImagem.ts: fillStyle
// branco + fillRect antes do drawImage).
async function aplicarFundoBranco(recorte: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(recorte);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D não disponível');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0);
  if ('close' in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG));
  if (!blob) throw new Error('Falha ao gerar imagem final');
  return blob;
}

export async function removerFundoImagem(entrada: File | Blob | string): Promise<ResultadoRemocaoFundo> {
  try {
    // Import dinâmico: só baixa a lib (+ modelo WASM, alguns MB) quando o
    // usuário realmente clica em "Remover fundo" — quem nunca usa essa
    // função não paga esse custo no bundle principal nem na primeira carga.
    const { removeBackground } = await import('@imgly/background-removal');
    const recorte = await removeBackground(entrada);
    const blob = await aplicarFundoBranco(recorte);
    return { sucesso: true, blob };
  } catch (err) {
    console.warn('Falha ao remover fundo da imagem:', err);
    return { sucesso: false, blob: null };
  }
}
