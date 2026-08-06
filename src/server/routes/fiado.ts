// Fiado — só acompanhamento/cobrança em cima de vendas já lançadas com uma
// forma de pagamento de natureza 'fiado' (ver migration_030). Nunca escreve
// em vendas/caixa: "baixa" aqui é só um marcador de "já foi acertado", pra
// tirar a venda da lista de em aberto. O cálculo de quem está em aberto e há
// quanto tempo é feito no frontend (src/features/fiado/metricas.ts) a partir
// de vendas + fiado_baixas, mesmo padrão de src/features/clientes/metricas.ts.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';

export function fiadoRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/baixas', async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('fiado_baixas')
        .select('*, usuario:usuarios(id, nome_exibicao)')
        .order('quitado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar baixas de fiado:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/baixas', async (req: AuthenticatedRequest, res) => {
    try {
      const vendaId = req.body?.venda_id;
      if (!vendaId) return res.status(400).json({ success: false, error: 'venda_id é obrigatório' });

      const { data, error } = await supabase
        .from('fiado_baixas')
        .insert({
          venda_id: vendaId,
          quitado_por: req.usuario!.id,
          observacao: req.body?.observacao ? String(req.body.observacao).trim() : null,
        })
        .select('*, usuario:usuarios(id, nome_exibicao)')
        .single();
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'Essa venda já está marcada como quitada' });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao registrar baixa de fiado:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Reverter uma baixa marcada por engano — a venda volta a aparecer em aberto.
  router.delete('/baixas/:id', async (req, res) => {
    try {
      const { error } = await supabase.from('fiado_baixas').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao remover baixa de fiado:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
