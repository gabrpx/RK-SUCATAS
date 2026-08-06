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
import type { Cliente } from '../features/clientes/types';
import type { FiadoBaixa } from '../features/fiado/types';
import type { Envio } from '../features/frete/types';

const CACHE_TIME_MS = 5 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

interface DataContextValue {
  estoque: Estoque[];
  vendas: Venda[];
  caixa: CaixaEntry[];
  orcamentos: Orcamento[];
  clientes: Cliente[];
  fiadoBaixas: FiadoBaixa[];
  envios: Envio[];
  loading: boolean;
  /** true quando a última tentativa de buscar o estoque falhou — distingue
   *  "deu erro" de "está vazio mesmo", pra tela não mostrar uma coisa pela outra. */
  estoqueError: boolean;
  setEstoque: React.Dispatch<React.SetStateAction<Estoque[]>>;
  setVendas: React.Dispatch<React.SetStateAction<Venda[]>>;
  setCaixa: React.Dispatch<React.SetStateAction<CaixaEntry[]>>;
  setOrcamentos: React.Dispatch<React.SetStateAction<Orcamento[]>>;
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  setFiadoBaixas: React.Dispatch<React.SetStateAction<FiadoBaixa[]>>;
  setEnvios: React.Dispatch<React.SetStateAction<Envio[]>>;
  refreshData: () => Promise<void>;
  showSensitiveInfo: boolean;
  setShowSensitiveInfo: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DataContext = createContext<DataContextValue>({
  estoque: [],
  vendas: [],
  caixa: [],
  orcamentos: [],
  clientes: [],
  fiadoBaixas: [],
  envios: [],
  loading: false,
  estoqueError: false,
  setEstoque: () => {},
  setVendas: () => {},
  setCaixa: () => {},
  setOrcamentos: () => {},
  setClientes: () => {},
  setFiadoBaixas: () => {},
  setEnvios: () => {},
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
  const [estoque, setEstoque] = useState<Estoque[]>(() => readCache('rk_estoque_v2', []));
  const [vendas, setVendas] = useState<Venda[]>(() => readCache('rk_vendas', []));
  const [caixa, setCaixa] = useState<CaixaEntry[]>(() => readCache('rk_caixa', []));
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(() => readCache('rk_orcamentos', []));
  const [clientes, setClientes] = useState<Cliente[]>(() => readCache('rk_clientes', []));
  const [fiadoBaixas, setFiadoBaixas] = useState<FiadoBaixa[]>(() => readCache('rk_fiado_baixas', []));
  const [envios, setEnvios] = useState<Envio[]>(() => readCache('rk_envios', []));
  const [loading, setLoading] = useState(false);
  const [estoqueError, setEstoqueError] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(true);
  const lastFetchRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async (force = false, silent = false) => {
    const now = Date.now();
    if (!force && !silent && now - lastFetchRef.current < CACHE_TIME_MS && estoque.length > 0) {
      return;
    }

    // Cargos "executores" (EXECUTORES_TAREFA: mandados/Pitoco, mecanico/Itinho)
    // não têm permissão pra nenhum destes quatro endpoints — a aba deles
    // (Tarefas) busca os próprios dados via useTarefas, não via este contexto.
    // Sem isso, o app ficaria repetindo requisições que sempre voltam 403 a
    // cada poll. Um usuário pode ter vários papéis (ver migration_020): só
    // pula tudo se NENHUM papel dele está fora de EXECUTORES_TAREFA — quem
    // também é estoque_leitura/admin/equipe continua buscando normalmente.
    let roles: Role[] = [];
    try {
      const raw = localStorage.getItem('user_roles');
      roles = raw ? JSON.parse(raw) : [];
    } catch {
      roles = [];
    }
    if (roles.length > 0 && roles.every((r) => EXECUTORES_TAREFA.includes(r))) {
      setLoading(false);
      return;
    }
    // 'estoque_leitura' sem admin/equipe só pode ler estoque — os outros
    // três endpoints são bloqueados no backend pra esse papel, então nem
    // tenta (evita 403 previsível a cada poll).
    const podeVendasCaixaOrcamentos = roles.includes('admin') || roles.includes('equipe');

    if (!silent) setLoading(true);

    const results = await Promise.allSettled([
      fetchWithRetry('/api/estoque'),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/vendas') : Promise.resolve(null),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/caixa') : Promise.resolve(null),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/orcamentos') : Promise.resolve(null),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/clientes') : Promise.resolve(null),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/fiado/baixas') : Promise.resolve(null),
      podeVendasCaixaOrcamentos ? fetchWithRetry('/api/envios') : Promise.resolve(null),
    ]);

    const [estoqueRes, vendasRes, caixaRes, orcamentosRes, clientesRes, fiadoBaixasRes, enviosRes] = results;

    let falhouEstoque = false;
    if (estoqueRes.status === 'fulfilled') {
      try {
        const data = await parseJson(estoqueRes.value);
        if (data.success) {
          setEstoque(prev => applyIfChanged(prev, data.data, 'rk_estoque_v2'));
        } else {
          falhouEstoque = true;
        }
      } catch (e) {
        console.error('Erro ao processar estoque:', e);
        falhouEstoque = true;
      }
    } else {
      console.error('Erro ao buscar estoque:', estoqueRes.reason);
      falhouEstoque = true;
    }
    setEstoqueError(falhouEstoque);

    // Falha na primeira carga (ex: cold start do servidor, rede instável no
    // celular) não pode esperar os 10s do polling normal — sem isso a tela
    // fica parecendo "estoque vazio" por até 10s reais, ou mais numa rede ruim.
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (falhouEstoque) {
      retryTimeoutRef.current = setTimeout(() => loadData(false, true), 4000);
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

    if (clientesRes.status === 'fulfilled' && clientesRes.value) {
      try {
        const data = await parseJson(clientesRes.value);
        if (data.success) setClientes(prev => applyIfChanged(prev, data.data, 'rk_clientes'));
      } catch (e) {
        console.error('Erro ao processar clientes:', e);
      }
    } else if (clientesRes.status === 'rejected') {
      console.error('Erro ao buscar clientes:', clientesRes.reason);
    }

    if (fiadoBaixasRes.status === 'fulfilled' && fiadoBaixasRes.value) {
      try {
        const data = await parseJson(fiadoBaixasRes.value);
        if (data.success) setFiadoBaixas(prev => applyIfChanged(prev, data.data, 'rk_fiado_baixas'));
      } catch (e) {
        console.error('Erro ao processar baixas de fiado:', e);
      }
    } else if (fiadoBaixasRes.status === 'rejected') {
      console.error('Erro ao buscar baixas de fiado:', fiadoBaixasRes.reason);
    }

    if (enviosRes.status === 'fulfilled' && enviosRes.value) {
      try {
        const data = await parseJson(enviosRes.value);
        if (data.success) setEnvios(prev => applyIfChanged(prev, data.data, 'rk_envios'));
      } catch (e) {
        console.error('Erro ao processar envios:', e);
      }
    } else if (enviosRes.status === 'rejected') {
      console.error('Erro ao buscar envios:', enviosRes.reason);
    }

    lastFetchRef.current = now;
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadData(false, true);
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  return (
    <DataContext.Provider
      value={{
        estoque,
        vendas,
        caixa,
        orcamentos,
        clientes,
        fiadoBaixas,
        envios,
        loading,
        estoqueError,
        setEstoque,
        setVendas,
        setCaixa,
        setOrcamentos,
        setClientes,
        setFiadoBaixas,
        setEnvios,
        refreshData: () => loadData(true),
        showSensitiveInfo,
        setShowSensitiveInfo,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
