// Gestão de usuários — rota inteira montada com autorizar('admin') em
// server.ts (só o Ayrton mexe aqui), exceto /me/push-token que é montada
// separadamente antes desse gate (todo usuário registra o próprio token).
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { ALL_ROLES } from '../../constants/roles.js';

const SELECT_SEM_SENHA = 'id, username, nome_exibicao, role, ativo, criado_em';

export function usuariosRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('usuarios').select(SELECT_SEM_SENHA).order('nome_exibicao');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const nomeExibicao = String(req.body?.nome_exibicao || '').trim();
      const password = String(req.body?.password || '');
      const role = req.body?.role;

      if (!username || !nomeExibicao || !password) {
        return res.status(400).json({ success: false, error: 'Usuário, nome e senha são obrigatórios' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Senha precisa ter pelo menos 6 caracteres' });
      }
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: 'Papel inválido' });
      }

      const senha_hash = bcrypt.hashSync(password, 10);
      const { data, error } = await supabase
        .from('usuarios')
        .insert({ username, nome_exibicao: nomeExibicao, senha_hash, role })
        .select(SELECT_SEM_SENHA)
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'Já existe um usuário com esse username' });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const payload: Record<string, any> = {};
      if (req.body?.nome_exibicao !== undefined) payload.nome_exibicao = String(req.body.nome_exibicao).trim();
      if (req.body?.role !== undefined) {
        if (!ALL_ROLES.includes(req.body.role)) return res.status(400).json({ success: false, error: 'Papel inválido' });
        payload.role = req.body.role;
      }
      if (req.body?.ativo !== undefined) payload.ativo = Boolean(req.body.ativo);

      const alvoEhEuMesmo = req.usuario?.id === req.params.id;
      if (alvoEhEuMesmo && (payload.ativo === false || (payload.role !== undefined && payload.role !== 'admin'))) {
        return res.status(400).json({ success: false, error: 'Não é possível remover seu próprio acesso de administrador' });
      }

      const { data, error } = await supabase.from('usuarios').update(payload).eq('id', req.params.id).select(SELECT_SEM_SENHA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/reset-password', async (req, res) => {
    try {
      const password = String(req.body?.password || '');
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Senha precisa ter pelo menos 6 caracteres' });
      }
      const senha_hash = bcrypt.hashSync(password, 10);
      const { error } = await supabase.from('usuarios').update({ senha_hash }).eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
