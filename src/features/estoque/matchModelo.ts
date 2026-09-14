// Casa o nome digitado da peça com um modelo de moto já cadastrado, palavra
// por palavra (ex: digitar "Lanterna CG 150" bate com o modelo "CG 150") —
// mesmo critério de matchCategoria.ts, espelhado pro domínio de motos.
import type { ModeloMoto } from '../../types/catalog';
import { getDepth } from '../motos/motoTree';

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

export function encontrarModeloPorNome(nomePeca: string, modelos: ModeloMoto[]): ModeloMoto | undefined {
  const palavrasDigitadas = new Set(normalizar(nomePeca).split(/\s+/).filter(Boolean));
  if (palavrasDigitadas.size === 0) return undefined;

  const candidatos = modelos.filter((m) => {
    const palavrasModelo = normalizar(m.nome).split(/\s+/).filter(Boolean);
    return palavrasModelo.length > 0 && palavrasModelo.every((p) => palavrasDigitadas.has(p));
  });

  if (candidatos.length === 0) return undefined;
  // Entre os que bateram, o mais específico vence: primeiro por profundidade
  // na árvore (ex: "CG 150 Carburada" vence "CG 150"), depois por nome mais longo.
  return candidatos.sort((a, b) => getDepth(b.id, modelos) - getDepth(a.id, modelos) || b.nome.length - a.nome.length)[0];
}
