// Máscaras de formatação progressiva (aplicadas em onChange, sem libs externas).
// Telefone e documento guardam só dígitos no banco — a máscara é puramente de exibição/digitação.

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

export function formatTelefoneBR(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  const len = digits.length;
  if (len === 0) return '';
  if (len <= 2) return `(${digits}`;
  if (len <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Documento cobre CPF (11 dígitos) e CNPJ (14 dígitos) — o campo do cliente é "CPF/CNPJ".
export function formatDocumentoBR(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  const len = digits.length;
  if (len <= 11) {
    let out = digits.slice(0, 3);
    if (len > 3) out += '.' + digits.slice(3, 6);
    if (len > 6) out += '.' + digits.slice(6, 9);
    if (len > 9) out += '-' + digits.slice(9, 11);
    return out;
  }
  let out = digits.slice(0, 2);
  out += '.' + digits.slice(2, 5);
  if (len > 5) out += '.' + digits.slice(5, 8);
  if (len > 8) out += '/' + digits.slice(8, 12);
  if (len > 12) out += '-' + digits.slice(12, 14);
  return out;
}

// Máscara de moeda estilo "digitar centavos": os dígitos preenchem da direita
// pra esquerda, ex. digitar "1234" vira "R$ 12,34". Padrão comum em inputs BR.
export function formatCurrencyInput(rawValue: string): string {
  const digits = onlyDigits(rawValue).replace(/^0+(?=\d)/, '');
  const cents = digits.padStart(3, '0');
  const reais = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = cents.slice(-2);
  return `R$ ${reais},${centavos}`;
}

export function parseCurrencyInput(rawValue: string): number {
  const digits = onlyDigits(rawValue);
  if (!digits) return 0;
  return Number(digits) / 100;
}
