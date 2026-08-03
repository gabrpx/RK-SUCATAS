// Comprime a foto no próprio celular antes de subir. Foto de câmera moderna
// passa fácil dos 5MB que o backend aceita (ver src/server/routes/upload.ts) e
// hoje isso só voltava como erro genérico no meio do cadastro. Reduzir aqui
// também deixa o envio muito mais rápido na conexão da loja.
//
// Nunca lança: se qualquer etapa falhar (codec exótico, canvas bloqueado,
// navegador antigo), devolve o arquivo original e deixa o backend decidir.

const DIMENSAO_MAXIMA = 1600; // px no maior lado — sobra pra zoom na peça
const QUALIDADE_JPEG = 0.82;
// Abaixo disso não vale reprocessar: o ganho é pequeno e a recompressão só
// degradaria uma imagem que já está leve.
const TAMANHO_MINIMO_PARA_COMPRIMIR = 600 * 1024;

export interface ResultadoCompressao {
  arquivo: File;
  /** false quando devolvemos o original (já era pequeno ou algo falhou) */
  comprimido: boolean;
  bytesAntes: number;
  bytesDepois: number;
}

// GIF é o único formato aceito pelo backend que pode ser animado — recomprimir
// em canvas achataria pro primeiro quadro, então passa direto.
function podeComprimir(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
}

async function carregarBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // imageOrientation: 'from-image' respeita o EXIF — sem isso, foto tirada
  // com o celular deitado sobe girada.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Safari antigo não aceita o options object — cai no <img> abaixo.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Falha ao decodificar imagem'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function trocarExtensaoParaJpg(nome: string): string {
  return nome.replace(/\.[^.]+$/, '') + '.jpg';
}

export async function comprimirImagem(file: File): Promise<ResultadoCompressao> {
  const original: ResultadoCompressao = {
    arquivo: file,
    comprimido: false,
    bytesAntes: file.size,
    bytesDepois: file.size,
  };

  if (!podeComprimir(file)) return original;

  try {
    const bitmap = await carregarBitmap(file);
    const larguraOriginal = bitmap.width;
    const alturaOriginal = bitmap.height;
    if (!larguraOriginal || !alturaOriginal) return original;

    const precisaRedimensionar = Math.max(larguraOriginal, alturaOriginal) > DIMENSAO_MAXIMA;
    if (!precisaRedimensionar && file.size < TAMANHO_MINIMO_PARA_COMPRIMIR) return original;

    const escala = precisaRedimensionar ? DIMENSAO_MAXIMA / Math.max(larguraOriginal, alturaOriginal) : 1;
    const largura = Math.round(larguraOriginal * escala);
    const altura = Math.round(alturaOriginal * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;

    // Fundo branco: PNG/WEBP com transparência viram JPEG (sem canal alpha),
    // e sem isso o transparente sairia preto.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, largura, altura);
    if ('close' in bitmap) bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG));
    if (!blob) return original;

    // Se a "compressão" engordou o arquivo (acontece com imagem pequena e
    // muito ruidosa), fica com o original.
    if (blob.size >= file.size) return original;

    return {
      arquivo: new File([blob], trocarExtensaoParaJpg(file.name), { type: 'image/jpeg', lastModified: Date.now() }),
      comprimido: true,
      bytesAntes: file.size,
      bytesDepois: blob.size,
    };
  } catch (err) {
    console.warn('Falha ao comprimir imagem, enviando original:', err);
    return original;
  }
}

export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
