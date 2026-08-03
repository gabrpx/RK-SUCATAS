// Fonte única de dados do app: estoque, vendas e caixa.
// Busca as três tabelas em paralelo, cacheia em localStorage pra pintar a tela
// instantaneamente na próxima abertura, e faz polling silencioso a cada 10s.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fetchWithRetry, parseJson } from '../lib/apiClient';
import { EXECUTORES_TAREFA } from '../constants/roles';
import type { Role } from '../constants/roles';
import type { Estoque } from '../features/estoque/types';
import type { Venda } from '../features/vendas/types';
import type { CaixaEntry } from '../features/caixa/types';
import type { Orcamento } from '../features/orcamentos/types';

const CACHE_TIME_MS = 5 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

interface DataContextValue {
  estoque: Estoque[];
  vendas: Venda[];
  caixa: CaixaEntry[];
  orcamentos: Orcamento[];
  loading: boolean;
  setEstoque: React.Dispatch<React.SetStateAction<Estoque[]>>;
  setVendas: React.Dispatch<React.SetStateAction<Venda[]>>;
  setCaixa: React.Dispatch<React.SetStateAction<CaixaEntry[]>>;
  setOrcamentos: React.Dispatch<React.SetStateAction<Orcamento[]>>;
  refreshData: () => Promise<void>;
  showSensitiveInfo: boolean;
  setShowSensitiveInfo: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DataContext = createContext<DataContextValue>({
  estoque: [],
  vendas: [],
  caixa: [],
  orcamentos: [],
  loading: false,
  setEstoque: () => {},
  setVendas: () => {},
  setCaixa: () => {},
  setOrcamentos: () => {},
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
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(() => readCache('rk_orcamentos', []));
  const [loading, setLoading] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(true);
  const lastFetchRef = useRef(0);

  const loadData = async (force = false, silent = false) => {
    const now = Date.now();
    if (!force && !silent && now - lastFetchRef.current < CACHE_TIME_MS && estoque.length > 0) {
      return;
    }

    // Cargos "executores" (EXECUTORES_TAREFA: mandados/Pitoco, mecanico/Itinho)
    // não têm permissão pra nenhum destes quatro endpoints — a aba deles
    // (Tarefas) busca os próprios dados via useTarefas, não via este contexto.
    // Sem isso, o app ficaria repetindo requisições que sempre voltam 403 a
    // cada poll.
    const role = localStorage.getItem('user_role') as Role | null;
    if (role && EXECUTORES_TAREFA.includes(role)) {
      setLoading(false);
      return;
    }
    // 'estoque_leitura' (Eloisa) só pode ler estoque — os outros três
    // endpoints são bloqueados no backend pra esse papel, então nem tenta.
    const podeVendasCaixaOrcamentos = role !== 'estoque_leitura';

    if (!silent) setLoading(true);

    const results = await Promise.allSettled([
      fetchWithRetry('/api/estoque'),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/vendas') : Promise.resolve(null),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/caixa') : Promise.resolve(null),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/orcamentos') : Promise.resolve(null),
    ]);

    const [estoqueRes, vendasRes, caixaRes, orcamentosRes] = results;

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

    if (vendasRes.status === 'fulfilled' && vendasRes.value) {
      try {
        const data = await parseJson(vendasRes.value);
        if (data.success) setVendas(prev => applyIfChanged(prev, data.data, 'rk_vendas'));
      } catch (e) {
        console.error('Erro ao processar vendas:', e);
      }
    } else if (vendasRes.status === 'rejected') {
      console.error('Erro ao buscar vendas:', vendasRes.reason);
    }

    if (caixaRes.status === 'fulfilled' && caixaRes.value) {
      try {
        const data = await parseJson(caixaRes.value);
        if (data.success) setCaixa(prev => applyIfChanged(prev, data.data, 'rk_caixa'));
      } catch (e) {
        console.error('Erro ao processar caixa:', e);
      }
    } else if (caixaRes.status === 'rejected') {
      console.error('Erro ao buscar caixa:', caixaRes.reason);
    }

    if (orcamentosRes.status === 'fulfilled' && orcamentosRes.value) {
      try {
        const data = await parseJson(orcamentosRes.value);
        if (data.success) setOrcamentos(prev => applyIfChanged(prev, data.data, 'rk_orcamentos'));
      } catch (e) {
        console.error('Erro ao processar orçamentos:', e);
      }
    } else if (orcamentosRes.status === 'rejected') {
      console.error('Erro ao buscar orçamentos:', orcamentosRes.reason);
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
        orcamentos,
        loading,
        setEstoque,
        setVendas,
        setCaixa,
        setOrcamentos,
        refreshData: () => loadData(true),
        showSensitiveInfo,
        setShowSensitiveInfo,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
