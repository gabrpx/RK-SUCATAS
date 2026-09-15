// Modelo comum de PENDÊNCIAS operacionais do estoque por gavetas. Puro (sem
// JSX, sem API): a mesma função alimenta o badge da gaveta, da variante e da
// unidade, pra que os números nunca discordem entre si nem mudem em silêncio
// quando a tela filtra.
//
// Granularidade da contagem em `resumirPendenciasEstoque` (documentada de
// propósito, pois mistura escopos):
//   - sem_gaveta, ficha_pendente  -> contados por VARIANTE (peça/Estoque)
//   - sem_foto, foto_legada, com_avaria, sem_preco -> contados por UNIDADE
//     DISPONÍVEL (ficha não vendida). Unidades ainda não cadastradas (quando
//     quantidade > fichas) já entram em ficha_pendente e NÃO são recontadas
//     aqui, pra não inflar sem_foto/sem_preco com fantasmas.
import type { Estoque, EstoqueUnidade } from '../types';

export type PendenciaGaveta =
  | 'sem_gaveta'
  | 'ficha_pendente'
  | 'sem_foto'
  | 'foto_legada'
  | 'com_avaria'
  | 'sem_preco';

export interface ResumoPendencias {
  total: number;
  porTipo: Record<PendenciaGaveta, number>;
}

/** Uma ficha só fica operacionalmente completa com foto e preço próprios. */
export function fichaEstaCompleta(unidade: EstoqueUnidade): boolean {
  return (unidade.fotos?.length ?? 0) > 0 && Number(unidade.valor) > 0;
}

export function pendenciasObrigatoriasDaFicha(unidade: EstoqueUnidade): Array<'sem_foto' | 'sem_preco'> {
  const pendencias: Array<'sem_foto' | 'sem_preco'> = [];
  if ((unidade.fotos?.length ?? 0) === 0) pendencias.push('sem_foto');
  if (!(Number(unidade.valor) > 0)) pendencias.push('sem_preco');
  return pendencias;
}

// Ordem estável de exibição — mais acionável / mais grave primeiro.
export const ORDEM_PENDENCIAS: PendenciaGaveta[] = [
  'sem_gaveta',
  'ficha_pendente',
  'sem_preco',
  'com_avaria',
  'sem_foto',
  'foto_legada',
];

function zerado(): Record<PendenciaGaveta, number> {
  return { sem_gaveta: 0, ficha_pendente: 0, sem_foto: 0, foto_legada: 0, com_avaria: 0, sem_preco: 0 };
}

function unidadesDisponiveis(item: Estoque): EstoqueUnidade[] {
  return (item.unidades ?? []).filter((u) => !u.vendida_em);
}

function fichasPendentes(item: Estoque): number {
  return Math.max(0, (Number(item.quantidade) || 0) - unidadesDisponiveis(item).length);
}

/**
 * Pendências de uma UNIDADE física (ficha). `variante` é opcional mas
 * necessário para distinguir foto legada (herdada da variante) de ausência
 * total de foto, e para saber o preço herdado.
 */
export function pendenciasDaUnidade(
  unidade: EstoqueUnidade,
  variante?: Pick<Estoque, 'imagens' | 'valor'>,
): PendenciaGaveta[] {
  const pend: PendenciaGaveta[] = [];

  const temFotoPropria = (unidade.fotos?.length ?? 0) > 0;
  if (!temFotoPropria) {
    const temFotoLegada = (variante?.imagens?.length ?? 0) > 0;
    pend.push(temFotoLegada ? 'foto_legada' : 'sem_foto');
  }

  if (unidade.avaria) pend.push('com_avaria');

  if (!(Number(unidade.valor) > 0)) pend.push('sem_preco');

  return pend;
}

/**
 * Conjunto (deduplicado, em ordem estável) de tipos de pendência que uma
 * VARIANTE apresenta — inclui o escopo da própria variante (sem_gaveta,
 * ficha_pendente) e agrega as pendências das suas unidades disponíveis.
 * Unidades ainda não cadastradas (quantidade > fichas) herdam foto/preço da
 * variante, então também refletem sem_foto/foto_legada/sem_preco.
 */
export function pendenciasDaVariante(item: Estoque): PendenciaGaveta[] {
  const set = new Set<PendenciaGaveta>();

  if (!item.gaveta_id) set.add('sem_gaveta');

  const disponiveis = unidadesDisponiveis(item);
  const semFicha = fichasPendentes(item);
  if (semFicha > 0) set.add('ficha_pendente');

  for (const u of disponiveis) {
    for (const p of pendenciasDaUnidade(u, item)) set.add(p);
  }

  // Fantasmas (unidades físicas sem ficha) herdam foto/preço da variante.
  if (semFicha > 0) {
    set.add((item.imagens?.length ?? 0) > 0 ? 'foto_legada' : 'sem_foto');
    if (!((Number(item.valor) || 0) > 0)) set.add('sem_preco');
  }

  return ORDEM_PENDENCIAS.filter((tipo) => set.has(tipo));
}

/** Resumo agregado sobre uma lista de peças. Ver nota de granularidade no topo. */
export function resumirPendenciasEstoque(itens: Estoque[]): ResumoPendencias {
  const porTipo = zerado();

  for (const item of itens) {
    if (!item.gaveta_id) porTipo.sem_gaveta += 1;
    if (fichasPendentes(item) > 0) porTipo.ficha_pendente += 1;

    for (const u of unidadesDisponiveis(item)) {
      for (const p of pendenciasDaUnidade(u, item)) porTipo[p] += 1;
    }
  }

  const total = ORDEM_PENDENCIAS.reduce((s, tipo) => s + porTipo[tipo], 0);
  return { total, porTipo };
}

const ROTULOS_SINGULAR: Record<PendenciaGaveta, string> = {
  sem_gaveta: 'sem gaveta',
  ficha_pendente: 'ficha pendente',
  sem_foto: 'sem foto',
  foto_legada: 'foto legada',
  com_avaria: 'com avaria',
  sem_preco: 'sem preço',
};

const ROTULOS_PLURAL: Record<PendenciaGaveta, string> = {
  sem_gaveta: 'sem gaveta',
  ficha_pendente: 'fichas pendentes',
  sem_foto: 'sem foto',
  foto_legada: 'fotos legadas',
  com_avaria: 'com avaria',
  sem_preco: 'sem preço',
};

/** Rótulo textual em pt-BR — sempre com texto, nunca só cor/ícone. */
export function rotuloPendencia(tipo: PendenciaGaveta, quantidade: number): string {
  const rot = quantidade === 1 ? ROTULOS_SINGULAR[tipo] : ROTULOS_PLURAL[tipo];
  return `${quantidade} ${rot}`;
}

/** Só o nome do tipo (sem número) — para chips de variante, onde a peça é uma só. */
export function nomePendencia(tipo: PendenciaGaveta): string {
  return ROTULOS_SINGULAR[tipo];
}
