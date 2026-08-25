// CRUD do livro de caixa. Lançamentos com venda_id preenchido foram gerados
// automaticamente por uma venda — a UI trata esses como somente-leitura, mas
// o backend não impede a edição (a trava é só de UX, não de segurança).
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

const SELECT_COM_JOIN = '*, forma_pagamento:formas_pagamento(id, nome)';

export function caixaRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', exigirPermissao('caixa.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('caixa').select(SELECT_COM_JOIN).order('data', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', exigirPermissao('caixa.criar'), async (req, res) => {
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

  router.put('/:id', exigirPermissao('caixa.editar'), async (req, res) => {
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

  router.delete('/:id', exigirPermissao('caixa.excluir'), async (req, res) => {
    try {
      // Entrada gerada por um recebimento de fiado (migration_031) ou de uma
      // pendência de caixa (migration_041) não leva venda_id, então não cai
      // na trava de "somente-leitura" da UI — mas apagá-la direto aqui
      // deixaria o *_recebimentos.caixa_id correspondente órfão, sem
      // reverter o recebimento. Reverter é só pela tela de origem (aba
      // Fiado ou sub-aba Pendências do Caixa), que apaga os dois juntos.
      const [{ data: viaFiado, error: erroFiado }, { data: viaPendencia, error: erroPendencia }] = await Promise.all([
        supabase.from('fiado_recebimentos').select('id').eq('caixa_id', req.params.id).maybeSingle(),
        supabase.from('caixa_pendencia_recebimentos').select('id').eq('caixa_id', req.params.id).maybeSingle(),
      ]);
      if (erroFiado) throw erroFiado;
      if (erroPendencia) throw erroPendencia;
      if (viaFiado) {
        return res.status(409).json({ success: false, error: 'Este lançamento veio de um recebimento de fiado — reverta-o pela aba Fiado.' });
      }
      if (viaPendencia) {
        return res.status(409).json({ success: false, error: 'Este lançamento veio de um recebimento de pendência — reverta-o pela sub-aba Pendências, dentro de Caixa.' });
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
