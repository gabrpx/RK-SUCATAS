// CRUD do estoque de peças. Cada linha carrega a categoria e o modelo de moto
// já resolvidos via join, pra UI não precisar cruzar os lookups na mão.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { excluirImagemPorUrl } from '../../services/storageService.js';

const SELECT_COM_JOINS = '*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, marca)';

const CAMPOS_EDITAVEIS = ['nome', 'categoria_id', 'modelo_moto_id', 'condicao', 'ano', 'valor', 'quantidade', 'imagem_url', 'descricao', 'ativo'] as const;

function montarPayload(body: any) {
  const payload: Record<string, any> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== undefined) payload[campo] = body[campo];
  }
  if (payload.valor !== undefined) payload.valor = Number(payload.valor) || 0;
  if (payload.quantidade !== undefined) payload.quantidade = Math.max(0, Number(payload.quantidade) || 0);
  return payload;
}

export function estoqueRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('estoque').select(SELECT_COM_JOINS).order('criado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const { data, error } = await supabase.from('estoque').select(SELECT_COM_JOINS).eq('id', req.params.id).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome da peça é obrigatório' });
      if (!['original', 'paralela'].includes(req.body?.condicao)) {
        return res.status(400).json({ success: false, error: 'Condição deve ser "original" ou "paralela"' });
      }

      const payload = { ...montarPayload(req.body), nome };
      const { data, error } = await supabase.from('estoque').insert([payload]).select(SELECT_COM_JOINS).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Compartilhado por PUT/PATCH: se imagem_url está mudando, apaga a imagem
  // antiga do Storage depois de confirmar a troca — nunca deixa órfã.
  const atualizarItem = async (req: any, res: any) => {
    try {
      const payload = montarPayload(req.body);
      let imagemAntiga: string | null = null;

      if (payload.imagem_url !== undefined) {
        const { data: atual } = await supabase.from('estoque').select('imagem_url').eq('id', req.params.id).single();
        if (atual && atual.imagem_url !== payload.imagem_url) imagemAntiga = atual.imagem_url;
      }

      const { data, error } = await supabase.from('estoque').update(payload).eq('id', req.params.id).select(SELECT_COM_JOINS).single();
      if (error) throw error;

      if (imagemAntiga) excluirImagemPorUrl(imagemAntiga).catch((e) => console.error('Erro ao limpar imagem antiga:', e));

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  router.put('/:id', atualizarItem);
  // PATCH usa a mesma lógica do PUT — a diferença semântica (parcial vs total)
  // já é garantida por montarPayload só incluir os campos enviados.
  router.patch('/:id', atualizarItem);

  router.delete('/:id', async (req, res) => {
    try {
      const { data: item } = await supabase.from('estoque').select('imagem_url').eq('id', req.params.id).single();
      const { error } = await supabase.from('estoque').delete().eq('id', req.params.id);
      if (error) throw error;

      if (item?.imagem_url) excluirImagemPorUrl(item.imagem_url).catch((e) => console.error('Erro ao limpar imagem:', e));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/bulk-delete', async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids inválidos' });
      }
      const { data: itens } = await supabase.from('estoque').select('imagem_url').in('id', ids);
      const { error } = await supabase.from('estoque').delete().in('id', ids);
      if (error) throw error;

      for (const item of itens || []) {
        if (item.imagem_url) excluirImagemPorUrl(item.imagem_url).catch((e) => console.error('Erro ao limpar imagem:', e));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-delete de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/bulk-update-categoria', async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      const categoria_id: string = req.body?.categoria_id;
      if (!Array.isArray(ids) || ids.length === 0 || !categoria_id) {
        return res.status(400).json({ success: false, error: 'ids e categoria_id são obrigatórios' });
      }
      const { error } = await supabase.from('estoque').update({ categoria_id }).in('id', ids);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-update-categoria de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Ajuste relativo de quantidade (delta pode ser negativo), usado pelos
  // botões +1/-1 em lote na UI.
  router.post('/bulk-update-quantidade', async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      const delta: number = Number(req.body?.delta) || 0;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids inválidos' });
      }

      const { data: itens, error: fetchError } = await supabase.from('estoque').select('id, quantidade').in('id', ids);
      if (fetchError) throw fetchError;

      for (const item of itens || []) {
        const novaQuantidade = Math.max(0, Number(item.quantidade) + delta);
        const { error: updateError } = await supabase.from('estoque').update({ quantidade: novaQuantidade }).eq('id', item.id);
        if (updateError) throw updateError;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-update-quantidade de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
