// Peças na subcategoria "Motor Completo" (dentro de Motor) exigem informar se
// têm nota fiscal pra cadastro no órgão de trânsito — as demais subcategorias
// de Motor (Carburador, Cabeçote etc.) não exigem. Compartilhado entre
// frontend (form/validação) e backend (validação da rota) — só arrays em
// memória, sem dependência de React/Node.
import type { Categoria } from '../../types/catalog';
import { getAncestorChain } from '../categorias/categoriaTree';

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function categoriaExigeNota(categoriaId: string | null | undefined, categorias: Categoria[]): boolean {
  if (!categoriaId) return false;
  return getAncestorChain(categoriaId, categorias).some((c) => normalizar(c.nome) === 'motor completo');
}
