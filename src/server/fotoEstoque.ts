import type { SupabaseClient } from '@supabase/supabase-js';
import { excluirImagemPorUrl } from '../services/storageService.js';

const FUNCAO_AUSENTE = new Set(['42883', 'PGRST202', 'PGRST205']);

/**
 * Confere todas as referências antes de remover uma foto do Storage.
 * Falhas de leitura retornam null e preservam o arquivo (fail closed).
 */
export async function fotoEstoqueEmUso(supabase: SupabaseClient, url: string): Promise<boolean | null> {
  const rpc = await supabase.rpc('foto_estoque_em_uso', { p_url: url });
  if (!rpc.error) return Boolean(rpc.data);
  if (!FUNCAO_AUSENTE.has(rpc.error.code ?? '')) return null;

  const [emUnidade, emPeca, emCapa] = await Promise.all([
    supabase.from('estoque_unidades').select('id').filter('fotos', 'cs', JSON.stringify([url])).limit(1),
    supabase.from('estoque').select('id').filter('imagens', 'cs', JSON.stringify([url])).limit(1),
    supabase.from('estoque').select('id').eq('imagem_url', url).limit(1),
  ]);
  if (emUnidade.error || emPeca.error || emCapa.error) return null;
  return Boolean(emUnidade.data?.length || emPeca.data?.length || emCapa.data?.length);
}

/** Remove somente arquivos comprovadamente órfãos. */
export async function excluirFotoEstoqueSeOrfa(supabase: SupabaseClient, url: string): Promise<boolean> {
  if ((await fotoEstoqueEmUso(supabase, url)) !== false) return false;
  await excluirImagemPorUrl(url);
  return true;
}
