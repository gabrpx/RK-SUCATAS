import { api } from '../../utils/api';
import type { Usuario, UsuarioInput, UsuarioUpdateInput } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const usuariosApi = {
  listar: (): Promise<ApiResult<Usuario[]>> => api.get('/api/usuarios'),
  criar: (payload: UsuarioInput): Promise<ApiResult<Usuario>> => api.post('/api/usuarios', payload),
  atualizar: (id: string, payload: UsuarioUpdateInput): Promise<ApiResult<Usuario>> => api.patch(`/api/usuarios/${id}`, payload),
  redefinirSenha: (id: string, password: string): Promise<ApiResult<null>> => api.post(`/api/usuarios/${id}/reset-password`, { password }),
  excluir: (id: string): Promise<ApiResult<null>> => api.delete(`/api/usuarios/${id}`),
};
