// Único loop em background do módulo Mercado Livre — só detecta pergunta/
// pedido novo (feature 9). Preço e estoque (features 1+7) foram deixados de
// fora de propósito: são disparados só por clique humano (ver
// mercadolivreSync.ts > sincronizarAnuncio), nunca em background, porque
// mudam o anúncio real na conta de produção da loja.
import type { SupabaseClient } from '@supabase/supabase-js';
import { verificarNotificacoesPendentes } from './mercadolivreSync.js';

const INTERVALO_MS = 5 * 60 * 1000;

export function iniciarDetectorDePendenciasML(supabase: SupabaseClient): void {
  const executar = () => {
    verificarNotificacoesPendentes(supabase).catch((err) => {
      console.error('Erro no detector de pendências do Mercado Livre:', err.response?.data || err.message);
    });
  };

  // Roda uma vez já na subida — cobre o cold-start do Render (plano free
  // hiberna sem tráfego, então sem isso a primeira verificação real só
  // aconteceria 5min depois de alguém acordar o processo).
  executar();
  setInterval(executar, INTERVALO_MS);
}
