// Fiado — venda com forma de pagamento de natureza 'fiado' (ver
// migration_030) não lança no Caixa na hora (ver registrar_venda,
// migration_031); só lança quando um recebimento é confirmado aqui, com a
// forma de pagamento real escolhida no momento. Recebimento pode ser
// parcial — o saldo em aberto de cada venda é calculado no frontend
// (src/features/fiado/metricas.ts) a partir de vendas + fiado_recebimentos.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';

const SELECT_COM_JOINS = '*, forma_pagamento:formas_pagamento(id, nome), usuario:usuarios(id, nome_exibicao)';

export function fiadoRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/recebimentos', exigirPermissao('caixa.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('fiado_recebimentos').select(SELECT_COM_JOINS).order('recebido_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar recebimentos de fiado:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // A validação de valor/saldo/forma de pagamento acontece toda dentro da
  // RPC (transacional, trava a venda) — aqui só repassa o erro dela como 400,
  // mesmo padrão de vendas.ts pro registrar_venda.
  router.post('/recebimentos', exigirPermissao('caixa.receber_fiado'), async (req: AuthenticatedRequest, res) => {
    try {
      const vendaId = req.body?.venda_id;
      const valor = Number(req.body?.valor);
      const formaPagamentoId = req.body?.forma_pagamento_id;
      if (!vendaId) return res.status(400).json({ success: false, error: 'venda_id é obrigatório' });
      if (!formaPagamentoId) return res.status(400).json({ success: false, error: 'Forma de pagamento é obrigatória' });
      if (!valor || valor <= 0) return res.status(400).json({ success: false, error: 'Valor inválido' });

      const { data: recebimento, error } = await supabase.rpc('registrar_recebimento_fiado', {
        p_venda_id: vendaId,
        p_valor: valor,
        p_forma_pagamento_id: formaPagamentoId,
        p_usuario_id: req.usuario!.id,
      });
      if (error) throw error;

      // A RPC devolve a linha crua (sem os joins) — rebusca com forma_pagamento
      // e usuario já resolvidos, pro frontend não precisar de um segundo fetch.
      const { data, error: erroBusca } = await supabase.from('fiado_recebimentos').select(SELECT_COM_JOINS).eq('id', recebimento.id).single();
      if (erroBusca) throw erroBusca;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao registrar recebimento de fiado:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Reverter um recebimento registrado por engano — apaga a entrada de caixa
  // vinculada junto, senão o dinheiro ficaria "fantasma" lançado no Caixa.
  router.delete('/recebimentos/:id', exigirPermissao('caixa.receber_fiado'), async (req, res) => {
    try {
      const { data: recebimento, error: erroBusca } = await supabase.from('fiado_recebimentos').select('id, caixa_id').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!recebimento) return res.status(404).json({ success: false, error: 'Recebimento não encontrado' });

      if (recebimento.caixa_id) {
        const { error: erroCaixa } = await supabase.from('caixa').delete().eq('id', recebimento.caixa_id);
        if (erroCaixa) throw erroCaixa;
      }

      const { error } = await supabase.from('fiado_recebimentos').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao remover recebimento de fiado:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
