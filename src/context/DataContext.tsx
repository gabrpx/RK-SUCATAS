// Fonte única de dados do app: estoque, vendas e caixa.
// Busca as três tabelas em paralelo, cacheia em localStorage pra pintar a tela
// instantaneamente na próxima abertura, e faz polling silencioso a cada 10s.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchWithRetry, parseJson } from '../lib/apiClient';
import { podeAtual } from '../hooks/usePermissao';
import type { Role } from '../constants/roles';
import type { Estoque } from '../features/estoque/types';
import type { Venda } from '../features/vendas/types';
import type { CaixaEntry, CaixaPendencia, CaixaPendenciaRecebimento } from '../features/caixa/types';
import type { Orcamento } from '../features/orcamentos/types';
import type { Cliente, PecaProcuradaResumo, ClienteMotoResumo } from '../features/clientes/types';
import type { FiadoRecebimento } from '../features/fiado/types';
import type { Envio } from '../features/frete/types';

const CACHE_TIME_MS = 5 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;
const READY_CACHE_KEY = 'rk_data_ready_v1';

interface DataReadyState {
  estoque: boolean;
  vendas: boolean;
  caixa: boolean;
}

function readReadyState(): DataReadyState {
  try {
    const cached = JSON.parse(localStorage.getItem(READY_CACHE_KEY) || '{}');
    return {
      estoque: cached.estoque ?? localStorage.getItem('rk_estoque_v2') !== null,
      vendas: cached.vendas ?? localStorage.getItem('rk_vendas') !== null,
      caixa: cached.caixa ?? localStorage.getItem('rk_caixa') !== null,
    };
  } catch {
    return { estoque: false, vendas: false, caixa: false };
  }
}

interface DataContextValue {
  estoque: Estoque[];
  vendas: Venda[];
  caixa: CaixaEntry[];
  orcamentos: Orcamento[];
  clientes: Cliente[];
  pecasProcuradas: PecaProcuradaResumo[];
  motosClientes: ClienteMotoResumo[];
  fiadoRecebimentos: FiadoRecebimento[];
  caixaPendencias: CaixaPendencia[];
  caixaPendenciaRecebimentos: CaixaPendenciaRecebimento[];
  envios: Envio[];
  loading: boolean;
  ready: DataReadyState;
  /** true até uma resposta atual do servidor confirmar o estoque desta sessão. */
  estoqueError: boolean;
  setEstoque: React.Dispatch<React.SetStateAction<Estoque[]>>;
  setVendas: React.Dispatch<React.SetStateAction<Venda[]>>;
  setCaixa: React.Dispatch<React.SetStateAction<CaixaEntry[]>>;
  setOrcamentos: React.Dispatch<React.SetStateAction<Orcamento[]>>;
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  setPecasProcuradas: React.Dispatch<React.SetStateAction<PecaProcuradaResumo[]>>;
  setMotosClientes: React.Dispatch<React.SetStateAction<ClienteMotoResumo[]>>;
  setFiadoRecebimentos: React.Dispatch<React.SetStateAction<FiadoRecebimento[]>>;
  setCaixaPendencias: React.Dispatch<React.SetStateAction<CaixaPendencia[]>>;
  setCaixaPendenciaRecebimentos: React.Dispatch<React.SetStateAction<CaixaPendenciaRecebimento[]>>;
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
  pecasProcuradas: [],
  motosClientes: [],
  fiadoRecebimentos: [],
  caixaPendencias: [],
  caixaPendenciaRecebimentos: [],
  envios: [],
  loading: false,
  ready: { estoque: false, vendas: false, caixa: false },
  estoqueError: false,
  setEstoque: () => {},
  setVendas: () => {},
  setCaixa: () => {},
  setOrcamentos: () => {},
  setClientes: () => {},
  setPecasProcuradas: () => {},
  setMotosClientes: () => {},
  setFiadoRecebimentos: () => {},
  setCaixaPendencias: () => {},
  setCaixaPendenciaRecebimentos: () => {},
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
  const [pecasProcuradas, setPecasProcuradas] = useState<PecaProcuradaResumo[]>(() => readCache('rk_pecas_procuradas', []));
  const [motosClientes, setMotosClientes] = useState<ClienteMotoResumo[]>(() => readCache('rk_motos_clientes', []));
  const [fiadoRecebimentos, setFiadoRecebimentos] = useState<FiadoRecebimento[]>(() => readCache('rk_fiado_recebimentos', []));
  const [caixaPendencias, setCaixaPendencias] = useState<CaixaPendencia[]>(() => readCache('rk_caixa_pendencias', []));
  const [caixaPendenciaRecebimentos, setCaixaPendenciaRecebimentos] = useState<CaixaPendenciaRecebimento[]>(() => readCache('rk_caixa_pendencia_recebimentos', []));
  const [envios, setEnvios] = useState<Envio[]>(() => readCache('rk_envios', []));
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState<DataReadyState>(readReadyState);
  const [estoqueError, setEstoqueError] = useState(true);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(true);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadDataRef = useRef<(force?: boolean, silent?: boolean) => Promise<void>>(async () => {});

  const markReady = (domain: keyof DataReadyState) => {
    setReady((current) => {
      if (current[domain]) return current;
      const next = { ...current, [domain]: true };
      try { localStorage.setItem(READY_CACHE_KEY, JSON.stringify(next)); } catch { /* cache opcional */ }
      return next;
    });
  };

  const loadData = async (force = false, silent = false) => {
    if (inFlightRef.current) {
      await inFlightRef.current;
      if (!force) return;
    }
    const task = (async () => {
    const now = Date.now();
    if (!force && !silent && now - lastFetchRef.current < CACHE_TIME_MS && estoque.length > 0) {
      return;
    }

    // Cada endpoint abaixo é gateado no backend pela permissão da sua tela
    // (ver exigirPermissao em src/server/routes/*). Buscar o que o usuário
    // não pode ver só renderia 403 a cada poll, então nem tenta: quem só
    // tem Tarefas, por exemplo, não dispara nada daqui (a aba busca os
    // próprios dados via useTarefas).
    const verEstoque = podeAtual('estoque.ver');
    const verVendas = podeAtual('vendas.ver');
    const verCaixa = podeAtual('caixa.ver');
    const verOrcamentos = podeAtual('orcamentos.ver');
    const verClientes = podeAtual('clientes.ver');
    const verFrete = podeAtual('frete.ver');

    if (!verEstoque && !verVendas && !verCaixa && !verOrcamentos && !verClientes && !verFrete) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);

    const vendasRequest = verVendas ? fetchWithRetry('/api/vendas') : Promise.resolve(null);
    const caixaRequest = verCaixa ? fetchWithRetry('/api/caixa') : Promise.resolve(null);
    const fiadoRequest = verCaixa ? fetchWithRetry('/api/fiado/recebimentos') : Promise.resolve(null);
    const pendenciasRequest = verCaixa ? fetchWithRetry('/api/caixa-pendencias') : Promise.resolve(null);
    const recebimentosPendenciaRequest = verCaixa ? fetchWithRetry('/api/caixa-pendencias/recebimentos') : Promise.resolve(null);

    // Vendas e caixa ficam prontos assim que suas próprias respostas chegam;
    // a lista grande do estoque não segura a primeira renderização dessas abas.
    if (verVendas) void vendasRequest.then(async (response) => {
      if (!response) return;
      const data = await parseJson(response.clone());
      if (data.success) {
        setVendas((prev) => applyIfChanged(prev, data.data, 'rk_vendas'));
        markReady('vendas');
      }
    }).catch((error) => console.error('Erro ao preparar cache de vendas:', error));

    if (verCaixa) void Promise.all([
      caixaRequest, fiadoRequest, pendenciasRequest, recebimentosPendenciaRequest,
    ].map(async (request) => {
      const response = await request;
      if (!response) throw new Error('Resposta financeira ausente.');
      const data = await parseJson(response.clone());
      if (!data.success) throw new Error(data.error || 'Falha ao sincronizar dados financeiros.');
      return data.data;
    })).then(([caixaData, fiadoData, pendenciasData, recebimentosData]) => {
      setCaixa((prev) => applyIfChanged(prev, caixaData, 'rk_caixa'));
      setFiadoRecebimentos((prev) => applyIfChanged(prev, fiadoData, 'rk_fiado_recebimentos'));
      setCaixaPendencias((prev) => applyIfChanged(prev, pendenciasData, 'rk_caixa_pendencias'));
      setCaixaPendenciaRecebimentos((prev) => applyIfChanged(prev, recebimentosData, 'rk_caixa_pendencia_recebimentos'));
      markReady('caixa');
    }).catch((error) => console.error('Erro ao preparar cache do Caixa:', error));

    const results = await Promise.allSettled([
      verEstoque ? fetchWithRetry('/api/estoque') : Promise.resolve(null),
      vendasRequest,
      caixaRequest,
      verOrcamentos ? fetchWithRetry('/api/orcamentos') : Promise.resolve(null),
      verClientes ? fetchWithRetry('/api/clientes?incluir_inativos=true') : Promise.resolve(null),
      verClientes ? fetchWithRetry('/api/clientes/pecas-procuradas/todas') : Promise.resolve(null),
      verClientes ? fetchWithRetry('/api/clientes/motos/todas') : Promise.resolve(null),
      fiadoRequest,
      pendenciasRequest,
      recebimentosPendenciaRequest,
      verFrete ? fetchWithRetry('/api/envios') : Promise.resolve(null),
    ]);

    const [
      estoqueRes,
      vendasRes,
      caixaRes,
      orcamentosRes,
      clientesRes,
      pecasProcuradasRes,
      motosClientesRes,
      fiadoRecebimentosRes,
      caixaPendenciasRes,
      caixaPendenciaRecebimentosRes,
      enviosRes,
    ] = results;

    // Sem permissão de ver estoque não há falha a reportar — só não há dado.
    let falhouEstoque = false;
    if (!verEstoque) {
      // nada a fazer
    } else if (estoqueRes.status === 'fulfilled' && estoqueRes.value) {
      try {
        const data = await parseJson(estoqueRes.value);
        if (data.success) {
          setEstoque(prev => applyIfChanged(prev, data.data, 'rk_estoque_v2'));
          markReady('estoque');
        } else {
          falhouEstoque = true;
        }
      } catch (e) {
        console.error('Erro ao processar estoque:', e);
        falhouEstoque = true;
      }
    } else {
      if (estoqueRes.status === 'rejected') console.error('Erro ao buscar estoque:', estoqueRes.reason);
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
        if (data.success) {
          setVendas(prev => applyIfChanged(prev, data.data, 'rk_vendas'));
          markReady('vendas');
        }
      } catch (e) {
        console.error('Erro ao processar vendas:', e);
      }
    } else if (vendasRes.status === 'rejected') {
      console.error('Erro ao buscar vendas:', vendasRes.reason);
    }

    if (caixaRes.status === 'fulfilled' && caixaRes.value) {
      try {
        const data = await parseJson(caixaRes.value);
        if (data.success) {
          setCaixa(prev => applyIfChanged(prev, data.data, 'rk_caixa'));
        }
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

    if (pecasProcuradasRes.status === 'fulfilled' && pecasProcuradasRes.value) {
      try {
        const data = await parseJson(pecasProcuradasRes.value);
        if (data.success) setPecasProcuradas(prev => applyIfChanged(prev, data.data, 'rk_pecas_procuradas'));
      } catch (e) {
        console.error('Erro ao processar peças procuradas:', e);
      }
    } else if (pecasProcuradasRes.status === 'rejected') {
      console.error('Erro ao buscar peças procuradas:', pecasProcuradasRes.reason);
    }

    if (motosClientesRes.status === 'fulfilled' && motosClientesRes.value) {
      try {
        const data = await parseJson(motosClientesRes.value);
        if (data.success) setMotosClientes(prev => applyIfChanged(prev, data.data, 'rk_motos_clientes'));
      } catch (e) {
        console.error('Erro ao processar motos de clientes:', e);
      }
    } else if (motosClientesRes.status === 'rejected') {
      console.error('Erro ao buscar motos de clientes:', motosClientesRes.reason);
    }

    if (fiadoRecebimentosRes.status === 'fulfilled' && fiadoRecebimentosRes.value) {
      try {
        const data = await parseJson(fiadoRecebimentosRes.value);
        if (data.success) setFiadoRecebimentos(prev => applyIfChanged(prev, data.data, 'rk_fiado_recebimentos'));
      } catch (e) {
        console.error('Erro ao processar baixas de fiado:', e);
      }
    } else if (fiadoRecebimentosRes.status === 'rejected') {
      console.error('Erro ao buscar baixas de fiado:', fiadoRecebimentosRes.reason);
    }

    if (caixaPendenciasRes.status === 'fulfilled' && caixaPendenciasRes.value) {
      try {
        const data = await parseJson(caixaPendenciasRes.value);
        if (data.success) setCaixaPendencias(prev => applyIfChanged(prev, data.data, 'rk_caixa_pendencias'));
      } catch (e) {
        console.error('Erro ao processar pendências de caixa:', e);
      }
    } else if (caixaPendenciasRes.status === 'rejected') {
      console.error('Erro ao buscar pendências de caixa:', caixaPendenciasRes.reason);
    }

    if (caixaPendenciaRecebimentosRes.status === 'fulfilled' && caixaPendenciaRecebimentosRes.value) {
      try {
        const data = await parseJson(caixaPendenciaRecebimentosRes.value);
        if (data.success) setCaixaPendenciaRecebimentos(prev => applyIfChanged(prev, data.data, 'rk_caixa_pendencia_recebimentos'));
      } catch (e) {
        console.error('Erro ao processar recebimentos de pendência de caixa:', e);
      }
    } else if (caixaPendenciaRecebimentosRes.status === 'rejected') {
      console.error('Erro ao buscar recebimentos de pendência de caixa:', caixaPendenciaRecebimentosRes.reason);
    }

    const respostasFinanceiras = [caixaRes, fiadoRecebimentosRes, caixaPendenciasRes, caixaPendenciaRecebimentosRes];
    if (respostasFinanceiras.every((resultado) => resultado.status === 'fulfilled' && resultado.value?.ok)) markReady('caixa');

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
    })();
    inFlightRef.current = task;
    try {
      await task;
    } finally {
      if (inFlightRef.current === task) inFlightRef.current = null;
    }
  };

  loadDataRef.current = loadData;
  const refreshData = useCallback(() => loadDataRef.current(true), []);

  useEffect(() => {
    const handlers: Record<string, (value: any) => void> = {
      rk_estoque_v2: setEstoque,
      rk_vendas: setVendas,
      rk_caixa: setCaixa,
      rk_orcamentos: setOrcamentos,
      rk_clientes: setClientes,
      rk_pecas_procuradas: setPecasProcuradas,
      rk_motos_clientes: setMotosClientes,
      rk_fiado_recebimentos: setFiadoRecebimentos,
      rk_caixa_pendencias: setCaixaPendencias,
      rk_caixa_pendencia_recebimentos: setCaixaPendenciaRecebimentos,
      rk_envios: setEnvios,
    };
    const sincronizarOutraAba = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || !event.key || event.newValue === null) return;
      try {
        const value = JSON.parse(event.newValue);
        if (event.key === READY_CACHE_KEY) setReady(value);
        else handlers[event.key]?.(value);
      } catch {
        // Uma cópia local inválida não deve interromper as atualizações do app.
      }
    };
    window.addEventListener('storage', sincronizarOutraAba);
    return () => window.removeEventListener('storage', sincronizarOutraAba);
  }, []);

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
        pecasProcuradas,
        motosClientes,
        fiadoRecebimentos,
        caixaPendencias,
        caixaPendenciaRecebimentos,
        envios,
        loading,
        ready,
        estoqueError,
        setEstoque,
        setVendas,
        setCaixa,
        setOrcamentos,
        setClientes,
        setPecasProcuradas,
        setMotosClientes,
        setFiadoRecebimentos,
        setCaixaPendencias,
        setCaixaPendenciaRecebimentos,
        setEnvios,
        refreshData,
        showSensitiveInfo,
        setShowSensitiveInfo,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
