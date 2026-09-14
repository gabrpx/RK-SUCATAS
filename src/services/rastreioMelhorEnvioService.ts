// Lógica de rastreio via API do Melhor Envio, extraída de
// src/server/routes/envios.ts pra ser reutilizada tanto pelo botão manual
// "Atualizar"/"Atualizar todos" (rota HTTP) quanto pelo scheduler automático
// (enviosScheduler.ts) — sem duplicar a chamada externa nos dois lugares.
//
// A chamada é tratada como best-effort: se o token não tiver o escopo de
// rastreio, ou o pedido não existir do lado do Melhor Envio, o erro vai pra
// status_detalhe e a função nunca lança — o registro do envio em si não
// depende da API externa funcionar (ver comentário original em envios.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

export const STATUS_VALIDOS = ['aguardando_postagem', 'postado', 'em_transito', 'entregue', 'problema', 'cancelado'] as const;

// Envio que já chegou ou morreu não precisa mais ser consultado
// automaticamente — evita gastar cota da API do Melhor Envio sem necessidade.
const STATUS_TERMINAIS: (typeof STATUS_VALIDOS)[number][] = ['entregue', 'cancelado'];

// Tradução best-effort de status da API do Melhor Envio pro nosso enum —
// nomes de status exatos ainda não confirmados contra a API real; qualquer
// status não reconhecido só fica registrado em status_detalhe, sem tentar
// adivinhar o mapeamento.
export function mapearStatusExterno(statusExterno: string | undefined | null): (typeof STATUS_VALIDOS)[number] | null {
  const s = (statusExterno || '').toLowerCase();
  if (['delivered', 'entregue'].includes(s)) return 'entregue';
  if (['posted', 'released', 'postado'].includes(s)) return 'postado';
  if (['in_transit', 'transit', 'em_transito'].includes(s)) return 'em_transito';
  if (['cancelled', 'canceled', 'cancelado'].includes(s)) return 'cancelado';
  return null;
}

// Rastreia UM envio e devolve o patch a aplicar — não grava no banco (quem
// chama decide, pra rota HTTP e o scheduler poderem tratar erro/log de forma
// diferente sem duplicar a chamada externa em si).
export async function rastrearEnvio(envio: { melhor_envio_order_id: string | null }): Promise<Record<string, any>> {
  const atualizacao: Record<string, any> = { status_atualizado_em: new Date().toISOString() };

  if (!envio.melhor_envio_order_id) {
    atualizacao.status_detalhe = 'Sem número de pedido do Melhor Envio — status é só manual pra este envio.';
    return atualizacao;
  }

  try {
    const token = process.env.MELHOR_ENVIO_TOKEN;
    const response = await axios.post(
      'https://melhorenvio.com.br/api/v2/me/shipment/tracking',
      { orders: [envio.melhor_envio_order_id] },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'RK Sucatas (contato@rksucatas.com.br)',
        },
      }
    );
    const info = response.data?.[envio.melhor_envio_order_id] ?? response.data;
    const statusMapeado = mapearStatusExterno(info?.status);
    if (statusMapeado) atualizacao.status = statusMapeado;
    atualizacao.status_detalhe = info?.tracking ? `Rastreio: ${info.tracking}` : JSON.stringify(info).slice(0, 500);
  } catch (erroExterno: any) {
    const detalhe = erroExterno.response?.data?.message || erroExterno.message;
    console.error('Erro ao rastrear envio via Melhor Envio:', erroExterno.response?.data || erroExterno.message);
    atualizacao.status_detalhe = `Não foi possível atualizar automaticamente: ${detalhe}`;
  }

  return atualizacao;
}

// Busca todos os envios elegíveis (tem order_id do Melhor Envio, status não
// terminal) e aplica rastrearEnvio em cada um, sequencialmente — nunca em
// paralelo, pra não martelar a API externa com N chamadas simultâneas.
export async function rastrearEnviosPendentes(supabase: SupabaseClient): Promise<void> {
  const { data: envios, error } = await supabase
    .from('envios')
    .select('id, melhor_envio_order_id')
    .not('melhor_envio_order_id', 'is', null)
    .not('status', 'in', `(${STATUS_TERMINAIS.join(',')})`);

  if (error) {
    console.error('Erro ao buscar envios pendentes de rastreio:', error.message);
    return;
  }

  for (const envio of envios ?? []) {
    const atualizacao = await rastrearEnvio(envio);
    const { error: erroUpdate } = await supabase.from('envios').update(atualizacao).eq('id', envio.id);
    if (erroUpdate) console.error(`Erro ao gravar rastreio do envio ${envio.id}:`, erroUpdate.message);
    // Pequeno intervalo entre chamadas — evita rajada mesmo com poucos envios.
    await new Promise((r) => setTimeout(r, 300));
  }
}
