const HANDLE_INSTAGRAM = /^[a-z0-9._]{1,30}$/;
const HOSTS_INSTAGRAM = new Set(['instagram.com', 'www.instagram.com']);

export function normalizarInstagram(valor: string | null | undefined): string {
  const entrada = (valor ?? '').trim();
  if (!entrada) return '';

  let candidato = entrada;
  if (/^https?:\/\//i.test(entrada)) {
    try {
      const url = new URL(entrada);
      if (!HOSTS_INSTAGRAM.has(url.hostname.toLowerCase())) return '';
      const partes = url.pathname.split('/').filter(Boolean);
      if (partes.length !== 1) return '';
      candidato = decodeURIComponent(partes[0]);
    } catch {
      return '';
    }
  }

  const handle = candidato.replace(/^@+/, '').trim().toLowerCase();
  return HANDLE_INSTAGRAM.test(handle) ? handle : '';
}

export function linkInstagram(valor: string | null | undefined): string | null {
  const handle = normalizarInstagram(valor);
  return handle ? `https://www.instagram.com/${handle}/` : null;
}
