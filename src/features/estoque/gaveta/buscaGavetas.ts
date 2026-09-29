import type { Estoque } from '../types';
import { pendenciasDaVariante } from './pendenciasGaveta';

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
    item.familia?.nome,
    item.gaveta?.nome,
    ...(item.modelos_compativeis ?? []).map((modelo) => modelo.nome),
    ...(item.unidades ?? []).flatMap((unidade) => [
      unidade.sku == null ? '' : String(unidade.sku),
      unidade.nome,
      unidade.descricao,
      unidade.avaria_descricao,
      unidade.origem_identificacao,
      unidade.motivo_arquivamento,
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

// Filtros rápidos da lista de gavetas (T03). Operam sobre a VARIANTE (peça),
// reaproveitando o modelo de pendências pra nunca discordar dos badges.
export type FiltroRapido =
  | 'pendentes'
  | 'sem_foto'
  | 'com_avaria'
  | 'disponiveis'
  | 'vendidas'
  | 'sem_preco';

export const FILTROS_RAPIDOS: { id: FiltroRapido; nome: string }[] = [
  { id: 'pendentes', nome: 'Pendentes' },
  { id: 'sem_foto', nome: 'Sem foto' },
  { id: 'sem_preco', nome: 'Sem preço' },
  { id: 'com_avaria', nome: 'Com avaria' },
  { id: 'disponiveis', nome: 'Disponíveis' },
  { id: 'vendidas', nome: 'Vendidas' },
];

function unidadesDisponiveis(item: Estoque) {
  return (item.unidades ?? []).filter((u) => !u.vendida_em);
}

/** Estoque à venda = quantidade física ainda não vendida (fichas + fantasmas). */
function temEstoqueDisponivel(item: Estoque): boolean {
  const vendidas = (item.unidades ?? []).filter((u) => u.vendida_em).length;
  return (Number(item.quantidade) || 0) - vendidas > 0 || unidadesDisponiveis(item).length > 0;
}

export function itemAtendeFiltroRapido(item: Estoque, filtro: FiltroRapido): boolean {
  const pend = pendenciasDaVariante(item);
  switch (filtro) {
    case 'pendentes':
      return pend.length > 0;
    case 'sem_foto':
      return pend.includes('sem_foto');
    case 'sem_preco':
      return pend.includes('sem_preco');
    case 'com_avaria':
      return unidadesDisponiveis(item).some((u) => u.avaria);
    case 'disponiveis':
      return temEstoqueDisponivel(item);
    case 'vendidas':
      return (item.unidades ?? []).some((u) => u.vendida_em);
    default:
      return true;
  }
}
