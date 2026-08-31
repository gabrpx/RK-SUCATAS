export function stripPhone(masked: string): string {
  return masked.replace(/\D/g, '').slice(0, 11);
}

export function formatPhoneBr(input: string): string {
  const d = stripPhone(input);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length === 3) return `(${d.slice(0, 2)}) ${d[2]}`;
  if (d.length <= 6 && d.length > 3) {
    // celular parcial após o "9"
    return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3)}`;
  }
  if (d.length <= 10) {
    // fixo (10 dígitos) ou celular ainda incompleto
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    // celular parcial (7-9 dígitos totais)
    return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}${d.length > 7 ? `-${d.slice(7)}` : ''}`;
  }
  // celular completo 11 dígitos
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7, 11)}`;
}
