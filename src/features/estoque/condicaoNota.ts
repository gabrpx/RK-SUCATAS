// Tom semântico da nota de condição (1-10): mesma faixa de 3 níveis já usada
// pro indicador de quantidade (ver coluna Qtd em EstoqueView.tsx) — baixo
// nunca é decorativo aqui, é literal "estado ruim, precisa avisar o cliente".
export function tomCondicaoNota(nota: number): 'danger' | 'warning' | 'positive' {
  if (nota <= 3) return 'danger';
  if (nota <= 6) return 'warning';
  return 'positive';
}
