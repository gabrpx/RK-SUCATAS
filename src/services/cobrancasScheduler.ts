import type { SupabaseClient } from '@supabase/supabase-js';
import { notificarUsuario } from './pushNotificationService.js';
import { buscarDestinatariosEquipe } from './destinatariosNotificacao.js';

const INTERVALO_MS = 30 * 1000;

interface CobrancaDevida {
  id: string;
  venda_id: string | null;
  pendencia_id: string | null;
}

async function dispararCobrancasDevidas(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc('disparar_cobrancas_devidas');
  if (error) throw error;
  const devidas = (data ?? []) as CobrancaDevida[];
  if (devidas.length === 0) return;

  const destinatarios = await buscarDestinatariosEquipe(supabase);
  if (destinatarios.length === 0) return;

  for (const c of devidas) {
    let descricao = 'Pendência';
    let valor = '';

    if (c.venda_id) {
      const { data: venda } = await supabase
        .from('vendas')
        .select('nome_item, valor_total, cliente_nome')
        .eq('id', c.venda_id)
        .maybeSingle();
      if (venda) {
        const nome = venda.cliente_nome || 'Sem cliente';
        descricao = `${nome} — ${venda.nome_item}`;
        valor = ` de R$${Number(venda.valor_total).toFixed(2).replace('.', ',')}`;
      }
    } else if (c.pendencia_id) {
      const { data: pend } = await supabase
        .from('caixa_pendencias')
        .select('descricao, valor_total')
        .eq('id', c.pendencia_id)
        .maybeSingle();
      if (pend) {
        descricao = pend.descricao;
        valor = ` de R$${Number(pend.valor_total).toFixed(2).replace('.', ',')}`;
      }
    }

    await Promise.all(
      destinatarios.map((uid) =>
        notificarUsuario(supabase, uid, {
          titulo: 'Cobrança pendente',
          corpo: `${descricao}${valor}`,
          url: '/caixa',
        }).catch((e) => console.error(`Erro ao notificar cobrança ${c.id}:`, e))
      )
    );
  }
}

export function iniciarDisparoDeCobrancas(supabase: SupabaseClient): void {
  const executar = () => {
    dispararCobrancasDevidas(supabase).catch((err) => {
      console.error('Erro no disparo de cobranças:', err.message || err);
    });
  };

  executar();
  setInterval(executar, INTERVALO_MS);
}
