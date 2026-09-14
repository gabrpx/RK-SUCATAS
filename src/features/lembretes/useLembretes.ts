// Hook próprio (fora do DataContext, mesmo motivo de useTarefas.ts: cargos
// "executores" não têm acesso aos endpoints admin/equipe do DataContext, e um
// poll mais curto deixa a tela responsiva a lembretes atribuídos na hora).
import { useCallback, useEffect, useRef, useState } from 'react';
import { lembretesApi } from './api';
import type { Lembrete } from './types';

const POLL_INTERVAL_MS = 20000;

export function useLembretes() {
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carregando = useRef(false);

  const carregar = useCallback(async () => {
    if (carregando.current) return;
    carregando.current = true;
    try {
      const result = await lembretesApi.listar();
      if (!result.success) throw new Error(result.error);
      setLembretes(result.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar lembretes');
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

  return { lembretes, setLembretes, loading, error, refetch: carregar };
}
