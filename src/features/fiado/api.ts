import { api } from '../../utils/api';
import type { FiadoRecebimento, FiadoRecebimentoInput } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const fiadoApi = {
  listarRecebimentos: (): Promise<ApiResult<FiadoRecebimento[]>> => api.get('/api/fiado/recebimentos'),
  registrarRecebimento: (payload: FiadoRecebimentoInput): Promise<ApiResult<FiadoRecebimento>> => api.post('/api/fiado/recebimentos', payload),
  removerRecebimento: (id: string): Promise<ApiResult<null>> => api.delete(`/api/fiado/recebimentos/${id}`),
};
