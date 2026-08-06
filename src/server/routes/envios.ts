// Envios registrados (migration_034) — vira rastreável de verdade o que
// antes só existia como cotação avulsa em src/features/frete/. CRUD comum +
// POST /:id/rastrear, que tenta buscar o status atual na API do Melhor
// Envio quando o envio tem melhor_envio_order_id (ou seja, foi de fato
// comprado por ela, não só cotado ou postado por outra transportadora).
//
// A chamada externa é tratada como best-effort: se o token não tiver o
// escopo de rastreio, ou o pedido não existir do lado do Melhor Envio, o
// erro vai pra status_detalhe e a resposta continua 200 — o registro do
// envio em si não depende da API externa funcionar (ver plano da Fase 2).
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';

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

// Tradução best-effort de status da API do Melhor Envio pro nosso enum —
// nomes de status exatos ainda não confirmados contra a API real (ver risco
// no plano da Fase 2); qualquer status não reconhecido só fica registrado
// em status_detalhe, sem tentar adivinhar o mapeamento.
function mapearStatusExterno(statusExterno: string | undefined | null): (typeof STATUS_VALIDOS)[number] | null {
  const s = (statusExterno || '').toLowerCase();
  if (['delivered', 'entregue'].includes(s)) return 'entregue';
  if (['posted', 'released', 'postado'].includes(s)) return 'postado';
  if (['in_transit', 'transit', 'em_transito'].includes(s)) return 'em_transito';
  if (['cancelled', 'canceled', 'cancelado'].includes(s)) return 'cancelado';
  return null;
}

export function enviosRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('envios').select(SELECT_COM_JOIN).order('criado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar envios:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
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

  router.patch('/:id', async (req, res) => {
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

  router.delete('/:id', async (req, res) => {
    try {
      const { error } = await supabase.from('envios').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir envio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/rastrear', async (req, res) => {
    try {
      const { data: envio, error: erroBusca } = await supabase.from('envios').select('*').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!envio) return res.status(404).json({ success: false, error: 'Envio não encontrado' });

      const atualizacao: Record<string, any> = { status_atualizado_em: new Date().toISOString() };

      if (!envio.melhor_envio_order_id) {
        atualizacao.status_detalhe = 'Sem número de pedido do Melhor Envio — status é só manual pra este envio.';
      } else {
        try {
          const token = process.env.MELHOR_ENVIO_TOKEN;
          const response = await axios.post(
            'https://melhorenvio.com.br/api/v2/me/shipment/tracking',
            { orders: [envio.melhor_envio_order_id] },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'RK Sucatas (contato@rksucatas.com.br)',
              },
            }
          );
          const info = response.data?.[envio.melhor_envio_order_id] ?? response.data;
          const statusMapeado = mapearStatusExterno(info?.status);
          if (statusMapeado) atualizacao.status = statusMapeado;
          atualizacao.status_detalhe = info?.tracking ? `Rastreio: ${info.tracking}` : JSON.stringify(info).slice(0, 500);
        } catch (erroExterno: any) {
          // Best-effort: token sem escopo de rastreio, pedido não encontrado do
          // lado do Melhor Envio etc. — não falha a request, só registra.
          const detalhe = erroExterno.response?.data?.message || erroExterno.message;
          console.error('Erro ao rastrear envio via Melhor Envio:', erroExterno.response?.data || erroExterno.message);
          atualizacao.status_detalhe = `Não foi possível atualizar automaticamente: ${detalhe}`;
        }
      }

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
