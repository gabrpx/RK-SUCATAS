// Checagem diária de alertas que não têm um ponto de mutação único pra
// disparar push na hora (diferente de "tarefa nova", que dispara direto no
// POST de criar tarefa — ver tarefas.ts): fiado 15+ dias em aberto e cliente
// 90+ dias sem comprar só ficam verdadeiros com a passagem do tempo. Mesmo
// molde de mercadolivreScheduler.ts/enviosScheduler.ts (setInterval simples,
// roda uma vez na subida + no intervalo), mas com intervalo de 24h — esses
// dois estados não mudam intraday, então re-verificar a cada 5-45min como os
// outros dois schedulers só gastaria ciclo à toa.
//
// Primeira entrega: um aviso agregado ("N clientes sumidos, N fiados
// vencidos") pra admin/equipe, sem deduplicar por cliente individual — uma
// tabela de controle pra isso é refino de depois, não bloqueia esta entrega
// (ver plano). O guard de `ultimaExecucaoEm` existe porque o Render free tier
// hiberna sem tráfego: um cold-start pode acontecer mais de uma vez no mesmo
// dia, e sem o guard cada cold-start reenviaria o mesmo aviso.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resumoFiadoPorCliente } from '../features/fiado/metricas.js';
import { clientesSumidos } from '../features/clientes/metricas.js';
import { notificarUsuarios } from './pushNotificationService.js';
import type { Venda } from '../features/vendas/types.js';
import type { FiadoRecebimento } from '../features/fiado/types.js';
import type { Cliente } from '../features/clientes/types.js';
import type { Orcamento } from '../features/orcamentos/types.js';

const INTERVALO_MS = 24 * 60 * 60 * 1000;
const DIAS_FIADO_VENCIDO = 15;
const DIAS_CLIENTE_SUMIDO = 90;

let ultimaExecucaoEm: string | null = null; // 'YYYY-MM-DD', em memória — reseta a cada deploy/restart, é só pra não duplicar no mesmo processo

async function buscarDestinatarios(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('usuarios').select('id, roles').eq('ativo', true).or('roles.ov.{admin,equipe}');
  if (error) throw error;
  return (data ?? []).map((u: { id: string }) => u.id);
}

async function checarAlertas(supabase: SupabaseClient): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10);
  if (ultimaExecucaoEm === hoje) return;

  const [{ data: vendas, error: erroVendas }, { data: recebimentos, error: erroRecebimentos }, { data: clientes, error: erroClientes }, { data: orcamentos, error: erroOrcamentos }] =
    await Promise.all([
      supabase.from('vendas').select('id, cliente_id, cliente_nome, valor_total, data, forma_pagamento:formas_pagamento(natureza), cliente:clientes(nome)'),
      supabase.from('fiado_recebimentos').select('venda_id, valor'),
      supabase.from('clientes').select('id, nome, ativo'),
      supabase.from('orcamentos').select('id, cliente_id, status'),
    ]);

  if (erroVendas || erroRecebimentos || erroClientes || erroOrcamentos) {
    throw erroVendas || erroRecebimentos || erroClientes || erroOrcamentos;
  }

  const fiadosVencidos = resumoFiadoPorCliente((vendas ?? []) as unknown as Venda[], (recebimentos ?? []) as FiadoRecebimento[]).filter(
    (r) => r.diasEmAbertoMax >= DIAS_FIADO_VENCIDO
  );
  const sumidos = clientesSumidos((clientes ?? []) as Cliente[], (vendas ?? []) as unknown as Venda[], (orcamentos ?? []) as Orcamento[], DIAS_CLIENTE_SUMIDO);

  // Marca o dia como checado ANTES de decidir se notifica — mesmo sem nada
  // pra avisar hoje, não queremos rodar de novo no mesmo dia num próximo
  // cold-start.
  ultimaExecucaoEm = hoje;

  if (fiadosVencidos.length === 0 && sumidos.length === 0) return;

  const partes: string[] = [];
  if (fiadosVencidos.length > 0) partes.push(`${fiadosVencidos.length} cliente(s) com fiado vencido (${DIAS_FIADO_VENCIDO}+ dias)`);
  if (sumidos.length > 0) partes.push(`${sumidos.length} cliente(s) sumido(s) (${DIAS_CLIENTE_SUMIDO}+ dias sem comprar)`);

  const destinatarios = await buscarDestinatarios(supabase);
  if (destinatarios.length === 0) return;

  await notificarUsuarios(supabase, destinatarios, {
    titulo: 'Alertas do dia',
    corpo: partes.join(' · '),
    url: '/dashboard',
  });
}

export function iniciarChecagemDiariaDeAlertas(supabase: SupabaseClient): void {
  const executar = () => {
    checarAlertas(supabase).catch((err) => {
      console.error('Erro na checagem diária de alertas (fiado/clientes sumidos):', err.message || err);
    });
  };

  executar();
  setInterval(executar, INTERVALO_MS);
}
