// Agregações puras sobre as fichas-filhas de uma família de peça (ver
// docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md).
// Vive fora da UI de propósito — os mesmos números precisam bater na linha
// da tabela e no header do modal de família, e outros módulos (Vendas,
// Orçamentos) podem reaproveitar isso mais tarde sem reescrever nada.
import type { Estoque } from './types';
import { valorTotalEstoque, valorDaUnidade, contarAvarias } from './valorEstoque';
import { extrairAnoOrdenavel } from '../motos/motoTree';

export interface GrupoModeloFamilia {
  modeloMotoId: string | null;
  nomeModelo: string;
  ano: string | null;
  itens: Estoque[];
}

// Agrupa as fichas-filhas por modelo_moto_id e ordena os grupos do modelo
// mais antigo pro mais novo (extraindo o 1º ano numérico de modelo_moto.ano
// — ver extrairAnoOrdenavel). Fichas sem modelo (ano indefinido) vão pro
// final.
export function agruparPorModelo(itens: Estoque[]): GrupoModeloFamilia[] {
  const porModelo = new Map<string, GrupoModeloFamilia>();

  for (const item of itens) {
    const chave = item.modelo_moto_id ?? '__sem_modelo__';
    const existente = porModelo.get(chave);
    if (existente) {
      existente.itens.push(item);
    } else {
      porModelo.set(chave, {
        modeloMotoId: item.modelo_moto_id,
        nomeModelo: item.modelo_moto?.nome ?? 'Sem modelo',
        ano: item.modelo_moto?.ano ?? null,
        itens: [item],
      });
    }
  }

  return Array.from(porModelo.values()).sort((a, b) => {
    const anoA = extrairAnoOrdenavel(a.ano);
    const anoB = extrairAnoOrdenavel(b.ano);
    if (anoA === null && anoB === null) return 0;
    if (anoA === null) return 1;
    if (anoB === null) return -1;
    return anoA - anoB;
  });
}

export function contarModelosFamilia(itens: Estoque[]): number {
  const ids = new Set(itens.map((item) => item.modelo_moto_id).filter((id): id is string => !!id));
  return ids.size;
}

// Preço mínimo/máximo entre as unidades DISPONÍVEIS (não vendidas) de todas
// as fichas — reaproveita valorDaUnidade (herança) pra cada unidade fichada
// e o valor padrão da peça pra cada unidade "em branco".
export function faixaPrecoFamilia(itens: Estoque[]): { min: number; max: number } | null {
  const precos: number[] = [];

  for (const item of itens) {
    const disponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em);
    for (const unidade of disponiveis) precos.push(valorDaUnidade(unidade, item.valor));
    const semFicha = Math.max(0, (Number(item.quantidade) || 0) - disponiveis.length);
    for (let i = 0; i < semFicha; i++) precos.push(Number(item.valor) || 0);
  }

  if (precos.length === 0) return null;
  return { min: Math.min(...precos), max: Math.max(...precos) };
}

// "Em estoque" no header do modal — soma de quantidade (já é o número de
// unidades disponíveis: registrar_venda decrementa a cada venda, com ou sem
// ficha vinculada).
export function emEstoqueFamilia(itens: Estoque[]): number {
  return itens.reduce((soma, item) => soma + (Number(item.quantidade) || 0), 0);
}

// "Variações" no header do modal — total de unidades físicas já
// cadastradas (disponíveis + vendidas). Cai pra quantidade quando `unidades`
// ainda não veio populado (ambiente sem a migration_057 rodada).
export function variacoesFamilia(itens: Estoque[]): number {
  return itens.reduce((soma, item) => soma + (item.unidades ? item.unidades.length : Number(item.quantidade) || 0), 0);
}

export function comAvariaFamilia(itens: Estoque[]): number {
  return itens.reduce((soma, item) => soma + contarAvarias(item), 0);
}

export function valorEmEstoqueFamilia(itens: Estoque[]): number {
  return valorTotalEstoque(itens);
}
