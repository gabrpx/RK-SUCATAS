// Hooks de dados do domínio de Gavetas. O app não usa @tanstack/react-query
// em lugar nenhum (não é nem dependência instalada, apesar do que consta em
// CLAUDE.md) — todo o resto do código busca dados com useState/useCallback e
// um `refetch` manual (ver src/features/lembretes/useLembretes.ts e
// src/features/tarefas/useTarefas.ts). useGavetas espelha esse padrão real.
//
// Não existe cache compartilhado entre instâncias do hook (nenhum módulo do
// app tem isso hoje), então "invalidar" a lista de gavetas depois de uma
// mutação significa chamar o `refetch()` da MESMA instância de useGavetas()
// que o componente já tem — igual ao fluxo de EstoqueFamiliaModal, que chama
// a API direto e depois o callback do componente pai pra recarregar.
//
// A exceção é o estoque: ele já tem um cache de verdade (DataContext),
// então mover/soltar peça de gaveta (que muda estoque.gaveta_id) e excluir
// gaveta (que solta as peças no backend) chamam `refreshData()` do
// DataContext — a invalidação real equivalente a `['estoque']` mencionada
// no brief.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../../../context/DataContext';
import { gavetasApi } from './api';
import type { Gaveta, GavetaInput } from '../types';

export function useGavetas() {
  const [gavetas, setGavetas] = useState<Gaveta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carregando = useRef(false);

  const carregar = useCallback(async () => {
    if (carregando.current) return;
    carregando.current = true;
    try {
      const result = await gavetasApi.listar();
      if (!result.success) throw new Error(result.error);
      setGavetas(result.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar gavetas');
    } finally {
      setLoading(false);
      carregando.current = false;
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { gavetas, setGavetas, loading, error, refetch: carregar };
}

export function useCriarGaveta() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criar = useCallback(async (payload: GavetaInput) => {
    setLoading(true);
    try {
      const result = await gavetasApi.criar(payload);
      if (!result.success) throw new Error(result.error);
      setError(null);
      return result.data;
    } catch (err: any) {
      setError(err.message || 'Erro ao criar gaveta');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { criar, loading, error };
}

export function useAtualizarGaveta() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atualizar = useCallback(async (id: string, payload: Partial<GavetaInput>) => {
    setLoading(true);
    try {
      const result = await gavetasApi.atualizar(id, payload);
      if (!result.success) throw new Error(result.error);
      setError(null);
      return result.data;
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar gaveta');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { atualizar, loading, error };
}

export function useExcluirGaveta() {
  // Excluir gaveta solta as peças dela no backend (estoque.gaveta_id = null,
  // ver src/server/routes/gavetas.ts) — o cache de estoque no DataContext
  // fica desatualizado até recarregar.
  const { refreshData } = useData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const excluir = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const result = await gavetasApi.excluir(id);
      if (!result.success) throw new Error(result.error);
      setError(null);
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir gaveta');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshData]);

  return { excluir, loading, error };
}

export function useMoverPecaGaveta() {
  // Mover/soltar peça muda estoque.gaveta_id — precisa recarregar o cache
  // de estoque do DataContext pra refletir em qualquer tela que já leu ele.
  const { refreshData } = useData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mover = useCallback(async (estoqueId: string, gavetaId: string | null) => {
    setLoading(true);
    try {
      const result = await gavetasApi.moverPecaGaveta(estoqueId, gavetaId);
      if (!result.success) throw new Error(result.error);
      setError(null);
      await refreshData();
      return result.data;
    } catch (err: any) {
      setError(err.message || 'Erro ao mover peça de gaveta');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshData]);

  return { mover, loading, error };
}

const CONCORRENCIA_MAX = 5;

export interface ResultadoMoverEmLote {
  sucesso: string[];
  falhas: { id: string; error: string }[];
}

export function useMoverPecasGaveta() {
  const { refreshData } = useData();
  const [loading, setLoading] = useState(false);

  const moverEmLote = useCallback(async (estoqueIds: string[], gavetaId: string | null): Promise<ResultadoMoverEmLote> => {
    const sucesso: string[] = [];
    const falhas: { id: string; error: string }[] = [];
    if (estoqueIds.length === 0) return { sucesso, falhas };

    setLoading(true);
    try {
      const fila = [...new Set(estoqueIds)];
      const trabalhar = async () => {
        while (fila.length > 0) {
          const id = fila.shift();
          if (!id) return;
          try {
            const result = await gavetasApi.moverPecaGaveta(id, gavetaId);
            if (!result.success) throw new Error(result.error || 'Falha ao mover peça');
            sucesso.push(id);
          } catch (error: any) {
            falhas.push({ id, error: error?.message || 'Falha ao mover peça' });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_MAX, fila.length) }, trabalhar));
      if (sucesso.length > 0) await refreshData();
      return { sucesso, falhas };
    } finally {
      setLoading(false);
    }
  }, [refreshData]);

  return { moverEmLote, loading };
}
