// Envios registrados (migration_034) — vira rastreável de verdade o que
// antes só existia como cotação avulsa em src/features/frete/. CRUD comum +
// POST /:id/rastrear, que tenta buscar o status atual na API do Melhor
// Envio quando o envio tem melhor_envio_order_id (ou seja, foi de fato
// comprado por ela, não só cotado ou postado por outra transportadora).
//
// A chamada externa em si (e o rastreio automático em background) vive em
// src/services/rastreioMelhorEnvioService.ts — reutilizado também pelo
// scheduler (ver enviosScheduler.ts), pra não duplicar a lógica nos dois
// lugares. Aqui é só o CRUD + a rota manual que aciona esse serviço.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { exigirPermissao } from '../../../middleware/auth.js';
import { rastrearEnvio } from '../../services/rastreioMelhorEnvioService.js';

const SELECT_COM_JOIN = '*, cliente:clientes(id, nome, telefone)';

const STATUS_VALIDOS = ['aguardando_postagem', 'postado', 'em_transito', 'entregue', 'problema', 'cancelado'] as const;

const CAMPOS_EDITAVEIS = [
  'cliente_id',
  'cliente_nome',
  'venda_id',
  'transportadora',
  'servico',
  'codigo_rastreio',
  'melhor_envio_order_id',
  'cep_destino',
  'valor_frete',
  'status',
] as const;

export function enviosRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', exigirPermissao('frete.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('envios').select(SELECT_COM_JOIN).order('criado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar envios:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', exigirPermissao('frete.criar'), async (req: AuthenticatedRequest, res) => {
    try {
      const payload = {
        cliente_id: req.body?.cliente_id || null,
        cliente_nome: req.body?.cliente_nome ? String(req.body.cliente_nome).trim() : null,
        venda_id: req.body?.venda_id || null,
        transportadora: req.body?.transportadora ? String(req.body.transportadora).trim() : null,
        servico: req.body?.servico ? String(req.body.servico).trim() : null,
        codigo_rastreio: req.body?.codigo_rastreio ? String(req.body.codigo_rastreio).trim() : null,
        melhor_envio_order_id: req.body?.melhor_envio_order_id ? String(req.body.melhor_envio_order_id).trim() : null,
        cep_destino: req.body?.cep_destino ? String(req.body.cep_destino).trim() : null,
        valor_frete: req.body?.valor_frete !== undefined && req.body.valor_frete !== null ? Number(req.body.valor_frete) : null,
        criado_por: req.usuario?.id ?? null,
      };
      const { data, error } = await supabase.from('envios').insert(payload).select(SELECT_COM_JOIN).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao registrar envio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id', exigirPermissao('frete.editar'), async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      for (const campo of CAMPOS_EDITAVEIS) {
        if (req.body?.[campo] === undefined) continue;
        if (campo === 'status') {
          if (!STATUS_VALIDOS.includes(req.body.status)) return res.status(400).json({ success: false, error: 'Status inválido' });
          payload.status = req.body.status;
          payload.status_atualizado_em = new Date().toISOString();
        } else if (campo === 'valor_frete') {
          payload.valor_frete = req.body.valor_frete === '' || req.body.valor_frete === null ? null : Number(req.body.valor_frete);
        } else {
          payload[campo] = req.body[campo] === '' ? null : req.body[campo];
        }
      }
      const { data, error } = await supabase.from('envios').update(payload).eq('id', req.params.id).select(SELECT_COM_JOIN).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Envio não encontrado' });
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar envio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', exigirPermissao('frete.deletar'), async (req, res) => {
    try {
      const { error } = await supabase.from('envios').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir envio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/rastrear', exigirPermissao('frete.editar'), async (req, res) => {
    try {
      const { data: envio, error: erroBusca } = await supabase.from('envios').select('*').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!envio) return res.status(404).json({ success: false, error: 'Envio não encontrado' });

      const atualizacao = await rastrearEnvio(envio);

      const { data, error } = await supabase.from('envios').update(atualizacao).eq('id', req.params.id).select(SELECT_COM_JOIN).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao rastrear envio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
