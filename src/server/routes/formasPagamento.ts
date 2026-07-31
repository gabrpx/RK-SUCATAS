// CRUD da tabela de apoio "formas_pagamento". Diferente de categorias/modelos,
// aqui dá pra renomear (PUT) além de criar/excluir — pedido explícito do dono
// da loja ("editar os meios de pagamento").
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

export function formasPagamentoRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('formas_pagamento').select('*').order('nome');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });

      const { data, error } = await supabase.from('formas_pagamento').insert([{ nome }]).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });

      const { data, error } = await supabase.from('formas_pagamento').update({ nome }).eq('id', req.params.id).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { error } = await supabase.from('formas_pagamento').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
