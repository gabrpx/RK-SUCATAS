import { api } from '../../utils/api';
import type { FiadoBaixa, FiadoBaixaInput } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const fiadoApi = {
  listarBaixas: (): Promise<ApiResult<FiadoBaixa[]>> => api.get('/api/fiado/baixas'),
  registrarBaixa: (payload: FiadoBaixaInput): Promise<ApiResult<FiadoBaixa>> => api.post('/api/fiado/baixas', payload),
  removerBaixa: (id: string): Promise<ApiResult<null>> => api.delete(`/api/fiado/baixas/${id}`),
};
