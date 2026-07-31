// Chamada HTTP do módulo de Frete — proxy fino pro backend, que por sua vez
// fala com a API do Melhor Envio (o token secreto nunca sai do servidor).
import { fetchWithRetry, parseJson } from '../../lib/apiClient';

export interface FreteQuote {
  company?: { name?: string };
  name?: string;
  price?: string | number;
  delivery_time?: string | number;
  error?: string;
}

interface CalcularFretePayload {
  cep_origem: string;
  cep_destino: string;
  peso: string;
  largura: string;
  altura: string;
  comprimento: string;
}

export async function calcularFrete(payload: CalcularFretePayload): Promise<FreteQuote[]> {
  const response = await fetchWithRetry('/api/frete/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  return data.data || [];
}

export async function buscarCidadePorCep(cep: string): Promise<string> {
  try {
    const response = await fetchWithRetry(`https://viacep.com.br/ws/${cep.replace('-', '')}/json/`);
    const data = await parseJson(response);
    return data.localidade || '';
  } catch (error) {
    console.error('Erro ao buscar cidade:', error);
    return '';
  }
}
