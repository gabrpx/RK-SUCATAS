// Exporta o histórico de compras de um cliente em CSV — sem endpoint novo,
// monta o arquivo no navegador a partir do que já está carregado.
import type { Cliente } from './types';
import type { HistoricoCliente } from './metricas';

function escaparCsv(valor: string): string {
  if (/[;"\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

function formatarValor(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

// Separador ; (não ,) porque é o que o Excel em pt-BR espera por padrão.
export function gerarCsvHistoricoCliente(cliente: Cliente, historico: HistoricoCliente): string {
  const cabecalho = ['Data', 'Item', 'Quantidade', 'Valor unitário', 'Valor total', 'Forma de pagamento'];
  const linhas = historico.vendas.map((v) => [
    v.data,
    v.nome_item,
    String(v.quantidade),
    formatarValor(Number(v.valor_unitario)),
    formatarValor(Number(v.valor_total)),
    v.forma_pagamento?.nome || '',
  ]);
  const todasLinhas = [cabecalho, ...linhas].map((colunas) => colunas.map(escaparCsv).join(';'));
  // BOM no início: sem ele o Excel em pt-BR abre acentuação quebrada.
  return String.fromCharCode(0xfeff) + todasLinhas.join('\r\n');
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
