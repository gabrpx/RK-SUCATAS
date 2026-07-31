// Casa o nome digitado da peça com uma categoria já cadastrada, palavra por
// palavra (ex: digitar "CDI Titan 150" bate com a categoria "CDI"). Não usa
// substring puro pra evitar falso positivo tipo "Cor" dentro de "Correia".
import type { Categoria } from '../../types/catalog';
import { getDepth } from '../categorias/categoriaTree';

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

export function encontrarCategoriaPorNome(nomePeca: string, categorias: Categoria[]): Categoria | undefined {
  const palavrasDigitadas = new Set(normalizar(nomePeca).split(/\s+/).filter(Boolean));
  if (palavrasDigitadas.size === 0) return undefined;

  const candidatas = categorias.filter((cat) => {
    const palavrasCategoria = normalizar(cat.nome).split(/\s+/).filter(Boolean);
    return palavrasCategoria.length > 0 && palavrasCategoria.every((p) => palavrasDigitadas.has(p));
  });

  if (candidatas.length === 0) return undefined;
  // Entre as que bateram, a mais específica vence: primeiro por profundidade
  // na árvore (ex: "Bloco do farol" vence "Farol"), depois por nome mais longo.
  return candidatas.sort((a, b) => getDepth(b.id, categorias) - getDepth(a.id, categorias) || b.nome.length - a.nome.length)[0];
}
