// Hook próprio (fora do DataContext, que só carrega estoque/vendas/caixa/
// orçamentos pra quem tem papel admin/equipe): mandados/mecanico nunca
// precisariam daqueles quatro endpoints, e um poll mais curto aqui deixa a
// tela de tarefas mais responsiva ("o chefe acabou de me mandar algo").
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { tarefasApi } from './api';
import type { Tarefa } from './types';

const POLL_INTERVAL_MS = 20000;

type TarefasState = {
  tarefas: Tarefa[];
  atualizacoesLocais: Array<{ versao: number; atualizar: SetStateAction<Tarefa[]> }>;
};

type TarefasAction =
  | { type: 'fetch-started'; versao: number }
  | { type: 'fetch-succeeded'; tarefas: Tarefa[]; versaoInicial: number }
  | { type: 'atualizacao-local'; versao: number; atualizar: SetStateAction<Tarefa[]> };

function aplicarAtualizacao(tarefas: Tarefa[], atualizar: SetStateAction<Tarefa[]>) {
  const resultado = typeof atualizar === 'function' ? atualizar(tarefas) : atualizar;
  const ids = new Set<string>();
  return resultado.filter((tarefa) => {
    if (ids.has(tarefa.id)) return false;
    ids.add(tarefa.id);
    return true;
  });
}

function reduzirTarefas(state: TarefasState, action: TarefasAction): TarefasState {
  if (action.type === 'atualizacao-local') {
    return {
      tarefas: aplicarAtualizacao(state.tarefas, action.atualizar),
      atualizacoesLocais: [...state.atualizacoesLocais, { versao: action.versao, atualizar: action.atualizar }],
    };
  }

  if (action.type === 'fetch-started') {
    return {
      ...state,
      // A nova consulta começou depois destas mudanças; o servidor já as conhece.
      atualizacoesLocais: state.atualizacoesLocais.filter((item) => item.versao > action.versao),
    };
  }

  const atualizacoesPosteriores = state.atualizacoesLocais.filter((item) => item.versao > action.versaoInicial);
  const tarefas = atualizacoesPosteriores.reduce(
    (atuais, item) => aplicarAtualizacao(atuais, item.atualizar),
    action.tarefas,
  );
  return { ...state, tarefas };
}

export function useTarefas() {
  const [{ tarefas }, dispatchTarefas] = useReducer(reduzirTarefas, {
    tarefas: [],
    atualizacoesLocais: [],
  });
  const versaoMutacao = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carregando = useRef(false);

  const setTarefas: Dispatch<SetStateAction<Tarefa[]>> = useCallback((atualizar) => {
    const versao = ++versaoMutacao.current;
    dispatchTarefas({ type: 'atualizacao-local', versao, atualizar });
  }, []);

  const carregar = useCallback(async () => {
    if (carregando.current) return;
    carregando.current = true;
    const versaoInicial = versaoMutacao.current;
    dispatchTarefas({ type: 'fetch-started', versao: versaoInicial });
    try {
      const result = await tarefasApi.listar();
      if (!result.success) throw new Error(result.error);
      dispatchTarefas({ type: 'fetch-succeeded', tarefas: result.data, versaoInicial });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar tarefas');
    } finally {
      setLoading(false);
      carregando.current = false;
    }
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [carregar]);

  return { tarefas, setTarefas, loading, error, refetch: carregar };
}
