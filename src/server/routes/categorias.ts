// CRUD simples da tabela de apoio "categorias" (substitui o select fixo do Notion).
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensagemErroExclusao } from '../dbErrors.js';

export function categoriasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('categorias').select('*').order('nome');
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

      const { data, error } = await supabase.from('categorias').insert([{ nome }]).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('categorias').delete().eq('id', req.params.id);
    if (error) {
      return res.status(error.code === '23503' ? 409 : 500).json({ success: false, error: mensagemErroExclusao(error, 'peças') });
    }
    res.json({ success: true });
  });

  return router;
}
