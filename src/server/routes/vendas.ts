// CRUD de vendas. Criar e cancelar passam pelas funções do banco
// (registrar_venda / cancelar_venda) pra manter venda + baixa de estoque +
// lançamento no caixa atômicos — nunca dá pra vender e "esquecer" de
// descontar o estoque, como acontecia no sistema antigo.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

const SELECT_COM_JOIN = '*, modelo_moto:modelos_moto(id, nome, ano), forma_pagamento:formas_pagamento(id, nome)';

export function vendasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('vendas').select(SELECT_COM_JOIN).order('data', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar vendas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { estoque_id, quantidade, valor_unitario, forma_pagamento_id, modelo_moto_id, cliente_nome, observacoes, data, componente } = req.body || {};

      if (!estoque_id) return res.status(400).json({ success: false, error: 'estoque_id é obrigatório' });
      if (!quantidade || Number(quantidade) <= 0) return res.status(400).json({ success: false, error: 'Quantidade inválida' });
      if (valor_unitario === undefined || Number(valor_unitario) < 0) {
        return res.status(400).json({ success: false, error: 'Valor unitário inválido' });
      }
      if (!forma_pagamento_id) return res.status(400).json({ success: false, error: 'Forma de pagamento é obrigatória' });

      const { data: venda, error } = await supabase.rpc('registrar_venda', {
        p_estoque_id: estoque_id,
        p_quantidade: Number(quantidade),
        p_valor_unitario: Number(valor_unitario),
        p_forma_pagamento_id: forma_pagamento_id,
        p_modelo_moto_id: modelo_moto_id || null,
        p_cliente_nome: cliente_nome || null,
        p_observacoes: observacoes || null,
        p_data: data || null,
        // Nome de uma parte cadastrada em estoque.componentes — quando
        // informado, dá baixa só nela (ver comentário em registrar_venda).
        p_componente: componente || null,
      });

      if (error) throw error;
      res.json({ success: true, data: venda });
    } catch (error: any) {
      console.error('Erro ao registrar venda:', error);
      // A função do banco usa RAISE EXCEPTION pra "estoque insuficiente" —
      // isso chega aqui como error.message legível, então repassamos como 400.
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Só campos que não mexem em estoque/valor — mudar item ou quantidade exige
  // cancelar a venda e registrar de novo, pra não perder a consistência do estoque.
  router.patch('/:id', async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      for (const campo of ['forma_pagamento_id', 'observacoes', 'cliente_nome'] as const) {
        if (req.body[campo] !== undefined) payload[campo] = req.body[campo];
      }
      const { data, error } = await supabase.from('vendas').update(payload).eq('id', req.params.id).select(SELECT_COM_JOIN).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar venda:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: req.params.id });
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao cancelar venda:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
}
