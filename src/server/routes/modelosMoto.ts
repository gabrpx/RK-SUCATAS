// CRUD simples da tabela de apoio "modelos_moto" (compatibilidade de peça).
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensagemErroExclusao } from '../dbErrors.js';

export function modelosMotoRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('modelos_moto').select('*').order('nome');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      const marca = req.body?.marca ? String(req.body.marca).trim() : null;
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });

      const { data, error } = await supabase.from('modelos_moto').insert([{ nome, marca }]).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('modelos_moto').delete().eq('id', req.params.id);
    if (error) {
      return res.status(error.code === '23503' ? 409 : 500).json({ success: false, error: mensagemErroExclusao(error, 'peças ou vendas') });
    }
    res.json({ success: true });
  });

  return router;
}
