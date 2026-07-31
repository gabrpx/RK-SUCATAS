// Traduz o erro de violação de FK do Postgres (código 23503) numa mensagem
// legível, em vez de deixar vazar o texto técnico do banco pro usuário.
export function mensagemErroExclusao(error: any, usadoEm: string): string {
  if (error?.code === '23503') {
    return `Não é possível excluir: ainda existe(m) ${usadoEm} usando este item.`;
  }
  return error?.message || 'Erro ao excluir';
}
