// CRUD de orçamentos. Camada de conveniência/rastreabilidade sobre
// estoque+vendas — quem garante a consistência do estoque continua sendo só
// registrar_venda/cancelar_venda (RPCs já existentes, sem alteração de
// assinatura). "Vender" um item do orçamento é só orquestração aqui: chama a
// RPC de venda e depois faz updates simples pra linkar/fechar a linha.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

const SELECT_COM_ITENS = '*, itens:orcamento_itens(*)';

const CAMPOS_HEADER_EDITAVEIS = ['cliente_nome', 'cliente_telefone', 'desconto_tipo', 'desconto_valor', 'observacoes', 'validade'] as const;

export function orcamentosRouter(supabase: SupabaseClient) {
  const router = Router();

  const buscarOrcamento = async (id: string) => {
    const { data, error } = await supabase.from('orcamentos').select(SELECT_COM_ITENS).eq('id', id).single();
    if (error) throw error;
    return data;
  };

  // Recalcula o status: só vira 'convertido' quando toda linha tiver venda_id.
  const recalcularStatus = async (orcamentoId: string) => {
    const { data: orcamento, error: e1 } = await supabase.from('orcamentos').select('status').eq('id', orcamentoId).single();
    if (e1) throw e1;
    if (orcamento.status !== 'aberto') return; // já convertido/cancelado, nada a recalcular

    const { count, error: e2 } = await supabase
      .from('orcamento_itens')
      .select('id', { count: 'exact', head: true })
      .eq('orcamento_id', orcamentoId)
      .is('venda_id', null);
    if (e2) throw e2;

    if (count === 0) {
      const { error: e3 } = await supabase.from('orcamentos').update({ status: 'convertido' }).eq('id', orcamentoId);
      if (e3) throw e3;
    }
  };

  // Vende uma linha (inteira ou só um componente) e faz o link de volta.
  // Lança em caso de erro de regra de negócio (estoque insuficiente etc.) —
  // quem chama decide se responde 400 direto ou acumula num relatório de falhas.
  const venderLinha = async (item: any, params: { forma_pagamento_id: string; componente?: string | null; data?: string | null; cliente_nome: string }) => {
    const componenteFinal = params.componente ?? item.componente ?? null;

    const { data: venda, error } = await supabase.rpc('registrar_venda', {
      p_estoque_id: item.estoque_id,
      p_quantidade: componenteFinal ? 1 : item.quantidade,
      p_valor_unitario: item.valor_unitario,
      p_forma_pagamento_id: params.forma_pagamento_id,
      p_modelo_moto_id: null,
      p_cliente_nome: params.cliente_nome,
      p_observacoes: null,
      p_data: params.data || null,
      p_componente: componenteFinal,
    });
    if (error) throw error;

    const { error: linkError } = await supabase.from('vendas').update({ orcamento_item_id: item.id }).eq('id', venda.id);
    if (linkError) throw linkError;

    // Só fecha a linha (seta venda_id) quando o que foi de fato vendido bate
    // com o que essa linha representa. Uma linha já cotada como "só uma
    // parte" (item.componente fixo) fecha assim que essa parte é vendida.
    // Uma linha cotada como "item completo" (item.componente null) só fecha
    // se a venda também foi do item completo — se na hora de vender o
    // usuário escolheu vender só uma parte dela, a linha continua aberta,
    // mostrando que falta vender o resto.
    if (componenteFinal === (item.componente ?? null)) {
      const { error: fecharError } = await supabase.from('orcamento_itens').update({ venda_id: venda.id }).eq('id', item.id);
      if (fecharError) throw fecharError;
    }

    return venda;
  };

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select(SELECT_COM_ITENS)
        .order('criado_em', { ascending: false })
        .order('criado_em', { foreignTable: 'orcamento_itens', ascending: true });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar orçamentos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { cliente_nome, cliente_telefone, desconto_tipo, desconto_valor, observacoes, validade, itens } = req.body || {};

      if (!cliente_nome || !String(cliente_nome).trim()) return res.status(400).json({ success: false, error: 'Nome do cliente é obrigatório' });
      if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ success: false, error: 'Adicione ao menos um item ao orçamento' });

      const { data: orcamento, error: e1 } = await supabase
        .from('orcamentos')
        .insert({
          cliente_nome,
          cliente_telefone: cliente_telefone || null,
          desconto_tipo: desconto_tipo || null,
          desconto_valor: Number(desconto_valor) || 0,
          observacoes: observacoes || null,
          validade: validade || null,
        })
        .select()
        .single();
      if (e1) throw e1;

      const linhas = itens.map((i: any) => ({
        orcamento_id: orcamento.id,
        estoque_id: i.estoque_id || null,
        nome_item: i.nome_item,
        componentes_disponiveis: i.componentes_disponiveis || null,
        componente: i.componente || null,
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0,
      }));

      const { error: e2 } = await supabase.from('orcamento_itens').insert(linhas);
      if (e2) throw e2;

      const data = await buscarOrcamento(orcamento.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar orçamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const { data: atual, error: e1 } = await supabase.from('orcamentos').select('status').eq('id', req.params.id).single();
      if (e1) throw e1;
      if (atual.status !== 'aberto') return res.status(400).json({ success: false, error: 'Só é possível editar orçamentos em aberto' });

      const payload: Record<string, any> = {};
      for (const campo of CAMPOS_HEADER_EDITAVEIS) {
        if (req.body[campo] !== undefined) payload[campo] = req.body[campo];
      }

      const { error: e2 } = await supabase.from('orcamentos').update(payload).eq('id', req.params.id);
      if (e2) throw e2;

      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar orçamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/cancelar', async (req, res) => {
    try {
      const { data: atual, error: e1 } = await supabase.from('orcamentos').select('status').eq('id', req.params.id).single();
      if (e1) throw e1;
      if (atual.status !== 'aberto') return res.status(400).json({ success: false, error: 'Só é possível cancelar orçamentos em aberto' });

      const { error: e2 } = await supabase.from('orcamentos').update({ status: 'cancelado', cancelado_em: new Date().toISOString() }).eq('id', req.params.id);
      if (e2) throw e2;

      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao cancelar orçamento:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/itens', async (req, res) => {
    try {
      const { data: atual, error: e1 } = await supabase.from('orcamentos').select('status').eq('id', req.params.id).single();
      if (e1) throw e1;
      if (atual.status !== 'aberto') return res.status(400).json({ success: false, error: 'Só é possível adicionar itens a orçamentos em aberto' });

      const { estoque_id, nome_item, componentes_disponiveis, componente, quantidade, valor_unitario } = req.body || {};
      if (!nome_item) return res.status(400).json({ success: false, error: 'nome_item é obrigatório' });

      const { error: e2 } = await supabase.from('orcamento_itens').insert({
        orcamento_id: req.params.id,
        estoque_id: estoque_id || null,
        nome_item,
        componentes_disponiveis: componentes_disponiveis || null,
        componente: componente || null,
        quantidade: Number(quantidade) || 1,
        valor_unitario: Number(valor_unitario) || 0,
      });
      if (e2) throw e2;

      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao adicionar item ao orçamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/itens/:itemId', async (req, res) => {
    try {
      const { data: item, error: e1 } = await supabase.from('orcamento_itens').select('venda_id').eq('id', req.params.itemId).eq('orcamento_id', req.params.id).single();
      if (e1) throw e1;
      if (item.venda_id) return res.status(400).json({ success: false, error: 'Esta linha já foi vendida, não pode ser editada' });

      const payload: Record<string, any> = {};
      if (req.body.valor_unitario !== undefined) payload.valor_unitario = Number(req.body.valor_unitario) || 0;
      if (req.body.quantidade !== undefined) payload.quantidade = Number(req.body.quantidade) || 1;

      const { error: e2 } = await supabase.from('orcamento_itens').update(payload).eq('id', req.params.itemId);
      if (e2) throw e2;

      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar item do orçamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id/itens/:itemId', async (req, res) => {
    try {
      const { data: item, error: e1 } = await supabase.from('orcamento_itens').select('venda_id').eq('id', req.params.itemId).eq('orcamento_id', req.params.id).single();
      if (e1) throw e1;
      if (item.venda_id) return res.status(400).json({ success: false, error: 'Esta linha já foi vendida, não pode ser removida' });

      const { error: e2 } = await supabase.from('orcamento_itens').delete().eq('id', req.params.itemId);
      if (e2) throw e2;

      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao remover item do orçamento:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/itens/:itemId/vender', async (req, res) => {
    try {
      const { forma_pagamento_id, componente, data: dataVenda } = req.body || {};
      if (!forma_pagamento_id) return res.status(400).json({ success: false, error: 'Forma de pagamento é obrigatória' });

      const { data: orcamento, error: e1 } = await supabase.from('orcamentos').select('status, cliente_nome').eq('id', req.params.id).single();
      if (e1) throw e1;
      if (orcamento.status !== 'aberto') return res.status(400).json({ success: false, error: 'Este orçamento não está mais em aberto' });

      const { data: item, error: e2 } = await supabase.from('orcamento_itens').select('*').eq('id', req.params.itemId).eq('orcamento_id', req.params.id).single();
      if (e2) throw e2;
      if (item.venda_id) return res.status(400).json({ success: false, error: 'Esta linha já foi vendida' });

      const venda = await venderLinha(item, { forma_pagamento_id, componente, data: dataVenda, cliente_nome: orcamento.cliente_nome });
      await recalcularStatus(req.params.id);

      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data: { venda, orcamento: data } });
    } catch (error: any) {
      console.error('Erro ao vender item do orçamento:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/vender-tudo', async (req, res) => {
    try {
      const { forma_pagamento_id, data: dataVenda } = req.body || {};
      if (!forma_pagamento_id) return res.status(400).json({ success: false, error: 'Forma de pagamento é obrigatória' });

      const { data: orcamento, error: e1 } = await supabase.from('orcamentos').select('status, cliente_nome').eq('id', req.params.id).single();
      if (e1) throw e1;
      if (orcamento.status !== 'aberto') return res.status(400).json({ success: false, error: 'Este orçamento não está mais em aberto' });

      const { data: pendentes, error: e2 } = await supabase.from('orcamento_itens').select('*').eq('orcamento_id', req.params.id).is('venda_id', null);
      if (e2) throw e2;

      const sucesso: string[] = [];
      const falhas: { itemId: string; error: string }[] = [];

      // Loop sequencial (não é uma transação única) — mesmo estilo pragmático
      // do resto do app, já que registrar_venda é atômica por linha. Se uma
      // linha falhar (ex: ficou sem estoque no meio do caminho), as
      // anteriores permanecem vendidas e a falha é reportada à parte.
      for (const item of pendentes || []) {
        try {
          await venderLinha(item, { forma_pagamento_id, data: dataVenda, cliente_nome: orcamento.cliente_nome });
          sucesso.push(item.id);
        } catch (err: any) {
          falhas.push({ itemId: item.id, error: err.message });
        }
      }

      await recalcularStatus(req.params.id);

      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data: { sucesso, falhas, orcamento: data } });
    } catch (error: any) {
      console.error('Erro ao vender orçamento:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
}
