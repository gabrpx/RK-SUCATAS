import { Capacitor } from '@capacitor/core';

const PROD_URL = 'https://rk-sucatas.onrender.com';
export const BASE_URL = Capacitor.isNativePlatform() ? PROD_URL : '';

const REQUEST_TIMEOUT_MS = 15 * 1000;

export async function fetchWithRetry(url: string, options: any = {}, retries = 3) {
  const absoluteUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  for (let i = 0; i < retries; i++) {
    const timeoutController = new AbortController();
    // Conexão de celular às vezes trava a requisição sem nunca dar erro nem
    // resposta — sem isso o app fica esperando pra sempre em vez de tentar de novo.
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(absoluteUrl, { ...options, headers, signal: options.signal ?? timeoutController.signal });
      clearTimeout(timeoutId);

      if (response.status === 401 && !url.includes('/login')) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Sessão expirada');
      }

      // Erro do lado do servidor (cold start, instabilidade) merece retentativa
      // igual a uma falha de rede — só erro do cliente (400/403/404...) é definitivo.
      if (response.status >= 500 && i < retries - 1) {
        await new Promise(res => setTimeout(res, 1000 * (i + 1)));
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, 1000 * (i + 1)));
    }
  }
  throw new Error('Falha após retentativas');
}

export async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Resposta inválida (não JSON):', text.substring(0, 200));
    throw new Error('O servidor retornou uma resposta inválida. Verifique a conexão com a internet ou se o servidor está online.');
  }
}

async function request(url: string, options: any = {}) {
  const response = await fetchWithRetry(url, options);
  return parseJson(response);
}

export const api = {
  get: (url: string) => request(url, { method: 'GET' }),
  post: (url: string, data?: any) => request(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url: string, data?: any) => request(url, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (url: string, data?: any) => request(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (url: string) => request(url, { method: 'DELETE' }),
};

export default api;
