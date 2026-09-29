/**
 * Produz uma versão leve de URLs públicas do Supabase Storage para miniaturas.
 * URLs externas e assinadas permanecem intactas; fotos em tamanho original
 * continuam sendo usadas ao abrir o detalhe.
 */
export function inventoryThumbnailUrl(src: string, width = 320, height = 240): string {
  try {
    const url = new URL(src);
    const caminhoPublico = "/storage/v1/object/public/";
    if (!url.pathname.includes(caminhoPublico)) return src;

    url.pathname = url.pathname.replace(caminhoPublico, "/storage/v1/render/image/public/");
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", "72");
    return url.toString();
  } catch {
    return src;
  }
}
