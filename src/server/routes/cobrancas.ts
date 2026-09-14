import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';

const SELECT_COBRANCA = '*, criador:usuarios!cobrancas_criado_por_fkey(id, nome_exibicao), enviador:usuarios!cobrancas_enviado_por_fkey(id, nome_exibicao)';

export function cobrancasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', exigirPermissao('caixa.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('cobrancas').select(SELECT_COBRANCA).order('criado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar cobranças:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', exigirPermissao('caixa.gerenciar_pendencias'), async (req: AuthenticatedRequest, res) => {
    try {
      const vendaId = req.body?.venda_id || null;
      const pendenciaId = req.body?.pendencia_id || null;

      if (!vendaId && !pendenciaId) {
        return res.status(400).json({ success: false, error: 'Informe venda_id ou pendencia_id' });
      }
      if (vendaId && pendenciaId) {
        return res.status(400).json({ success: false, error: 'Informe apenas um: venda_id ou pendencia_id' });
      }

      const intervaloMinutos = req.body?.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null;
      const horarioFixo = req.body?.horario_fixo || null;
      if (intervaloMinutos != null && horarioFixo) {
        return res.status(400).json({ success: false, error: 'Escolha só um: intervalo OU horário fixo' });
      }
      if (intervaloMinutos != null && (!Number.isFinite(intervaloMinutos) || intervaloMinutos < 5)) {
        return res.status(400).json({ success: false, error: 'Intervalo mínimo é 5 minutos' });
      }

      const timerAtivo = !!(intervaloMinutos || horarioFixo);
      let proximaNotificacaoEm: string | null = null;
      if (timerAtivo) {
        if (intervaloMinutos) {
          proximaNotificacaoEm = new Date(Date.now() + intervaloMinutos * 60 * 1000).toISOString();
        } else if (horarioFixo) {
          proximaNotificacaoEm = new Date(horarioFixo).toISOString();
        }
      }

      const payload: Record<string, any> = {
        venda_id: vendaId,
        pendencia_id: pendenciaId,
        intervalo_minutos: intervaloMinutos,
        horario_fixo: horarioFixo,
        proxima_notificacao_em: proximaNotificacaoEm,
        timer_ativo: timerAtivo,
        criado_por: req.usuario!.id,
      };

      if (req.body?.boleto_storage_path) {
        payload.boleto_storage_path = req.body.boleto_storage_path;
        payload.boleto_nome_arquivo = req.body.boleto_nome_arquivo || null;
        payload.boleto_tipo_mime = req.body.boleto_tipo_mime || null;
        payload.boleto_tamanho_bytes = req.body.boleto_tamanho_bytes || null;
      }

      const { data, error } = await supabase.from('cobrancas').insert(payload).select(SELECT_COBRANCA).single();
      if (error) throw error;

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar cobrança:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id', exigirPermissao('caixa.gerenciar_pendencias'), async (req: AuthenticatedRequest, res) => {
    try {
      const payload: Record<string, any> = {};

      if (req.body?.boleto_storage_path !== undefined) {
        payload.boleto_storage_path = req.body.boleto_storage_path;
        payload.boleto_nome_arquivo = req.body.boleto_nome_arquivo || null;
        payload.boleto_tipo_mime = req.body.boleto_tipo_mime || null;
        payload.boleto_tamanho_bytes = req.body.boleto_tamanho_bytes || null;
      }

      if (req.body?.intervalo_minutos !== undefined || req.body?.horario_fixo !== undefined) {
        const intervaloMinutos = req.body?.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null;
        const horarioFixo = req.body?.horario_fixo || null;

        if (intervaloMinutos != null && horarioFixo) {
          return res.status(400).json({ success: false, error: 'Escolha só um: intervalo OU horário fixo' });
        }

        payload.intervalo_minutos = intervaloMinutos;
        payload.horario_fixo = horarioFixo;

        const timerAtivo = !!(intervaloMinutos || horarioFixo);
        payload.timer_ativo = timerAtivo;

        if (timerAtivo) {
          if (intervaloMinutos) {
            payload.proxima_notificacao_em = new Date(Date.now() + intervaloMinutos * 60 * 1000).toISOString();
          } else if (horarioFixo) {
            payload.proxima_notificacao_em = new Date(horarioFixo).toISOString();
          }
        } else {
          payload.proxima_notificacao_em = null;
        }
      }

      if (req.body?.timer_ativo !== undefined && req.body?.intervalo_minutos === undefined && req.body?.horario_fixo === undefined) {
        payload.timer_ativo = !!req.body.timer_ativo;
        if (!payload.timer_ativo) {
          payload.proxima_notificacao_em = null;
        }
      }

      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
      }

      const { data, error } = await supabase.from('cobrancas').update(payload).eq('id', req.params.id).select(SELECT_COBRANCA).single();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Cobrança não encontrada' });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar cobrança:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/registrar-envio', exigirPermissao('caixa.gerenciar_pendencias'), async (req: AuthenticatedRequest, res) => {
    try {
      const agora = new Date().toISOString();
      const payload: Record<string, any> = {
        ultimo_envio_em: agora,
        enviado_por: req.usuario!.id,
      };

      const { data: cobranca, error: erroBusca } = await supabase.from('cobrancas').select('intervalo_minutos, horario_fixo, timer_ativo').eq('id', req.params.id).single();
      if (erroBusca) throw erroBusca;
      if (!cobranca) return res.status(404).json({ success: false, error: 'Cobrança não encontrada' });

      if (cobranca.timer_ativo && cobranca.intervalo_minutos) {
        payload.proxima_notificacao_em = new Date(Date.now() + cobranca.intervalo_minutos * 60 * 1000).toISOString();
      }

      const { data, error } = await supabase.from('cobrancas').update(payload).eq('id', req.params.id).select(SELECT_COBRANCA).single();
      if (error) throw error;

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao registrar envio:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', exigirPermissao('caixa.gerenciar_pendencias'), async (req, res) => {
    try {
      const { error } = await supabase.from('cobrancas').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true, data: null });
    } catch (error: any) {
      console.error('Erro ao excluir cobrança:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
