// Middleware de autenticação: valida o JWT emitido em POST /api/auth/login
// (login de admin por senha única, ver server.ts).
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { requireEnv } from '../src/server/env.js';
import { pode, type Permissoes } from '../src/constants/permissoes.js';

dotenv.config();

const JWT_SECRET = requireEnv('JWT_SECRET');

export interface UsuarioLogado {
  id: string;
  username: string;
  // `roles` continua existindo mas agora serve principalmente como marcador de
  // `admin` (super-usuário) — o acesso real das telas/ações vem de `permissoes`
  // (ver src/constants/permissoes.ts). Ver migration_047.
  roles: string[];
  permissoes: Permissoes;
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
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; roles?: string[]; role?: string; permissoes?: Permissoes };
      // Normaliza pra sempre virar array: tokens novos já trazem `roles`,
      // mas tokens antigos emitidos antes da migration_020 (válidos por até
      // 7 dias, ver expiresIn no login) ainda trazem só `role` singular —
      // sem isso todo mundo logado precisaria relogar no exato momento do
      // deploy dessa mudança.
      const roles = Array.isArray(decoded.roles) ? decoded.roles : decoded.role ? [decoded.role] : [];
      // Tokens emitidos antes da migration_047 não trazem `permissoes`. Nesse
      // caso derivamos do próprio comportamento antigo: admin continua super,
      // e um token sem permissoes cai em {} (sem acesso) — mas na prática esses
      // usuários ainda carregam os `roles` antigos, então o gate por permissão
      // ainda não estava em vigor pra eles até o deploy. O login novo já emite
      // `permissoes` no token (ver server.ts).
      const permissoes = decoded.permissoes && typeof decoded.permissoes === 'object' ? decoded.permissoes : {};
      req.usuario = { id: decoded.id, username: decoded.username, roles, permissoes };
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
    // Admin (super-usuário): permissoes vazio, mas `pode` sempre libera admin.
    req.usuario = { id: '00000000-0000-0000-0000-000000000000', username: 'localhost', roles: ['admin'], permissoes: {} };
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

// admin continua sendo super-usuário: identificado pelo papel 'admin' em
// `roles` (mantido de propósito na migration_047 justamente pra isso e pra
// proteção do último admin em usuarios.ts).
export function ehAdmin(usuario: UsuarioLogado | undefined): boolean {
  return !!usuario?.roles.includes('admin');
}

// Checagem de permissão pra usar dentro de uma rota (quando o gate não é o
// mesmo pra rota inteira) — mesma lógica de `pode`, já resolvendo admin.
export function temPermissao(usuario: UsuarioLogado | undefined, chave: string): boolean {
  if (!usuario) return false;
  return pode(usuario.permissoes, ehAdmin(usuario), chave);
}

// Gate por PERMISSÃO GRANULAR (substitui `autorizar` nas rotas de escrita):
// admin sempre passa; senão precisa da permissão `<tela>.<acao>` no mapa do
// usuário (e, por dependência, do `<tela>.ver` — ver `pode`). Usar depois de
// `autenticar`. Ex.: router.post('/', exigirPermissao('estoque.criar'), h).
export function exigirPermissao(chave: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!temPermissao(req.usuario, chave)) {
      return res.status(403).json({ success: false, error: 'Acesso negado: você não tem permissão para esta ação' });
    }
    next();
  };
}

// Igual a exigirPermissao, mas passa se o usuário tiver QUALQUER uma das
// chaves — pros casos em que a mesma rota serve mais de um fluxo (ex: o
// cadastro-rápido de moto do formulário de Estoque/Vendas, além de
// Configurações; ou os endpoints de categoria do ML usados tanto pra ver o ML
// quanto pra anunciar uma peça).
export function exigirAlguma(...chaves: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!chaves.some((chave) => temPermissao(req.usuario, chave))) {
      return res.status(403).json({ success: false, error: 'Acesso negado: você não tem permissão para esta ação' });
    }
    next();
  };
}
