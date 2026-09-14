import { api, BASE_URL } from '../../utils/api';
import type { ComprovantePix } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const comprovantesApi = {
  listarPorVenda: (vendaId: string): Promise<ApiResult<ComprovantePix[]>> => api.get(`/api/vendas/${vendaId}/comprovantes`),
  remover: (vendaId: string, comprovanteId: string): Promise<ApiResult<null>> =>
    api.delete(`/api/vendas/${vendaId}/comprovantes/${comprovanteId}`),
};

// Upload é multipart (passo 1, arquivo cru) + registro do vínculo com a
// venda (passo 2, JSON) — mesmo padrão em duas etapas de uploadImagemEstoque
// + PATCH em src/features/estoque/UnidadesEstoque.tsx, só que aqui o passo 2
// já é o registro definitivo (não um form intermediário).
export async function anexarComprovantePix(vendaId: string, file: File): Promise<ApiResult<ComprovantePix>> {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('arquivo', file);

  const respostaUpload = await fetch(`${BASE_URL}/api/upload/comprovante`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  const upload = await respostaUpload.json();
  if (!upload.success) return upload;

  return api.post(`/api/vendas/${vendaId}/comprovantes`, {
    storage_path: upload.storage_path,
    nome_arquivo: upload.nome_arquivo,
    tipo_mime: upload.tipo_mime,
    tamanho_bytes: upload.tamanho_bytes,
  });
}
