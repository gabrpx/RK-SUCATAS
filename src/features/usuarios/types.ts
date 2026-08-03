// Fonte única do tipo Role é src/constants/roles.ts — reexportado aqui pra
// não duplicar a lista de cargos (já dessincronizou uma vez).
import type { Role } from '../../constants/roles';
export type { Role };

export interface Usuario {
  id: string;
  username: string;
  nome_exibicao: string;
  // Um usuário pode ter vários papéis ao mesmo tempo (ex: estoque_leitura +
  // mandados, pra ver o estoque E receber tarefas) — ver migration_020.
  roles: Role[];
  ativo: boolean;
  criado_em: string;
}

export interface UsuarioInput {
  username: string;
  nome_exibicao: string;
  password: string;
  roles: Role[];
}

export interface UsuarioUpdateInput {
  username?: string;
  nome_exibicao?: string;
  roles?: Role[];
  ativo?: boolean;
}
