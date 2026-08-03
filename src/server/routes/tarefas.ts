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

const SELECT_COM_JOINS = '*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao)';

const CAMPOS_EDITAVEIS = ['titulo', 'descricao', 'prazo', 'atribuido_para'] as const;

const ERRO_RESPONSAVEL_INVALIDO = 'Responsável precisa ser um usuário ativo com papel "mandados" ou "mecanico"';

function responsavelValido(responsavel: { role: string; ativo: boolean } | null): boolean {
  return !!responsavel && EXECUTORES_TAREFA.includes(responsavel.role as Role) && responsavel.ativo;
}

export function tarefasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      const role = req.usuario?.role;
      if (role === 'estoque_leitura') {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      let query = supabase.from('tarefas').select(SELECT_COM_JOINS).order('status', { ascending: true }).order('prazo', { ascending: true, nullsFirst: false });

      if (EXECUTORES_TAREFA.includes(role as Role)) {
        query = query.eq('atribuido_para', req.usuario!.id);
      } else {
        if (req.query.status) query = query.eq('status', String(req.query.status));
        if (req.query.atribuido_para) query = query.eq('atribuido_para', String(req.query.atribuido_para));
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
      const role = req.usuario?.role;
      if (role !== 'admin' && role !== 'equipe') {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      const titulo = String(req.body?.titulo || '').trim();
      const atribuido_para = req.body?.atribuido_para;
      if (!titulo) return res.status(400).json({ success: false, error: 'Título é obrigatório' });
      if (!atribuido_para) return res.status(400).json({ success: false, error: 'Responsável é obrigatório' });

      const { data: responsavel, error: erroResponsavel } = await supabase.from('usuarios').select('id, role, ativo').eq('id', atribuido_para).maybeSingle();
      if (erroResponsavel) throw erroResponsavel;
      if (!responsavelValido(responsavel)) {
        return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
      }

      const payload = {
        titulo,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        prazo: req.body?.prazo || null,
        atribuido_para,
        criado_por: req.usuario!.id,
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
    const role = req.usuario?.role;
    if (role !== 'admin' && role !== 'equipe') {
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
    if (role === 'equipe' && tarefa.criado_por !== req.usuario!.id) {
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
        const { data: responsavel } = await supabase.from('usuarios').select('id, role, ativo').eq('id', payload.atribuido_para).maybeSingle();
        if (!responsavelValido(responsavel)) {
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
      const role = req.usuario?.role;
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeConcluir = role === 'admin' || role === 'equipe' || (EXECUTORES_TAREFA.includes(role as Role) && tarefa.atribuido_para === req.usuario!.id);
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
      const role = req.usuario?.role;
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeReabrir = role === 'admin' || role === 'equipe' || (EXECUTORES_TAREFA.includes(role as Role) && tarefa.atribuido_para === req.usuario!.id);
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
