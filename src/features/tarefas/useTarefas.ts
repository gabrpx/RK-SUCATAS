// Hook próprio (fora do DataContext, que só carrega estoque/vendas/caixa/
// orçamentos pra quem tem papel admin/equipe): mandados/mecanico nunca
// precisariam daqueles quatro endpoints, e um poll mais curto aqui deixa a
// tela de tarefas mais responsiva ("o chefe acabou de me mandar algo").
import { useCallback, useEffect, useRef, useState } from 'react';
import { tarefasApi } from './api';
import type { Tarefa } from './types';

const POLL_INTERVAL_MS = 20000;

export function useTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carregando = useRef(false);

  const carregar = useCallback(async () => {
    if (carregando.current) return;
    carregando.current = true;
    try {
      const result = await tarefasApi.listar();
      if (!result.success) throw new Error(result.error);
      setTarefas(result.data);
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
