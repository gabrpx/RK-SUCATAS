// Resumo do que foi cadastrado hoje. Serve de conferência durante a
// catalogação em massa: dá pra bater o total contra o valor esperado do
// estoque no fim do dia e, principalmente, perceber na hora um zero a mais
// digitado no valor — não semanas depois.
import { valorTotalItem } from './valorEstoque';
import type { Estoque } from './types';

export interface ResumoDoDia {
  itens: number;
  /** Soma de valor × quantidade das peças cadastradas hoje */
  valorTotal: number;
  /** Peças cadastradas hoje que ficaram sem preço (valor 0) */
  semValor: number;
}

// Compara em horário local (não UTC): "hoje" é o dia da loja, e um cadastro
// das 21h no Brasil já seria "amanhã" em UTC.
function ehHoje(iso: string, agora: Date): boolean {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return false;
  return (
    data.getFullYear() === agora.getFullYear() && data.getMonth() === agora.getMonth() && data.getDate() === agora.getDate()
  );
}

export function calcularResumoDoDia(items: Estoque[], agora: Date = new Date()): ResumoDoDia {
  let itens = 0;
  let valorTotal = 0;
  let semValor = 0;

  for (const item of items) {
    if (!ehHoje(item.criado_em, agora)) continue;
    itens += 1;
    // Mesmo cálculo do total do estoque, pra que os dois números nunca
    // discordem quando uma unidade tem preço próprio.
    valorTotal += valorTotalItem(item);
    if (!(Number(item.valor) > 0)) semValor += 1;
  }

  return { itens, valorTotal, semValor };
}
