// Chamadas HTTP do módulo Mercado Livre. Fino de propósito: cada função
// mapeia 1:1 pra uma rota do backend (src/server/routes/mercadolivre.ts).
import { api } from '../../utils/api';
import type {
  PedidoPreview,
  ImportarPedidoItemInput,
  ImportarPedidosResultado,
  ResultadoSincronizacao,
  ResultadoReconciliacao,
  PerguntaPreview,
  AnuncioOrfaoML,
  EnvioML,
  ContagemPendencias,
} from './types';

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

// Uma métrica de reputação do Mercado Livre: taxa (0–1) já ajustada pro
// cálculo oficial do nível da conta (`rate`/`value`), mais o número bruto
// sem ajuste em `excluded` (casos descontados por não contarem contra o
// vendedor — ex: reclamação resolvida a favor da loja).
interface MetricaReputacao {
  period: string;
  rate: number;
  value: number;
  excluded?: { real_rate: number; real_value: number };
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
      total?: number;
      ratings?: { positive: number; negative: number; neutral: number };
    };
    // Janela móvel (ex: "365 days") — o que o Mercado Livre realmente usa
    // pra calcular o nível do vendedor, diferente do histórico total em
    // `transactions`.
    metrics?: {
      claims?: MetricaReputacao;
      delayed_handling_time?: MetricaReputacao;
      cancellations?: MetricaReputacao;
      sales?: { period: string; completed: number };
    };
  };
}

export const mercadolivreApi = {
  status: () => api.get('/api/mercadolivre/status') as Promise<MercadoLivreStatus>,
  iniciarLogin: () => api.get('/api/mercadolivre/auth/login') as Promise<ApiResult<never> & { url: string }>,
  dadosConta: () => api.get('/api/mercadolivre/me') as Promise<ApiResult<MercadoLivreConta>>,
  desconectar: () => api.delete('/api/mercadolivre/desconectar') as Promise<ApiResult<null>>,

  // Features 1 + 7 — reconciliação manual (preço, quantidade, status), nunca automática.
  sincronizarAnuncio: (estoqueId: string) => api.post(`/api/mercadolivre/anuncios/${estoqueId}/sincronizar`) as Promise<ApiResult<ResultadoSincronizacao>>,
  sincronizarCatalogo: () => api.post('/api/mercadolivre/anuncios/sincronizar') as Promise<ApiResult<ResultadoReconciliacao>>,

  // Feature 2 — preview e importação de pedidos como venda.
  buscarPedidosNovos: (dias = 30) => api.get(`/api/mercadolivre/pedidos/novos?dias=${dias}`) as Promise<ApiResult<PedidoPreview[]>>,
  importarPedidos: (itens: ImportarPedidoItemInput[]) => api.post('/api/mercadolivre/pedidos/importar', { itens }) as Promise<ApiResult<ImportarPedidosResultado>>,

  // Feature 10 — envio (Mercado Envios) de um pedido já importado.
  buscarEnvioPedido: (mlOrderId: string) => api.get(`/api/mercadolivre/pedidos/${mlOrderId}/envio`) as Promise<ApiResult<EnvioML | null>>,

  // Feature 3 — central de perguntas.
  buscarPerguntas: () => api.get('/api/mercadolivre/perguntas') as Promise<ApiResult<PerguntaPreview[]>>,
  responderPergunta: (questionId: number, texto: string) => api.post(`/api/mercadolivre/perguntas/${questionId}/responder`, { texto }) as Promise<ApiResult<null>>,

  // Feature 6 — anúncios ativos no ML sem peça local correspondente.
  buscarAnunciosOrfaos: () => api.get('/api/mercadolivre/anuncios-orfaos') as Promise<ApiResult<AnuncioOrfaoML[]>>,

  // Feature 9 — indicador ao vivo de pendências.
  buscarPendencias: () => api.get('/api/mercadolivre/pendencias') as Promise<ApiResult<ContagemPendencias>>,
};
