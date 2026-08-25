// Fonte única do tipo Role é src/constants/roles.ts — reexportado aqui pra
// não duplicar a lista de cargos (já dessincronizou uma vez).
import type { Role } from '../../constants/roles';
import type { Permissoes } from '../../constants/permissoes';
export type { Role };

export interface Usuario {
  id: string;
  username: string;
  nome_exibicao: string;
  // Depois do sistema de permissões granulares, `roles` só distingue quem é
  // ADMIN (super-usuário, ignora o mapa de permissões e é o único que gere
  // usuários) de quem não é — todo o resto do acesso vem de `permissoes`.
  roles: Role[];
  // { "<tela>": { "<acao>": true } } — ver src/constants/permissoes.ts.
  permissoes: Permissoes;
  ativo: boolean;
  criado_em: string;
}

export interface UsuarioInput {
  username: string;
  nome_exibicao: string;
  password: string;
  roles: Role[];
  permissoes: Permissoes;
}

export interface UsuarioUpdateInput {
  username?: string;
  nome_exibicao?: string;
  roles?: Role[];
  permissoes?: Permissoes;
  ativo?: boolean;
}
