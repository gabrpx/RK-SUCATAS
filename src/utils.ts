import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// parseLocalDate: converte string de data (YYYY-MM-DD ou ISO) para Date local
// evita bug de timezone onde "2025-01-23" é interpretado como UTC no JS
export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date(0);
  // Extrai ano, mês, dia de qualquer formato (YYYY-MM-DD, ISO com T, com timezone, etc.)
  // Isso garante que a data seja sempre interpretada como local, sem shift de fuso
  const match = String(dateString).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    return new Date(y, m - 1, d);
  }
  // Fallback para parser nativo se não encontrar padrão YYYY-MM-DD
  return new Date(dateString);
}

export function formatDateRelative(dateString: string) {
  const date = parseLocalDate(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  let relative = '';
  if (diffDays === 0) relative = 'hoje';
  else if (diffDays === 1) relative = 'ontem';
  else relative = `${diffDays} dias atrás`;

  return `${formattedDate} (${relative})`;
}
