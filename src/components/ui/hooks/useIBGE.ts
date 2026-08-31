import { useEffect, useState } from 'react';

export interface UFEntry {
  sigla: string;
  nome: string;
  cidades: string[];
}

let cachePromise: Promise<UFEntry[]> | null = null;

function load(): Promise<UFEntry[]> {
  if (!cachePromise) {
    cachePromise = import('../data/ibge-municipios.json').then((m) => m.default as UFEntry[]);
  }
  return cachePromise;
}

export function useUFs(): UFEntry[] {
  const [ufs, setUfs] = useState<UFEntry[]>([]);

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) setUfs(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return ufs;
}

export function useCidades(uf: string | ''): { data: string[]; loading: boolean } {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(!!uf);

  useEffect(() => {
    if (!uf) {
      setData([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    load().then((all) => {
      if (!alive) return;
      const entry = all.find((u) => u.sigla === uf);
      setData(entry?.cidades ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [uf]);

  return { data, loading };
}
