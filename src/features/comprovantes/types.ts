// Comprovante de PIX anexado a uma venda (migration_036) — sempre soma,
// nunca substitui um comprovante anterior (ver ComprovantesPixVenda.tsx).
export interface ComprovantePix {
  id: string;
  venda_id: string | null;
  cliente_id: string | null;
  nome_arquivo: string;
  tipo_mime: string;
  tamanho_bytes: number;
  // Assinada, gerada por request — pode vir null se a geração falhar, ou
  // expirar depois de um tempo; nunca é uma URL pública persistida.
  url: string | null;
  criado_por: string | null;
  autor: { id: string; nome_exibicao: string } | null;
  criado_em: string;
  removido_em: string | null;
}

// Usado na ficha do cliente, onde os comprovantes vêm agregados de várias
// vendas — o contexto de qual venda cada um veio é o que diferencia daqui.
export interface ComprovantePixComVenda extends ComprovantePix {
  venda: { id: string; nome_item: string; data: string } | null;
}

export function comprovanteEhPdf(c: ComprovantePix): boolean {
  return c.tipo_mime === 'application/pdf';
}

export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
