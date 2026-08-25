// Pendências manuais de Caixa — "Fiado/Pendência" como 3ª opção no lançamento
// manual (ver migration_041). Uma pendência NÃO lança em `caixa` na hora; só
// lança quando um recebimento é confirmado aqui, com a forma de pagamento
// real escolhida no momento, podendo ser parcial. Mesmo espírito de
// src/server/routes/fiado.ts, mas para pendências sem venda/cliente
// associado.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';

const SELECT_PENDENCIA = '*, criador:usuarios!criado_por(id, nome_exibicao)';
const SELECT_RECEBIMENTO = '*, forma_pagamento:formas_pagamento(id, nome), usuario:usuarios(id, nome_exibicao)';

export function caixaPendenciasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', exigirPermissao('caixa.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('caixa_pendencias').select(SELECT_PENDENCIA).order('criado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar pendências de caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/recebimentos', exigirPermissao('caixa.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('caixa_pendencia_recebimentos').select(SELECT_RECEBIMENTO).order('recebido_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar recebimentos de pendência de caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', exigirPermissao('caixa.gerenciar_pendencias'), async (req: AuthenticatedRequest, res) => {
    try {
      const { descricao, valor_total, data } = req.body || {};
      if (!descricao || !String(descricao).trim()) {
        return res.status(400).json({ success: false, error: 'Descrição é obrigatória' });
      }
      if (!valor_total || Number(valor_total) <= 0) {
        return res.status(400).json({ success: false, error: 'Valor deve ser maior que zero' });
      }

      const payload = {
        descricao: String(descricao).trim(),
        valor_total: Number(valor_total),
        data: data || new Date().toISOString().slice(0, 10),
        criado_por: req.usuario!.id,
      };

      // NÃO insere em `caixa` — é exatamente o ponto desta rota (ver
      // migration_041): só lança quando um recebimento for confirmado.
      const { data: created, error } = await supabase.from('caixa_pendencias').insert([payload]).select(SELECT_PENDENCIA).single();
      if (error) throw error;
      res.json({ success: true, data: created });
    } catch (error: any) {
      console.error('Erro ao criar pendência de caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // A validação de valor/saldo/forma de pagamento acontece toda dentro da
  // RPC (transacional, trava a pendência) — aqui só repassa o erro dela como
  // 400, mesmo padrão de fiado.ts pro registrar_recebimento_fiado.
  router.post('/:id/recebimentos', exigirPermissao('caixa.gerenciar_pendencias'), async (req: AuthenticatedRequest, res) => {
    try {
      const valor = Number(req.body?.valor);
      const formaPagamentoId = req.body?.forma_pagamento_id;
      if (!formaPagamentoId) return res.status(400).json({ success: false, error: 'Forma de pagamento é obrigatória' });
      if (!valor || valor <= 0) return res.status(400).json({ success: false, error: 'Valor inválido' });

      const { data: recebimento, error } = await supabase.rpc('registrar_recebimento_caixa_pendencia', {
        p_pendencia_id: req.params.id,
        p_valor: valor,
        p_forma_pagamento_id: formaPagamentoId,
        p_usuario_id: req.usuario!.id,
      });
      if (error) throw error;

      // A RPC devolve a linha crua (sem os joins) — rebusca com forma_pagamento
      // e usuario já resolvidos, pro frontend não precisar de um segundo fetch.
      const { data, error: erroBusca } = await supabase.from('caixa_pendencia_recebimentos').select(SELECT_RECEBIMENTO).eq('id', recebimento.id).single();
      if (erroBusca) throw erroBusca;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao registrar recebimento de pendência de caixa:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Reverter um recebimento registrado por engano — apaga a entrada de caixa
  // vinculada junto, senão o dinheiro ficaria "fantasma" lançado no Caixa, e
  // reabre o status da pendência ('aberta'): remover um recebimento positivo
  // necessariamente deixa saldo > 0.
  router.delete('/:id/recebimentos/:recebimentoId', exigirPermissao('caixa.gerenciar_pendencias'), async (req, res) => {
    try {
      const { data: recebimento, error: erroBusca } = await supabase
        .from('caixa_pendencia_recebimentos')
        .select('id, pendencia_id, caixa_id')
        .eq('id', req.params.recebimentoId)
        .eq('pendencia_id', req.params.id)
        .maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!recebimento) return res.status(404).json({ success: false, error: 'Recebimento não encontrado' });

      if (recebimento.caixa_id) {
        const { error: erroCaixa } = await supabase.from('caixa').delete().eq('id', recebimento.caixa_id);
        if (erroCaixa) throw erroCaixa;
      }

      const { error } = await supabase.from('caixa_pendencia_recebimentos').delete().eq('id', req.params.recebimentoId);
      if (error) throw error;

      const { error: erroReabrir } = await supabase.from('caixa_pendencias').update({ status: 'aberta' }).eq('id', req.params.id);
      if (erroReabrir) throw erroReabrir;

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao remover recebimento de pendência de caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Apagar uma pendência criada por engano — FK "on delete restrict" em
  // caixa_pendencia_recebimentos.pendencia_id barra sozinha se já tiver
  // recebimento (reverta os recebimentos primeiro).
  router.delete('/:id', exigirPermissao('caixa.gerenciar_pendencias'), async (req, res) => {
    try {
      const { error } = await supabase.from('caixa_pendencias').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === '23503') {
        return res.status(409).json({ success: false, error: 'Esta pendência já tem recebimento registrado — reverta os recebimentos antes de excluir.' });
      }
      console.error('Erro ao excluir pendência de caixa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
