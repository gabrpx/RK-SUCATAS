import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

export function dashboardRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/resumo-pendencias', exigirPermissao('dashboard.ver'), async (_req, res) => {
    try {
      const [orcRes, vendasFiadoRes, fiadoRecRes] = await Promise.all([
        supabase
          .from('orcamentos')
          .select('id, codigo, cliente_nome, criado_em, itens:orcamento_itens(valor_unitario, quantidade)')
          .eq('status', 'aberto')
          .order('criado_em', { ascending: false })
          .limit(5),
        supabase
          .from('vendas')
          .select('id, data, valor_total, cliente_nome, cliente_id, forma_pagamento:formas_pagamento(id, nome, natureza)')
          .eq('forma_pagamento.natureza', 'fiado'),
        supabase
          .from('fiado_recebimentos')
          .select('id, venda_id, valor, data'),
      ]);

      if (orcRes.error) throw orcRes.error;

      const pendencias = (orcRes.data || []).map((o: any) => {
        const total = (o.itens || []).reduce((s: number, i: any) => s + Number(i.valor_unitario) * Number(i.quantidade), 0);
        return { id: o.id, codigo: o.codigo, cliente_nome: o.cliente_nome, criado_em: o.criado_em, total };
      });

      const vendasFiado = (vendasFiadoRes.data || []).filter((v: any) => v.forma_pagamento?.natureza === 'fiado');
      const recebimentos = fiadoRecRes.data || [];

      const recebidoPorVenda = new Map<string, number>();
      for (const r of recebimentos) {
        recebidoPorVenda.set(r.venda_id, (recebidoPorVenda.get(r.venda_id) ?? 0) + Number(r.valor));
      }

      const EPSILON = 0.01;
      const agora = Date.now();
      const porCliente = new Map<string, { clienteNome: string; totalEmAberto: number; diasEmAbertoMax: number }>();

      for (const v of vendasFiado) {
        const recebido = recebidoPorVenda.get(v.id) ?? 0;
        const saldo = Number(v.valor_total) - recebido;
        if (saldo <= EPSILON) continue;

        const dias = Math.floor((agora - new Date(`${v.data}T00:00:00`).getTime()) / 86400000);
        const chave = v.cliente_id || v.cliente_nome || 'Sem cliente';
        const atual = porCliente.get(chave);
        if (atual) {
          atual.totalEmAberto += saldo;
          if (dias > atual.diasEmAbertoMax) atual.diasEmAbertoMax = dias;
        } else {
          porCliente.set(chave, { clienteNome: v.cliente_nome || 'Sem cliente', totalEmAberto: saldo, diasEmAbertoMax: dias });
        }
      }

      const fiadoResumo = Array.from(porCliente.values())
        .filter((r) => r.diasEmAbertoMax >= 15)
        .sort((a, b) => b.totalEmAberto - a.totalEmAberto);
      const fiadoTotalEmAberto = fiadoResumo.reduce((s, r) => s + r.totalEmAberto, 0);

      res.json({
        success: true,
        data: {
          pendencias,
          totalPendencias: pendencias.length,
          fiadoResumo,
          fiadoTotalEmAberto,
        },
      });
    } catch (error: any) {
      console.error('Erro ao buscar resumo de pendências:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
