// Upload de foto por modelo de moto — mesma rota genérica usada pelas peças
// (src/features/estoque/api.ts), sem bucket/rota dedicados.
import { BASE_URL } from '../../utils/api';

export async function uploadImagemModeloMoto(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('imagem', file);

  const response = await fetch(`${BASE_URL}/api/upload/imagem`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  return response.json();
}
