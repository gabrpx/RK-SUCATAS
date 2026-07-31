// Busca e cacheia as tabelas de apoio (categorias, modelos de moto, formas de
// pagamento) usadas pelos formulários de Estoque, Vendas e Caixa.
import { useCallback, useEffect, useState } from 'react';
import { categoriasApi, modelosMotoApi, formasPagamentoApi } from '../lib/catalogApi';
import { getDescendantIds } from '../features/categorias/categoriaTree';
import type { Categoria, ModeloMoto, FormaPagamento } from '../types/catalog';

export function useCatalogos() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modelos, setModelos] = useState<ModeloMoto[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, modRes, pagRes] = await Promise.all([categoriasApi.listar(), modelosMotoApi.listar(), formasPagamentoApi.listar()]);
      if (catRes.success) setCategorias(catRes.data);
      if (modRes.success) setModelos(modRes.data);
      if (pagRes.success) setFormasPagamento(pagRes.data);
    } catch (err) {
      console.error('Erro ao carregar categorias/modelos/formas de pagamento:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criarCategoria = useCallback(async (nome: string, parent_id?: string | null) => {
    const result = await categoriasApi.criar(nome, parent_id);
    if (result.success) setCategorias((prev) => [...prev, result.data]);
    return result;
  }, []);

  const renomearCategoria = useCallback(async (id: string, nome: string) => {
    const result = await categoriasApi.renomear(id, nome);
    if (result.success) setCategorias((prev) => prev.map((c) => (c.id === id ? result.data : c)));
    return result;
  }, []);

  const moverCategoria = useCallback(async (id: string, parent_id: string | null) => {
    const result = await categoriasApi.mover(id, parent_id);
    if (result.success) setCategorias((prev) => prev.map((c) => (c.id === id ? result.data : c)));
    return result;
  }, []);

  // Persiste a nova ordem entre os irmãos (mesmo parent_id) — usado pelo drag-and-drop.
  const reordenarCategorias = useCallback(async (idsNaNovaOrdem: string[]) => {
    setCategorias((prev) => {
      const posicao = new Map(idsNaNovaOrdem.map((id, index) => [id, index]));
      return prev.map((c) => (posicao.has(c.id) ? { ...c, ordem: posicao.get(c.id)! } : c));
    });
    return categoriasApi.reordenar(idsNaNovaOrdem);
  }, []);

  const excluirCategoria = useCallback(async (id: string) => {
    const result = await categoriasApi.excluir(id);
    if (result.success) {
      setCategorias((prev) => {
        const idsRemovidos = new Set(getDescendantIds(id, prev));
        return prev.filter((c) => !idsRemovidos.has(c.id));
      });
    }
    return result;
  }, []);

  const criarModelo = useCallback(async (nome: string, marca?: string) => {
    const result = await modelosMotoApi.criar(nome, marca);
    if (result.success) setModelos((prev) => [...prev, result.data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')));
    return result;
  }, []);

  const excluirModelo = useCallback(async (id: string) => {
    const result = await modelosMotoApi.excluir(id);
    if (result.success) setModelos((prev) => prev.filter((m) => m.id !== id));
    return result;
  }, []);

  const criarFormaPagamento = useCallback(async (nome: string) => {
    const result = await formasPagamentoApi.criar(nome);
    if (result.success) setFormasPagamento((prev) => [...prev, result.data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')));
    return result;
  }, []);

  const renomearFormaPagamento = useCallback(async (id: string, nome: string) => {
    const result = await formasPagamentoApi.renomear(id, nome);
    if (result.success) setFormasPagamento((prev) => prev.map((f) => (f.id === id ? result.data : f)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')));
    return result;
  }, []);

  const excluirFormaPagamento = useCallback(async (id: string) => {
    const result = await formasPagamentoApi.excluir(id);
    if (result.success) setFormasPagamento((prev) => prev.filter((f) => f.id !== id));
    return result;
  }, []);

  return {
    categorias,
    modelos,
    formasPagamento,
    loading,
    recarregar: carregar,
    criarCategoria,
    renomearCategoria,
    moverCategoria,
    reordenarCategorias,
    excluirCategoria,
    criarModelo,
    excluirModelo,
    criarFormaPagamento,
    renomearFormaPagamento,
    excluirFormaPagamento,
  };
}
