// Fonte única de dados do app: estoque, vendas e caixa.
// Busca as três tabelas em paralelo, cacheia em localStorage pra pintar a tela
// instantaneamente na próxima abertura, e faz polling silencioso a cada 10s.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fetchWithRetry, parseJson } from '../lib/apiClient';
import type { Estoque } from '../features/estoque/types';
import type { Venda } from '../features/vendas/types';
import type { CaixaEntry } from '../features/caixa/types';

const CACHE_TIME_MS = 5 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

interface DataContextValue {
  estoque: Estoque[];
  vendas: Venda[];
  caixa: CaixaEntry[];
  loading: boolean;
  setEstoque: React.Dispatch<React.SetStateAction<Estoque[]>>;
  setVendas: React.Dispatch<React.SetStateAction<Venda[]>>;
  setCaixa: React.Dispatch<React.SetStateAction<CaixaEntry[]>>;
  refreshData: () => Promise<void>;
  showSensitiveInfo: boolean;
  setShowSensitiveInfo: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DataContext = createContext<DataContextValue>({
  estoque: [],
  vendas: [],
  caixa: [],
  loading: false,
  setEstoque: () => {},
  setVendas: () => {},
  setCaixa: () => {},
  refreshData: async () => {},
  showSensitiveInfo: true,
  setShowSensitiveInfo: () => {},
});

export const useData = () => useContext(DataContext);

// Atualiza o state só quando o payload realmente mudou (evita re-render em cascata
// no polling silencioso) e persiste uma cópia em localStorage pro próximo boot.
function applyIfChanged<T>(prev: T, next: T, cacheKey: string): T {
  if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(next));
  } catch {
    // localStorage cheio ou indisponível — segue sem cache, não é crítico
  }
  return next;
}

function readCache<T>(cacheKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [estoque, setEstoque] = useState<Estoque[]>(() => readCache('rk_estoque', []));
  const [vendas, setVendas] = useState<Venda[]>(() => readCache('rk_vendas', []));
  const [caixa, setCaixa] = useState<CaixaEntry[]>(() => readCache('rk_caixa', []));
  const [loading, setLoading] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(true);
  const lastFetchRef = useRef(0);

  const loadData = async (force = false, silent = false) => {
    const now = Date.now();
    if (!force && !silent && now - lastFetchRef.current < CACHE_TIME_MS && estoque.length > 0) {
      return;
    }
    if (!silent) setLoading(true);

    const results = await Promise.allSettled([
      fetchWithRetry('/api/estoque'),
      fetchWithRetry('/api/vendas'),
      fetchWithRetry('/api/caixa'),
    ]);

    const [estoqueRes, vendasRes, caixaRes] = results;

    if (estoqueRes.status === 'fulfilled') {
      try {
        const data = await parseJson(estoqueRes.value);
        if (data.success) setEstoque(prev => applyIfChanged(prev, data.data, 'rk_estoque'));
      } catch (e) {
        console.error('Erro ao processar estoque:', e);
      }
    } else {
      console.error('Erro ao buscar estoque:', estoqueRes.reason);
    }

    if (vendasRes.status === 'fulfilled') {
      try {
        const data = await parseJson(vendasRes.value);
        if (data.success) setVendas(prev => applyIfChanged(prev, data.data, 'rk_vendas'));
      } catch (e) {
        console.error('Erro ao processar vendas:', e);
      }
    } else {
      console.error('Erro ao buscar vendas:', vendasRes.reason);
    }

    if (caixaRes.status === 'fulfilled') {
      try {
        const data = await parseJson(caixaRes.value);
        if (data.success) setCaixa(prev => applyIfChanged(prev, data.data, 'rk_caixa'));
      } catch (e) {
        console.error('Erro ao processar caixa:', e);
      }
    } else {
      console.error('Erro ao buscar caixa:', caixaRes.reason);
    }

    lastFetchRef.current = now;
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadData(false, true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <DataContext.Provider
      value={{
        estoque,
        vendas,
        caixa,
        loading,
        setEstoque,
        setVendas,
        setCaixa,
        refreshData: () => loadData(true),
        showSensitiveInfo,
        setShowSensitiveInfo,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
