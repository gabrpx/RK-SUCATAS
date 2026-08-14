// Único loop em background do módulo Mercado Livre — detecta pergunta/pedido
// novo (feature 9) e, na sequência, importa pedido pago como venda com baixa
// de estoque (fila de pedidos, migration_044). Preço e estoque (features
// 1+7) foram deixados de fora de propósito: são disparados só por clique
// humano, com revisão antes de aplicar (ver mercadolivreSync.ts >
// buscarPreviewSincronizacao / aplicarSincronizacao), nunca em background,
// porque mudam o anúncio real na conta de produção da loja — isso não muda
// aqui: a importação de pedido só escreve em venda/estoque nosso.
import type { SupabaseClient } from '@supabase/supabase-js';
import { verificarNotificacoesPendentes, processarPedidosPendentes } from './mercadolivreSync.js';

const INTERVALO_MS = 5 * 60 * 1000;

export function iniciarDetectorDePendenciasML(supabase: SupabaseClient): void {
  const executar = () => {
    verificarNotificacoesPendentes(supabase)
      // Detectar primeiro, consumir depois: o polling é quem enfileira o
      // pedido que o webhook perdeu, então rodar na ordem inversa atrasaria
      // esse pedido em um ciclo inteiro.
      .then(() => processarPedidosPendentes(supabase))
      .catch((err) => {
        console.error('Erro no detector de pendências do Mercado Livre:', err.response?.data || err.message);
      });
  };

  // Roda uma vez já na subida — cobre o cold-start do Render (plano free
  // hiberna sem tráfego, então sem isso a primeira verificação real só
  // aconteceria 5min depois de alguém acordar o processo).
  executar();
  setInterval(executar, INTERVALO_MS);
}
