// Lembretes: sub-aba dentro de Tarefas (ver migration_042). Diferente de
// Tarefas (mandado de campo, só mandados/mecanico executam), um lembrete
// pode ser atribuído a qualquer um dos 4 papéis que veem Tarefas — e cada
// usuário só enxerga os que criou ou os que foram atribuídos a ele (não tem
// "visão de dono vê tudo" como em tarefas.ts). Montada em server.ts SEM
// autorizar() no mount porque o comportamento varia por papel dentro de
// cada rota, mesmo espírito de tarefas.ts.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { temPermissao, ehAdmin, type UsuarioLogado } from '../../../middleware/auth.js';
import { notificarUsuario } from '../../services/pushNotificationService.js';

const SELECT_COM_JOINS = '*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao)';

// Qualquer um que veja Tarefas (tarefas.ver) usa lembretes — o escopo por dono
// continua sendo aplicado por linha (cada um vê os que criou ou recebeu).
function podeAcessar(usuario: UsuarioLogado | undefined): boolean {
  return temPermissao(usuario, 'tarefas.ver');
}

// "Gerente" (tarefas.criar) conclui/reabre qualquer lembrete; os demais só os
// atribuídos a eles.
function ehGerente(usuario: UsuarioLogado | undefined): boolean {
  return temPermissao(usuario, 'tarefas.criar');
}

// now() calculado no Node (não no banco) porque o valor de horario_fixo já
// chega do cliente como ISO string — mistura-lo com now() do Postgres numa
// mesma expressão exigiria outra viagem ao banco só pra isso.
function calcularProximaNotificacao(intervaloMinutos: number | null, horarioFixo: string | null): string | null {
  if (intervaloMinutos != null) return new Date(Date.now() + intervaloMinutos * 60 * 1000).toISOString();
  if (horarioFixo) return new Date(horarioFixo).toISOString();
  return null;
}

export function lembretesRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      if (!podeAcessar(req.usuario)) {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      const meuId = req.usuario!.id;
      let query = supabase
        .from('lembretes')
        .select(SELECT_COM_JOINS)
        .or(`atribuido_para.eq.${meuId},criado_por.eq.${meuId}`)
        .order('status', { ascending: true })
        .order('proxima_notificacao_em', { ascending: true, nullsFirst: false });

      if (req.query.status) query = query.eq('status', String(req.query.status));

      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar lembretes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      if (!podeAcessar(req.usuario)) {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      const titulo = String(req.body?.titulo || '').trim();
      if (!titulo) return res.status(400).json({ success: false, error: 'Título é obrigatório' });

      const intervaloMinutos = req.body?.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null;
      const horarioFixo = req.body?.horario_fixo || null;
      if (intervaloMinutos == null && !horarioFixo) {
        return res.status(400).json({ success: false, error: 'Escolha um intervalo de repetição ou um horário específico' });
      }
      if (intervaloMinutos != null && horarioFixo) {
        return res.status(400).json({ success: false, error: 'Escolha só um: repetir OU horário específico' });
      }
      if (intervaloMinutos != null && (!Number.isFinite(intervaloMinutos) || intervaloMinutos < 5)) {
        return res.status(400).json({ success: false, error: 'Intervalo mínimo é 5 minutos' });
      }

      const atribuidoPara = req.body?.atribuido_para || req.usuario!.id;
      if (atribuidoPara !== req.usuario!.id) {
        const { data: destinatario, error: erroDestinatario } = await supabase.from('usuarios').select('id, ativo').eq('id', atribuidoPara).maybeSingle();
        if (erroDestinatario) throw erroDestinatario;
        if (!destinatario || !destinatario.ativo) {
          return res.status(400).json({ success: false, error: 'Responsável precisa ser um usuário ativo' });
        }
      }

      const payload = {
        titulo,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        atribuido_para: atribuidoPara,
        criado_por: req.usuario!.id,
        intervalo_minutos: intervaloMinutos,
        proxima_notificacao_em: calcularProximaNotificacao(intervaloMinutos, horarioFixo),
      };

      const { data, error } = await supabase.from('lembretes').insert(payload).select(SELECT_COM_JOINS).single();
      if (error) throw error;

      // Fire-and-forget: uma falha no push nunca pode derrubar a criação do
      // lembrete (mesmo padrão de tarefas.ts). Não notifica quem se
      // autoatribuiu — a pessoa já sabe, acabou de criar.
      if (atribuidoPara !== req.usuario!.id) {
        notificarUsuario(supabase, atribuidoPara, { titulo: 'Novo lembrete', corpo: titulo, url: '/tarefas' }).catch((e) =>
          console.error('Erro ao notificar novo lembrete:', e)
        );
      }

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar lembrete:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Confirma que o usuário logado pode editar/excluir este lembrete (dono =
  // criador, ou admin mexe em qualquer um). Retorna o lembrete atual ou já
  // responde o erro.
  async function carregarLembreteEditavel(req: AuthenticatedRequest, res: any) {
    if (!podeAcessar(req.usuario)) {
      res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      return null;
    }
    const { data: lembrete, error } = await supabase.from('lembretes').select('id, criado_por, atribuido_para').eq('id', req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return null;
    }
    if (!lembrete) {
      res.status(404).json({ success: false, error: 'Lembrete não encontrado' });
      return null;
    }
    if (!ehAdmin(req.usuario) && lembrete.criado_por !== req.usuario!.id) {
      res.status(403).json({ success: false, error: 'Só quem criou o lembrete pode alterá-lo' });
      return null;
    }
    return lembrete;
  }

  router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const lembrete = await carregarLembreteEditavel(req, res);
      if (!lembrete) return;

      const payload: Record<string, any> = {};
      if (req.body?.titulo !== undefined) payload.titulo = String(req.body.titulo).trim();
      if (req.body?.descricao !== undefined) payload.descricao = req.body.descricao ? String(req.body.descricao).trim() : null;
      if (req.body?.atribuido_para !== undefined) payload.atribuido_para = req.body.atribuido_para;

      const intervaloMinutos = req.body?.intervalo_minutos !== undefined ? (req.body.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null) : undefined;
      const horarioFixo = req.body?.horario_fixo !== undefined ? req.body.horario_fixo || null : undefined;

      // Se o intervalo/horário mudou, recalcula proxima_notificacao_em a
      // partir de AGORA — nunca do valor antigo (ver comentário na migration_042).
      if (intervaloMinutos !== undefined || horarioFixo !== undefined) {
        const novoIntervalo = intervaloMinutos !== undefined ? intervaloMinutos : null;
        const novoHorario = horarioFixo !== undefined ? horarioFixo : null;
        if (novoIntervalo == null && !novoHorario) {
          return res.status(400).json({ success: false, error: 'Escolha um intervalo de repetição ou um horário específico' });
        }
        if (novoIntervalo != null && novoHorario) {
          return res.status(400).json({ success: false, error: 'Escolha só um: repetir OU horário específico' });
        }
        if (novoIntervalo != null && (!Number.isFinite(novoIntervalo) || novoIntervalo < 5)) {
          return res.status(400).json({ success: false, error: 'Intervalo mínimo é 5 minutos' });
        }
        payload.intervalo_minutos = novoIntervalo;
        payload.proxima_notificacao_em = calcularProximaNotificacao(novoIntervalo, novoHorario);
      }

      const { data, error } = await supabase.from('lembretes').update(payload).eq('id', req.params.id).select(SELECT_COM_JOINS).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar lembrete:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/concluir', async (req: AuthenticatedRequest, res) => {
    try {
      const { data: lembrete, error: erroBusca } = await supabase.from('lembretes').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!lembrete) return res.status(404).json({ success: false, error: 'Lembrete não encontrado' });

      const podeConcluir = ehGerente(req.usuario) || lembrete.atribuido_para === req.usuario!.id;
      if (!podeConcluir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pelo lembrete pode concluí-lo' });
      }

      const { data, error } = await supabase
        .from('lembretes')
        .update({ status: 'concluido', concluido_em: new Date().toISOString(), proxima_notificacao_em: null })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao concluir lembrete:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Reabre sem reagendar automaticamente: um lembrete recorrente volta a
  // disparar a partir de agora; um de horário fixo que já tocou fica
  // pendente/visível mas silencioso (mesmo espírito de tarefa vencida) — se
  // quiser outro alerta, edita e escolhe um novo horário.
  router.patch('/:id/reabrir', async (req: AuthenticatedRequest, res) => {
    try {
      const { data: lembrete, error: erroBusca } = await supabase
        .from('lembretes')
        .select('id, atribuido_para, intervalo_minutos')
        .eq('id', req.params.id)
        .maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!lembrete) return res.status(404).json({ success: false, error: 'Lembrete não encontrado' });

      const podeReabrir = ehGerente(req.usuario) || lembrete.atribuido_para === req.usuario!.id;
      if (!podeReabrir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pelo lembrete pode reabri-lo' });
      }

      const proximaNotificacaoEm = lembrete.intervalo_minutos != null ? new Date(Date.now() + lembrete.intervalo_minutos * 60 * 1000).toISOString() : null;

      const { data, error } = await supabase
        .from('lembretes')
        .update({ status: 'pendente', concluido_em: null, proxima_notificacao_em: proximaNotificacaoEm })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao reabrir lembrete:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const lembrete = await carregarLembreteEditavel(req, res);
      if (!lembrete) return;

      const { error } = await supabase.from('lembretes').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir lembrete:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
