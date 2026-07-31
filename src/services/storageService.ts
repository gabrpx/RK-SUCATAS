// Upload/remoção de imagens de peças no Supabase Storage (bucket público
// "estoque"). Recebe o arquivo já em memória (multer memoryStorage) — sem
// escrever em disco local, sem depender de path de arquivo temporário.
import { supabase } from '../../services/supabaseClient.js';

const BUCKET = 'estoque';

function nomeUnico(nomeOriginal: string): string {
  const extensao = nomeOriginal.includes('.') ? nomeOriginal.split('.').pop() : 'jpg';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
}

export async function uploadImagem(buffer: Buffer, nomeOriginal: string, mimeType: string): Promise<string> {
  const path = nomeUnico(nomeOriginal);
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}

// Só remove se a URL for realmente do nosso bucket — chamado com URLs
// coladas manualmente (imagens antigas) não faz nada, sem erro.
export async function excluirImagemPorUrl(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes(`/${BUCKET}/`)) return;
  const path = url.split(`/${BUCKET}/`)[1]?.split('?')[0];
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
