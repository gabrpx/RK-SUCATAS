// CRUD de vendas. Criar e cancelar passam pelas funções do banco
// (registrar_venda / cancelar_venda) pra manter venda + baixa de estoque +
// lançamento no caixa atômicos — nunca dá pra vender e "esquecer" de
// descontar o estoque, como acontecia no sistema antigo.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { gerarUrlAssinadaComprovante } from '../../services/storageService.js';
import { avisarAnunciosDesatualizados } from '../../services/mercadolivreSync.js';

const SELECT_COM_JOIN =
  '*, modelo_moto:modelos_moto(id, nome, ano), forma_pagamento:formas_pagamento(id, nome, natureza), cliente:clientes(id, nome, telefone), unidade:estoque_unidades(id, nome, avaria, avaria_descricao, fotos, valor)';

const SELECT_COMPROVANTE = '*, autor:usuarios!comprovantes_pix_criado_por_fkey(id, nome_exibicao)';

export function vendasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', exigirPermissao('vendas.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('vendas').select(SELECT_COM_JOIN).order('data', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar vendas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', exigirPermissao('vendas.criar'), async (req, res) => {
    try {
      const { estoque_id, quantidade, valor_unitario, forma_pagamento_id, modelo_moto_id, cliente_nome, cliente_id, observacoes, data, componente, unidade_id } = req.body || {};

      if (!estoque_id) return res.status(400).json({ success: false, error: 'estoque_id é obrigatório' });
      if (!quantidade || Number(quantidade) <= 0) return res.status(400).json({ success: false, error: 'Quantidade inválida' });
      if (valor_unitario === undefined || Number(valor_unitario) < 0) {
        return res.status(400).json({ success: false, error: 'Valor unitário inválido' });
      }
      if (!forma_pagamento_id) return res.status(400).json({ success: false, error: 'Forma de pagamento é obrigatória' });

      if (cliente_id) {
        const { data: cli } = await supabase.from('clientes').select('banido').eq('id', cliente_id).maybeSingle();
        if (cli?.banido) return res.status(400).json({ success: false, error: 'Este cliente está banido e não pode receber novas vendas' });
      }

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
        p_cliente_id: cliente_id || null,
        p_unidade_id: unidade_id || null,
        p_nome_item: null,
      });

      if (error) throw error;
      // Fire-and-forget: a venda já está registrada; avisar sobre o anúncio
      // não pode atrasar nem derrubar a resposta.
      void avisarAnunciosDesatualizados(supabase, [estoque_id]);
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
  router.patch('/:id', exigirPermissao('vendas.editar'), async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      for (const campo of ['forma_pagamento_id', 'observacoes', 'cliente_nome', 'cliente_id'] as const) {
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

  router.delete('/:id', exigirPermissao('vendas.cancelar'), async (req, res) => {
    try {
      const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: req.params.id });
      if (error) {
        // 23503 = violação de FK — fiado_recebimentos.venda_id é "on delete
        // restrict" de propósito (ver migration_031): não deixa cancelar uma
        // venda que já tem dinheiro recebido registrado.
        if (error.code === '23503') {
          return res.status(409).json({ success: false, error: 'Não é possível cancelar: já há recebimento(s) de fiado registrados pra esta venda.' });
        }
        throw error;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao cancelar venda:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Cancela uma venda fiado mesmo já quitada (parcial ou total): reverte
  // todos os fiado_recebimentos dela (e as entradas de caixa vinculadas) e só
  // então cancela a venda em si — tudo numa transação (migration_037). Ação
  // sensível (mexe com dinheiro já recebido), por isso só admin.
  router.delete('/:id/fiado-completo', exigirPermissao('vendas.cancelar_fiado'), async (req, res) => {
    try {
      const { error } = await supabase.rpc('cancelar_venda_fiado_completa', { p_venda_id: req.params.id });
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao cancelar venda fiado em cascata:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Comprovantes de PIX da venda — sempre soma, nunca substitui (ver
  // migration_036). Upload do arquivo em si acontece em POST
  // /api/upload/comprovante; esta rota só registra o vínculo com a venda
  // depois que o arquivo já está no Storage.
  router.get('/:id/comprovantes', exigirPermissao('vendas.ver'), async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('comprovantes_pix')
        .select(SELECT_COMPROVANTE)
        .eq('venda_id', req.params.id)
        .is('removido_em', null)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      const comUrl = await Promise.all(
        (data ?? []).map(async (c: any) => ({ ...c, url: await gerarUrlAssinadaComprovante(c.storage_path) }))
      );
      res.json({ success: true, data: comUrl });
    } catch (error: any) {
      console.error('Erro ao listar comprovantes da venda:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/comprovantes', exigirPermissao('vendas.editar'), async (req: AuthenticatedRequest, res) => {
    try {
      const { storage_path, nome_arquivo, tipo_mime, tamanho_bytes } = req.body || {};
      if (!storage_path || !nome_arquivo || !tipo_mime || !tamanho_bytes) {
        return res.status(400).json({ success: false, error: 'Dados do arquivo incompletos' });
      }

      const { data: venda, error: erroVenda } = await supabase
        .from('vendas')
        .select('cliente_id')
        .eq('id', req.params.id)
        .maybeSingle();
      if (erroVenda) throw erroVenda;
      if (!venda) return res.status(404).json({ success: false, error: 'Venda não encontrada' });

      const { data, error } = await supabase
        .from('comprovantes_pix')
        .insert({
          venda_id: req.params.id,
          cliente_id: venda.cliente_id,
          storage_path,
          nome_arquivo,
          tipo_mime,
          tamanho_bytes,
          criado_por: req.usuario!.id,
        })
        .select(SELECT_COMPROVANTE)
        .single();
      if (error) throw error;
      res.json({ success: true, data: { ...data, url: await gerarUrlAssinadaComprovante(data.storage_path) } });
    } catch (error: any) {
      console.error('Erro ao anexar comprovante na venda:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Soft-delete, só admin — o arquivo em si nunca é apagado do Storage (ver
  // storageService.ts, sem função de exclusão de comprovante de propósito).
  router.delete('/:id/comprovantes/:comprovanteId', exigirPermissao('vendas.excluir_comprovante'), async (req: AuthenticatedRequest, res) => {
    try {
      const { error } = await supabase
        .from('comprovantes_pix')
        .update({ removido_em: new Date().toISOString(), removido_por: req.usuario!.id })
        .eq('id', req.params.comprovanteId)
        .eq('venda_id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao remover comprovante da venda:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
