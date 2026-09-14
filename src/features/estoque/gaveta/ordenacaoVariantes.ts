// Ordenação das variantes dentro do detalhe da gaveta (T05). Puro e testável:
// a UI só escolhe o critério. Estável e sem mutar o array de entrada.
import type { Estoque } from '../types';
import { faixaPrecoVariante } from './gavetaEstoque';
import { nomeVarianteExibicao } from './buscaGavetas';
import { pendenciasDaVariante } from './pendenciasGaveta';

export type CriterioOrdenacao = 'nome' | 'quantidade' | 'valor' | 'pendencias';

export const CRITERIOS_ORDENACAO: { id: CriterioOrdenacao; nome: string }[] = [
  { id: 'nome', nome: 'Nome (A–Z)' },
  { id: 'quantidade', nome: 'Quantidade' },
  { id: 'valor', nome: 'Valor' },
  { id: 'pendencias', nome: 'Pendências' },
];

function valorMax(item: Estoque): number {
  const faixa = faixaPrecoVariante(item);
  return faixa ? faixa.max : Number(item.valor) || 0;
}

export function ordenarVariantes(itens: Estoque[], criterio: CriterioOrdenacao): Estoque[] {
  const copia = [...itens];
  switch (criterio) {
    case 'nome':
      return copia.sort((a, b) =>
        nomeVarianteExibicao(a.nome).localeCompare(nomeVarianteExibicao(b.nome), 'pt-BR', { sensitivity: 'base' }),
      );
    case 'quantidade':
      return copia.sort((a, b) => (Number(b.quantidade) || 0) - (Number(a.quantidade) || 0));
    case 'valor':
      return copia.sort((a, b) => valorMax(b) - valorMax(a));
    case 'pendencias':
      return copia.sort((a, b) => pendenciasDaVariante(b).length - pendenciasDaVariante(a).length);
    default:
      return copia;
  }
}
