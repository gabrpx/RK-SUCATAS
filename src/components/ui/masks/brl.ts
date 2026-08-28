export function formatBrl(cents: number): string {
  const reais = cents / 100;
  return reais
    .toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/ /g, ' '); // Intl full-ICU usa NBSP entre "R$" e o valor
}

export function parseBrl(input: string): number {
  if (!input) return 0;
  let s = input.replace(/[^\d,.]/g, '');
  // se tem vírgula e ponto, ponto é separador de milhar; vírgula é decimal
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}
