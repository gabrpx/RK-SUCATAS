import { useCallback, useEffect, useRef, useState } from 'react';
import { clientesApi } from './api';
import type { Cliente } from './types';
import type { ClienteOperacaoListaItem, ClientesOperacaoFiltros, ClientesResumoOperacional } from './operacaoTypes';

export interface ClientesOperacaoState {
  resumo: ClientesResumoOperacional | null;
  itens: ClienteOperacaoListaItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  capabilityUnavailable: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const FILTROS_VAZIOS: ClientesOperacaoFiltros = {};

function paraItemOperacional(cliente: Cliente): ClienteOperacaoListaItem {
  return {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    instagram_usuario: cliente.instagram_usuario ?? null,
    preferencia_contato: cliente.preferencia_contato,
    origem: cliente.origem,
    cidade: cliente.cidade,
    estado: cliente.estado,
    ativo: cliente.ativo,
    banido: cliente.banido,
    criado_em: cliente.criado_em,
    atualizado_em: cliente.atualizado_em,
    motos: cliente.motos ?? [],
    pedidos: cliente.pecas_procuradas ?? [],
  };
}

export function useClientesOperacao(filtros: ClientesOperacaoFiltros = FILTROS_VAZIOS): ClientesOperacaoState {
  const [resumo, setResumo] = useState<ClientesResumoOperacional | null>(null);
  const [itens, setItens] = useState<ClienteOperacaoListaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [proximoCursor, setProximoCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      // A lista principal e o resumo são independentes. O resumo não pode
      // atrasar a exibição dos clientes quando estiver lento ou indisponível.
      const resumoPromise = clientesApi.resumoOperacional().catch(() => null);
      let erroLista: Error | null = null;
      let usouCadastro = false;
      try {
        const listaResult = await clientesApi.listarOperacao({ ...filtros, limit: filtros.limit ?? 50 });
        if (!listaResult.success) throw new Error(listaResult.error || 'Não foi possível carregar os clientes.');
        if (request !== requestRef.current) return;
        setItens(listaResult.data.itens);
        setProximoCursor(listaResult.data.proximo_cursor);
        setLoading(false);
      } catch (erro) {
        erroLista = erro instanceof Error ? erro : new Error('Não foi possível carregar os clientes.');
        // A consulta operacional pode falhar mesmo com o cadastro básico
        // disponível. Não deixe a tela vazia por causa de um recurso auxiliar.
        try {
          const cadastroResult = await clientesApi.listar(true);
          if (!cadastroResult.success) throw new Error(cadastroResult.error || 'Não foi possível carregar os clientes.');
          if (request !== requestRef.current) return;
          setItens(cadastroResult.data.map(paraItemOperacional));
          setProximoCursor(null);
          setLoading(false);
          usouCadastro = true;
        } catch {
          // O erro original é apresentado depois do resumo, caso ambos falhem.
        }
      }

      const resumoResult = await resumoPromise;
      if (request !== requestRef.current) return;
      const resumoData = resumoResult?.success ? resumoResult.data : null;
      setResumo(resumoData);
      const indisponivel = resumoData !== null && !resumoData.capabilities.base;
      setCapabilityUnavailable(indisponivel);
      if (indisponivel && !usouCadastro) {
        const cadastroResult = await clientesApi.listar(true);
        if (!cadastroResult.success) throw new Error(cadastroResult.error || 'Não foi possível carregar os clientes.');
        if (request !== requestRef.current) return;
        setItens(cadastroResult.data.map(paraItemOperacional));
        setProximoCursor(null);
      } else if (erroLista && !usouCadastro) {
        throw erroLista;
      }
    } catch (erro) {
      if (request !== requestRef.current) return;
      setError(erro instanceof Error ? erro.message : 'Não foi possível carregar a central de clientes.');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filtros]);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!proximoCursor || loadingMore) return;
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const listaResult = await clientesApi.listarOperacao({ ...filtros, limit: filtros.limit ?? 50, cursor: proximoCursor });
      if (!listaResult.success) throw new Error(listaResult.error || 'Não foi possível carregar mais clientes.');
      if (request !== requestRef.current) return;
      setItens((atuais) => {
        const porId = new Map(atuais.map((item) => [item.id, item]));
        for (const item of listaResult.data.itens) porId.set(item.id, item);
        return [...porId.values()];
      });
      setProximoCursor(listaResult.data.proximo_cursor);
    } catch (erro) {
      if (request === requestRef.current) setError(erro instanceof Error ? erro.message : 'Não foi possível carregar mais clientes.');
    } finally {
      if (request === requestRef.current) setLoadingMore(false);
    }
  }, [filtros, loadingMore, proximoCursor]);

  return { resumo, itens, loading, loadingMore, hasMore: proximoCursor !== null, error, capabilityUnavailable, refresh, loadMore };
}
