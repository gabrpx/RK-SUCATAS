// Dois loops em background do módulo Shopee — companheiros de
// mercadolivreScheduler.ts / mercadolivreEstatisticasScheduler.ts, mas com
// cadência PRÓPRIA: o access_token da Shopee dura só 4h (contra 6h do
// Mercado Livre), então o refresh precisa de um timer independente, mais
// frequente. Os dois jobs são leitura/renovação de token — nunca mutam
// preço/estoque do anúncio sozinhos (isso continua exigindo clique humano,
// mesmo raciocínio do ML).
import type { SupabaseClient } from '@supabase/supabase-js';
import { TABELA_CONEXAO, obterConexaoAtualShopee, renovarTokenShopee } from './shopeeApi.js';
import { sincronizarEstatisticasShopee } from './shopeePublicacao.js';

// 3h de intervalo pra um token que dura 4h — sempre renova bem antes de
// expirar, mesmo que o processo fique um ciclo sem rodar (ex: deploy).
const INTERVALO_RENOVACAO_MS = 3 * 60 * 60 * 1000;
// Mesma cadência de iniciarSincronizadorDeEstatisticasML (dentro da janela
// de 15-30min pedida pra Shopee).
const INTERVALO_ESTATISTICAS_MS = 20 * 60 * 1000;

// Renovação INCONDICIONAL a cada 3h — diferente de obterConexaoAtualShopee
// (que só renova sob demanda, quando faltam <10min pro token expirar). Um
// job de 3h nunca cairia nessa janela de 10min sozinho, por isso chama
// renovarTokenShopee direto, sem checar o tempo restante.
export function iniciarRenovacaoDeTokenShopee(supabase: SupabaseClient): void {
  const executar = async () => {
    try {
      const { data: conexao, error } = await supabase.from(TABELA_CONEXAO).select('refresh_token, shop_id').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
      if (error || !conexao) return;
      await renovarTokenShopee(supabase, conexao.refresh_token, conexao.shop_id);
    } catch (err: any) {
      console.error('Erro ao renovar token da Shopee:', err.response?.data || err.message);
    }
  };

  // Roda uma vez já na subida — mesmo motivo dos schedulers do ML: cold-start
  // do Render (plano free hiberna sem tráfego) não pode deixar o token vencer
  // só porque ninguém usou a Shopee nas primeiras 3h depois de acordar.
  executar();
  setInterval(executar, INTERVALO_RENOVACAO_MS);
}

export function iniciarSincronizadorDeEstatisticasShopee(supabase: SupabaseClient): void {
  const executar = async () => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase);
      if (!conexao) return;

      const { data: links, error } = await supabase.from('estoque_anuncios_shopee').select('id');
      if (error) return;

      const linkIds = (links ?? []).map((l: any) => l.id);
      await sincronizarEstatisticasShopee(supabase, conexao.accessToken, conexao.shopId, linkIds);
    } catch (err: any) {
      console.error('Erro no sincronizador de estatísticas da Shopee:', err.response?.data || err.message);
    }
  };

  executar();
  setInterval(executar, INTERVALO_ESTATISTICAS_MS);
}
