// Tarefas: admin/equipe criam e atribuem, só quem tem um cargo "executor"
// (EXECUTORES_TAREFA — mandados/mecanico) dá baixa na própria, atribuída a
// ele. Montada em server.ts SEM autorizar() no mount porque o comportamento
// varia por papel dentro de cada rota, não é um simples permitido/negado por
// rota inteira.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { EXECUTORES_TAREFA } from '../../constants/roles.js';
import type { Role } from '../../constants/roles.js';

const SELECT_COM_JOINS = '*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao), cliente:clientes(id, nome, telefone)';

const CAMPOS_EDITAVEIS = ['titulo', 'descricao', 'prazo', 'atribuido_para', 'cliente_id', 'prioridade', 'tipo'] as const;

const ERRO_RESPONSAVEL_INVALIDO = 'Responsável precisa ser um usuário ativo com papel "mandados" ou "mecanico" (ou você mesmo)';

const PRIORIDADES_VALIDAS = ['baixa', 'media', 'alta'] as const;
const TIPOS_VALIDOS = ['geral', 'visita'] as const;

// Admin/equipe pode se autoatribuir uma tarefa (ex: lembrete pessoal) mesmo
// sem ter papel executor — só quem NÃO é o próprio usuário logado precisa
// necessariamente ser mandados/mecanico.
function responsavelValido(responsavel: { roles: string[]; ativo: boolean } | null, souEuMesmo: boolean): boolean {
  if (!responsavel || !responsavel.ativo) return false;
  if (souEuMesmo) return true;
  return responsavel.roles.some((r) => EXECUTORES_TAREFA.includes(r as Role));
}

// Um usuário pode ter vários papéis ao mesmo tempo (ver migration_020) — as
// duas checagens abaixo testam se QUALQUER papel do usuário se encaixa,
// não mais um `role === 'x'` de string única.
function ehAdminOuEquipe(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('equipe');
}
function ehExecutor(roles: string[]): boolean {
  return roles.some((r) => EXECUTORES_TAREFA.includes(r as Role));
}

export function tarefasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const roles = req.usuario?.roles ?? [];
      if (!ehAdminOuEquipe(roles) && !ehExecutor(roles)) {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      let query = supabase.from('tarefas').select(SELECT_COM_JOINS).order('status', { ascending: true }).order('prazo', { ascending: true, nullsFirst: false });

      // Quem tem QUALQUER papel executor (mandados/mecanico) só vê as
      // próprias, mesmo que também tenha admin/equipe — ver estoque_leitura
      // + mandados combinados: continua enxergando só as tarefas dele aqui.
      if (ehExecutor(roles) && !ehAdminOuEquipe(roles)) {
        query = query.eq('atribuido_para', req.usuario!.id);
      } else {
        if (req.query.status) query = query.eq('status', String(req.query.status));
        if (req.query.atribuido_para) query = query.eq('atribuido_para', String(req.query.atribuido_para));
        if (req.query.cliente_id) query = query.eq('cliente_id', String(req.query.cliente_id));
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar tarefas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      const roles = req.usuario?.roles ?? [];
      if (!ehAdminOuEquipe(roles)) {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      const titulo = String(req.body?.titulo || '').trim();
      const atribuido_para = req.body?.atribuido_para;
      if (!titulo) return res.status(400).json({ success: false, error: 'Título é obrigatório' });
      if (!atribuido_para) return res.status(400).json({ success: false, error: 'Responsável é obrigatório' });

      const prioridade = req.body?.prioridade || 'media';
      if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
        return res.status(400).json({ success: false, error: 'Prioridade inválida' });
      }
      const tipo = req.body?.tipo || 'geral';
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo de tarefa inválido' });
      }

      const { data: responsavel, error: erroResponsavel } = await supabase.from('usuarios').select('id, roles, ativo').eq('id', atribuido_para).maybeSingle();
      if (erroResponsavel) throw erroResponsavel;
      if (!responsavelValido(responsavel, atribuido_para === req.usuario!.id)) {
        return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
      }

      const payload = {
        titulo,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        prazo: req.body?.prazo || null,
        atribuido_para,
        criado_por: req.usuario!.id,
        cliente_id: req.body?.cliente_id || null,
        prioridade,
        tipo,
      };

      const { data, error } = await supabase.from('tarefas').insert(payload).select(SELECT_COM_JOINS).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Confirma que o usuário logado pode mexer nesta tarefa (dono = criador, ou
  // admin mexe em qualquer uma). Retorna a tarefa atual ou já responde o erro.
  async function carregarTarefaEditavel(req: AuthenticatedRequest, res: any) {
    const roles = req.usuario?.roles ?? [];
    if (!ehAdminOuEquipe(roles)) {
      res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      return null;
    }
    const { data: tarefa, error } = await supabase.from('tarefas').select('id, criado_por').eq('id', req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return null;
    }
    if (!tarefa) {
      res.status(404).json({ success: false, error: 'Tarefa não encontrada' });
      return null;
    }
    // Admin mexe em qualquer tarefa; quem só tem equipe (sem admin) só mexe
    // nas que criou.
    if (!roles.includes('admin') && tarefa.criado_por !== req.usuario!.id) {
      res.status(403).json({ success: false, error: 'Só quem criou a tarefa pode alterá-la' });
      return null;
    }
    return tarefa;
  }

  router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res);
      if (!tarefa) return;

      const payload: Record<string, any> = {};
      for (const campo of CAMPOS_EDITAVEIS) {
        if (req.body?.[campo] !== undefined) payload[campo] = req.body[campo];
      }

      if (payload.atribuido_para !== undefined) {
        const { data: responsavel } = await supabase.from('usuarios').select('id, roles, ativo').eq('id', payload.atribuido_para).maybeSingle();
        if (!responsavelValido(responsavel, payload.atribuido_para === req.usuario!.id)) {
          return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
        }
      }

      const { data, error } = await supabase.from('tarefas').update(payload).eq('id', req.params.id).select(SELECT_COM_JOINS).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/concluir', async (req: AuthenticatedRequest, res) => {
    try {
      const roles = req.usuario?.roles ?? [];
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeConcluir = ehAdminOuEquipe(roles) || (ehExecutor(roles) && tarefa.atribuido_para === req.usuario!.id);
      if (!podeConcluir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode dar baixa' });
      }

      const { data, error } = await supabase
        .from('tarefas')
        .update({ status: 'concluida', concluida_em: new Date().toISOString() })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao concluir tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Reverte uma conclusão feita sem querer — mesma regra de quem pode
  // concluir (admin/equipe de qualquer tarefa, ou o próprio executor
  // atribuído), já que reabrir é só o inverso da mesma ação.
  router.patch('/:id/reabrir', async (req: AuthenticatedRequest, res) => {
    try {
      const roles = req.usuario?.roles ?? [];
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeReabrir = ehAdminOuEquipe(roles) || (ehExecutor(roles) && tarefa.atribuido_para === req.usuario!.id);
      if (!podeReabrir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode reabri-la' });
      }

      const { data, error } = await supabase
        .from('tarefas')
        .update({ status: 'pendente', concluida_em: null })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao reabrir tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res);
      if (!tarefa) return;

      const { error } = await supabase.from('tarefas').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
