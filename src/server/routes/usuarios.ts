// Gestão de usuários — rota inteira montada com autorizar('admin') em
// server.ts (só o Ayrton mexe aqui). Subscriptions de push de cada usuário
// ficam à parte, em src/server/routes/notificacoes.ts.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { ALL_ROLES } from '../../constants/roles.js';

const SELECT_SEM_SENHA = 'id, username, nome_exibicao, roles, ativo, criado_em';

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
      const roles = req.body?.roles;

      if (!username || !nomeExibicao || !password) {
        return res.status(400).json({ success: false, error: 'Usuário, nome e senha são obrigatórios' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Senha precisa ter pelo menos 6 caracteres' });
      }
      if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r: unknown) => ALL_ROLES.includes(r as any))) {
        return res.status(400).json({ success: false, error: 'Selecione pelo menos um papel válido' });
      }

      const senha_hash = bcrypt.hashSync(password, 10);
      const { data, error } = await supabase
        .from('usuarios')
        .insert({ username, nome_exibicao: nomeExibicao, senha_hash, roles })
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
      if (req.body?.username !== undefined) {
        const username = String(req.body.username).trim().toLowerCase();
        if (!username) return res.status(400).json({ success: false, error: 'Usuário não pode ficar em branco' });
        payload.username = username;
      }
      if (req.body?.nome_exibicao !== undefined) payload.nome_exibicao = String(req.body.nome_exibicao).trim();
      if (req.body?.roles !== undefined) {
        const roles = req.body.roles;
        if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r: unknown) => ALL_ROLES.includes(r as any))) {
          return res.status(400).json({ success: false, error: 'Selecione pelo menos um papel válido' });
        }
        payload.roles = roles;
      }
      if (req.body?.ativo !== undefined) payload.ativo = Boolean(req.body.ativo);

      const { data: atual, error: erroAtual } = await supabase.from('usuarios').select('id, roles, ativo').eq('id', req.params.id).maybeSingle();
      if (erroAtual) throw erroAtual;
      if (!atual) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

      const vaiDesativar = payload.ativo === false;
      const vaiTirarDeAdmin = payload.roles !== undefined && !payload.roles.includes('admin');

      const alvoEhEuMesmo = req.usuario?.id === req.params.id;
      if (alvoEhEuMesmo && (vaiDesativar || vaiTirarDeAdmin)) {
        return res.status(400).json({ success: false, error: 'Não é possível remover seu próprio acesso de administrador' });
      }

      // Além de não poder se auto-rebaixar (checagem acima), ninguém pode
      // deixar o sistema sem NENHUM admin ativo, mesmo mexendo na conta de
      // outra pessoa — senão perde-se o acesso pra gerenciar usuários.
      if (atual.roles.includes('admin') && atual.ativo && (vaiDesativar || vaiTirarDeAdmin)) {
        const { count, error: erroContagem } = await supabase
          .from('usuarios')
          .select('id', { count: 'exact', head: true })
          .contains('roles', ['admin'])
          .eq('ativo', true)
          .neq('id', req.params.id);
        if (erroContagem) throw erroContagem;
        if (!count) {
          return res.status(400).json({ success: false, error: 'Não é possível remover o último administrador ativo do sistema' });
        }
      }

      const { data, error } = await supabase.from('usuarios').update(payload).eq('id', req.params.id).select(SELECT_SEM_SENHA).single();
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'Já existe um usuário com esse username' });
        }
        throw error;
      }
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
