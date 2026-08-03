// Middleware de autenticação: valida o JWT emitido em POST /api/auth/login
// (login de admin por senha única, ver server.ts).
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { requireEnv } from '../src/server/env.js';

dotenv.config();

const JWT_SECRET = requireEnv('JWT_SECRET');

export interface UsuarioLogado {
  id: string;
  username: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  usuario?: UsuarioLogado;
}

// Endereços de loopback (a própria máquina). Usamos req.socket.remoteAddress
// (o endereço real da conexão TCP) em vez de req.ip — este último respeita o
// header X-Forwarded-For (por causa do `trust proxy` em server.ts) e poderia,
// em tese, ser forjado por quem está atrás do proxy. remoteAddress não dá
// pra falsificar sem literalmente estar rodando na mesma máquina do servidor.
const ENDERECOS_LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export function autenticar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Token real sempre tem prioridade sobre o bypass de loopback — assim, uma
  // vez logado localmente como um usuário específico, a API respeita esse
  // usuário/papel em vez de forçar admin. Sem isso, testar outra conta em
  // localhost era impossível: toda chamada de API voltava a virar admin.
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; roles?: string[]; role?: string };
      // Normaliza pra sempre virar array: tokens novos já trazem `roles`,
      // mas tokens antigos emitidos antes da migration_020 (válidos por até
      // 7 dias, ver expiresIn no login) ainda trazem só `role` singular —
      // sem isso todo mundo logado precisaria relogar no exato momento do
      // deploy dessa mudança.
      const roles = Array.isArray(decoded.roles) ? decoded.roles : decoded.role ? [decoded.role] : [];
      req.usuario = { id: decoded.id, username: decoded.username, roles };
      return next();
    } catch {
      return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
    }
  }

  // Sem token: acesso via localhost pula o login — conveniência de
  // desenvolvimento local. Nunca dispara em produção real: um servidor
  // exposto na internet nunca vê uma conexão com remoteAddress de loopback
  // vinda de fora da própria máquina.
  if (ENDERECOS_LOOPBACK.includes(req.socket.remoteAddress || '')) {
    req.usuario = { id: '00000000-0000-0000-0000-000000000000', username: 'localhost', roles: ['admin'] };
    return next();
  }

  return res.status(401).json({ success: false, error: 'Token ausente' });
}

// Gate por papel: usar depois de `autenticar` (precisa de req.usuario já
// preenchido). Ex.: router.post('/', autorizar('admin', 'equipe'), handler).
// Autorizado se QUALQUER um dos papéis do usuário está na lista permitida —
// um usuário pode ter vários papéis ao mesmo tempo (ver migration_020).
export function autorizar(...rolesPermitidas: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.usuario || !req.usuario.roles.some((r) => rolesPermitidas.includes(r))) {
      return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
    }
    next();
  };
}
