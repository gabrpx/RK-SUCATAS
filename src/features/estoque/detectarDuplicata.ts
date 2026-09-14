// Detecta peça possivelmente já cadastrada enquanto o nome é digitado.
// Existe por causa do dia de catalogação em massa: várias pessoas cadastrando
// ao mesmo tempo, o mesmo item entra duas vezes e o valor total do estoque
// passa a mentir. O aviso é sempre não-bloqueante — quem cadastra decide.
//
// Função pura (só arrays em memória), sem React, pra poder ser testada e
// eventualmente reaproveitada no backend.
import type { Estoque } from './types';

// Além de tirar acento/pontuação, separa fronteira letra↔número: "CG125" e
// "CG 125" precisam virar os mesmos tokens, senão duplicata escrita junto
// passa batido.
//
// Exportada (com similaridade/CORTE_POSSIVEL abaixo) pra ser reaproveitada
// pelo backend em src/services/mercadolivreSync.ts, pra comparar título de
// anúncio do Mercado Livre com nome de peça do estoque — mesmo problema de
// "nomes parecidos, não idênticos", mesma solução.
export function tokenizar(texto: string): string[] {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export type GrauDuplicata = 'exata' | 'possivel';

export interface Duplicata {
  item: Estoque;
  grau: GrauDuplicata;
  /** Jaccard entre os tokens dos dois nomes, 0..1 */
  similaridade: number;
  /** true quando as duas peças estão na mesma categoria */
  mesmaCategoria: boolean;
}

// Jaccard: interseção sobre união dos tokens. Escolhido em vez de substring
// pra "CDI Titan 150" não casar com "CDI Titan 160" (0.5, abaixo do corte).
export function similaridade(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersecao = 0;
  setA.forEach((t) => {
    if (setB.has(t)) intersecao += 1;
  });
  const uniao = setA.size + setB.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}

// Abaixo disso o ruído supera a utilidade — "Farol" x "Farol Dianteiro"
// (0.5) são peças diferentes e não devem virar alerta.
export const CORTE_POSSIVEL = 0.6;
const MAXIMO_SUGESTOES = 3;

export interface OpcoesDuplicata {
  /** id do item sendo editado — nunca se acusa duplicata de si mesmo */
  ignorarId?: string | null;
  categoriaId?: string | null;
}

export function detectarDuplicatas(nome: string, items: Estoque[], opcoes: OpcoesDuplicata = {}): Duplicata[] {
  const tokens = tokenizar(nome);
  // Nome de uma letra/número solto ainda está sendo digitado — avisar aqui só
  // geraria alerta piscando a cada tecla.
  if (tokens.length === 0 || nome.trim().length < 3) return [];

  const encontradas: Duplicata[] = [];

  for (const item of items) {
    if (!item.ativo) continue;
    if (opcoes.ignorarId && item.id === opcoes.ignorarId) continue;

    const tokensItem = tokenizar(item.nome);
    const score = similaridade(tokens, tokensItem);
    if (score < CORTE_POSSIVEL) continue;

    encontradas.push({
      item,
      grau: score === 1 ? 'exata' : 'possivel',
      similaridade: score,
      mesmaCategoria: !!opcoes.categoriaId && item.categoria_id === opcoes.categoriaId,
    });
  }

  return encontradas
    .sort((a, b) => {
      // Mesma categoria primeiro: é o sinal mais forte de que é de fato a
      // mesma peça, e não um nome parecido de outra família.
      if (a.mesmaCategoria !== b.mesmaCategoria) return a.mesmaCategoria ? -1 : 1;
      return b.similaridade - a.similaridade;
    })
    .slice(0, MAXIMO_SUGESTOES);
}
