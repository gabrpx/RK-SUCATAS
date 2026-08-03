// Fonte única do tipo Role é src/constants/roles.ts — reexportado aqui pra
// não duplicar a lista de cargos (já dessincronizou uma vez).
import type { Role } from '../../constants/roles';
export type { Role };

export interface Usuario {
  id: string;
  username: string;
  nome_exibicao: string;
  role: Role;
  ativo: boolean;
  criado_em: string;
}

export interface UsuarioInput {
  username: string;
  nome_exibicao: string;
  password: string;
  role: Role;
}

export interface UsuarioUpdateInput {
  nome_exibicao?: string;
  role?: Role;
  ativo?: boolean;
}
