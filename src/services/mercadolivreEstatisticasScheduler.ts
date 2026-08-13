// Loop em background que mantém estoque_anuncios_ml_estatisticas atualizada
// (migration_043, Fase 7) — leitura pura (visitas, perguntas, saúde, vendas),
// nunca muta o anúncio no Mercado Livre. Por isso, diferente de preço/estoque
// (ver mercadolivreScheduler.ts), rodar isso sozinho em background é seguro:
// não há risco de alterar a conta de produção da loja sem revisão humana.
import type { SupabaseClient } from '@supabase/supabase-js';
import { obterConexaoAtual } from './mercadolivreApi.js';
import { sincronizarEstatisticas } from './mercadolivrePublicacao.js';

const INTERVALO_MS = 20 * 60 * 1000;

export function iniciarSincronizadorDeEstatisticasML(supabase: SupabaseClient): void {
  const executar = async () => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return;

      const { data: links, error } = await supabase.from('estoque_anuncios_ml').select('id');
      if (error) return;

      const linkIds = (links ?? []).map((l: any) => l.id);
      await sincronizarEstatisticas(supabase, conexao.accessToken, linkIds);
    } catch (err: any) {
      console.error('Erro no sincronizador de estatísticas do Mercado Livre:', err.response?.data || err.message);
    }
  };

  // Roda uma vez já na subida — mesmo motivo do detector de pendências: sem
  // isso, o cold-start do Render (plano free hiberna sem tráfego) deixaria o
  // primeiro snapshot só pronto 20min depois de alguém acordar o processo.
  executar();
  setInterval(executar, INTERVALO_MS);
}
