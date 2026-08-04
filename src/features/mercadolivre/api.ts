// Chamadas HTTP do módulo Mercado Livre. Fino de propósito: cada função
// mapeia 1:1 pra uma rota do backend (src/server/routes/mercadolivre.ts).
import { api } from '../../utils/api';

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MercadoLivreStatus {
  success: boolean;
  conectado: boolean;
  ml_user_id: string | null;
}

// Só os campos que a tela de "dados da página" usa — a resposta real de
// /users/me do Mercado Livre é bem maior que isso.
export interface MercadoLivreConta {
  id: number;
  nickname: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  permalink?: string;
  points?: number;
  seller_reputation?: {
    level_id: string | null;
    power_seller_status: string | null;
    transactions?: {
      completed: number;
      canceled: number;
      ratings?: { positive: number; negative: number; neutral: number };
    };
  };
}

export const mercadolivreApi = {
  status: () => api.get('/api/mercadolivre/status') as Promise<MercadoLivreStatus>,
  iniciarLogin: () => api.get('/api/mercadolivre/auth/login') as Promise<ApiResult<never> & { url: string }>,
  dadosConta: () => api.get('/api/mercadolivre/me') as Promise<ApiResult<MercadoLivreConta>>,
  desconectar: () => api.delete('/api/mercadolivre/desconectar') as Promise<ApiResult<null>>,
};
