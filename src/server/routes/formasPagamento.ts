// CRUD da tabela de apoio "formas_pagamento". Diferente de categorias/modelos,
// aqui dá pra renomear (PUT) além de criar/excluir — pedido explícito do dono
// da loja ("editar os meios de pagamento").
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

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

  router.post('/', exigirPermissao('configuracoes.gerenciar_pagamento'), async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      const natureza = req.body?.natureza === 'fiado' ? 'fiado' : 'avista';

      const { data, error } = await supabase.from('formas_pagamento').insert([{ nome, natureza }]).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Aceita nome e/ou natureza — o toggle "é fiado?" em Configurações manda só
  // natureza, sem precisar reenviar o nome (mesmo espírito do PUT de
  // categorias, que serve tanto pra renomear quanto pra mover).
  router.put('/:id', exigirPermissao('configuracoes.gerenciar_pagamento'), async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      if (req.body?.nome !== undefined) {
        const nome = String(req.body.nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
        payload.nome = nome;
      }
      if (req.body?.natureza === 'fiado' || req.body?.natureza === 'avista') {
        payload.natureza = req.body.natureza;
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, error: 'Nada para atualizar' });
      }

      const { data, error } = await supabase.from('formas_pagamento').update(payload).eq('id', req.params.id).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', exigirPermissao('configuracoes.gerenciar_pagamento'), async (req, res) => {
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
