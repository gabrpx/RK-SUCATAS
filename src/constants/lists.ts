// Formas de pagamento aceitas. Lista fixa e pequena — ao contrário de categoria
// e modelo de moto, não tem motivo pra virar tabela do Supabase.
export const pagamentosList = [
  'CRÉDITO',
  'DÉBITO',
  'DINHEIRO',
  'MARCELO',
  'PENDÊNCIA',
  'PIX',
].sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));
