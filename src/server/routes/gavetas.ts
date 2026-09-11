// src/server/routes/gavetas.ts
// CRUD de gavetas (migration_061) — nível topo da hierarquia
// Gaveta → Variante → Unidade. Excluir uma gaveta solta as peças
// (estoque.gaveta_id = null), nunca apaga peça nenhuma.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

const SELECT_GAVETA = '*, categoria:categorias(id, nome)';

export function gavetasRouter(supabase: SupabaseClient) {
  const router = Router();
  const VER = exigirPermissao('estoque.ver');
  const CRIAR = exigirPermissao('estoque.criar');
  const EDITAR = exigirPermissao('estoque.editar');
  const DELETAR = exigirPermissao('estoque.deletar');

  router.get('/', VER, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('gavetas').select(SELECT_GAVETA).order('nome');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: any) {
      console.error('Erro ao listar gavetas:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post('/', CRIAR, async (req, res) => {
    try {
      const nome = String(req.body?.nome ?? '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      const payload = {
        nome,
        categoria_id: req.body?.categoria_id || null,
        icone: req.body?.icone ? String(req.body.icone) : null,
      };
      const { data, error } = await supabase.from('gavetas').insert(payload).select(SELECT_GAVETA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e: any) {
      console.error('Erro ao criar gaveta:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.patch('/:id', EDITAR, async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      if (req.body?.nome !== undefined) {
        const nome = String(req.body.nome ?? '').trim();
        if (!nome) return res.status(400).json({ success: false, error: 'Nome não pode ficar vazio' });
        payload.nome = nome;
      }
      if (req.body?.categoria_id !== undefined) payload.categoria_id = req.body.categoria_id || null;
      if (req.body?.icone !== undefined) payload.icone = req.body.icone ? String(req.body.icone) : null;
      const { data, error } = await supabase.from('gavetas').update(payload).eq('id', req.params.id).select(SELECT_GAVETA).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Gaveta não encontrada' });
      res.json({ success: true, data });
    } catch (e: any) {
      console.error('Erro ao atualizar gaveta:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Solta as peças (gaveta_id = null) antes de excluir — nenhuma peça some.
  // A confirmação é responsabilidade da UI (T13); aqui a operação é idempotente.
  router.delete('/:id', DELETAR, async (req, res) => {
    try {
      const { error: erroSolta } = await supabase.from('estoque').update({ gaveta_id: null }).eq('gaveta_id', req.params.id);
      if (erroSolta) throw erroSolta;
      const { error } = await supabase.from('gavetas').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      console.error('Erro ao excluir gaveta:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  return router;
}
