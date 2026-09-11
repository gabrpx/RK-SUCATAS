import type { Estoque } from '../types';

export function normalizarTextoBusca(texto: string): string {
  return (texto || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function termosDaBusca(busca: string): string[] {
  return normalizarTextoBusca(busca).split(/\s+/).filter(Boolean);
}

function textoPesquisavel(item: Estoque): string {
  const campos = [
    item.nome,
    item.codigo,
    item.descricao,
    item.ano,
    item.categoria?.nome,
    item.modelo_moto?.nome,
    ...(item.modelos_compativeis ?? []).map((modelo) => modelo.nome),
    ...(item.unidades ?? []).flatMap((unidade) => [
      unidade.nome,
      unidade.descricao,
      unidade.avaria_descricao,
    ]),
  ];
  return normalizarTextoBusca(campos.filter(Boolean).join(' '));
}

/** Busca tolerante: todos os termos podem aparecer em campos e posições diferentes. */
export function correspondeBuscaEstoque(item: Estoque, busca: string): boolean {
  const termos = termosDaBusca(busca);
  if (termos.length === 0) return true;
  const alvo = textoPesquisavel(item);
  return termos.every((termo) => alvo.includes(termo));
}

/** Remove marcador físico que pertence à unidade, sem alterar outros parênteses legítimos. */
export function nomeVarianteExibicao(nome: string): string {
  return nome.replace(/\s*\(\s*avaria\s*\)\s*$/i, '').trim();
}
