// Rastreio automático dos envios via Melhor Envio — mesmo molde de
// src/services/mercadolivreScheduler.ts. Antes disso, o status só era
// atualizado quando alguém clicava em "Atualizar"/"Atualizar todos" na aba
// Frete; agora roda em background, sem precisar de clique nenhum.
import type { SupabaseClient } from '@supabase/supabase-js';
import { rastrearEnviosPendentes } from './rastreioMelhorEnvioService.js';

// Rastreio de encomenda não precisa de tempo real, e um intervalo curto só
// gastaria cota da API do Melhor Envio sem necessidade.
const INTERVALO_MS = 45 * 60 * 1000;

export function iniciarRastreioAutomaticoDeEnvios(supabase: SupabaseClient): void {
  const executar = () => {
    rastrearEnviosPendentes(supabase).catch((err) => {
      console.error('Erro no rastreio automático de envios:', err.response?.data || err.message);
    });
  };

  // Roda uma vez já na subida — mesmo motivo do detector do ML: cobre o
  // cold-start do Render (plano free hiberna sem tráfego).
  executar();
  setInterval(executar, INTERVALO_MS);
}
