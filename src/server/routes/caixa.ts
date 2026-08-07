// CRUD do livro de caixa. Lançamentos com venda_id preenchido foram gerados
// automaticamente por uma venda — a UI trata esses como somente-leitura, mas
// o backend não impede a edição (a trava é só de UX, não de segurança).
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

const SELECT_COM_JOIN = '*, forma_pagamento:formas_pagamento(id, nome)';

export function caixaRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('caixa').select(SELECT_COM_JOIN).order('data', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { tipo, descricao, valor, forma_pagamento_id, data } = req.body || {};
      if (!['entrada', 'saida'].includes(tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo deve ser "entrada" ou "saida"' });
      }
      if (!descricao || !String(descricao).trim()) {
        return res.status(400).json({ success: false, error: 'Descrição é obrigatória' });
      }
      if (!valor || Number(valor) <= 0) {
        return res.status(400).json({ success: false, error: 'Valor deve ser maior que zero' });
      }

      const payload = {
        tipo,
        descricao: String(descricao).trim(),
        valor: Number(valor),
        forma_pagamento_id: forma_pagamento_id || null,
        data: data || new Date().toISOString().slice(0, 10),
      };

      const { data: created, error } = await supabase.from('caixa').insert([payload]).select(SELECT_COM_JOIN).single();
      if (error) throw error;
      res.json({ success: true, data: created });
    } catch (error: any) {
      console.error('Erro ao lançar no caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      for (const campo of ['tipo', 'descricao', 'valor', 'forma_pagamento_id', 'data'] as const) {
        if (req.body[campo] !== undefined) payload[campo] = req.body[campo];
      }
      if (payload.valor !== undefined) payload.valor = Number(payload.valor);

      const { data, error } = await supabase.from('caixa').update(payload).eq('id', req.params.id).select(SELECT_COM_JOIN).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar lançamento de caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      // Entrada gerada por um recebimento de fiado (ver migration_031) não
      // leva venda_id, então não cai na trava de "somente-leitura" da UI —
      // mas apagá-la direto aqui deixaria fiado_recebimentos.caixa_id órfão
      // sem reverter o recebimento nem destravar a venda. Reverter é só pela
      // aba Fiado (DELETE /api/fiado/recebimentos/:id), que apaga os dois juntos.
      const { data: recebimentoVinculado, error: erroRecebimento } = await supabase
        .from('fiado_recebimentos')
        .select('id')
        .eq('caixa_id', req.params.id)
        .maybeSingle();
      if (erroRecebimento) throw erroRecebimento;
      if (recebimentoVinculado) {
        return res.status(409).json({ success: false, error: 'Este lançamento veio de um recebimento de fiado — reverta-o pela aba Fiado.' });
      }

      const { error } = await supabase.from('caixa').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir lançamento de caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
