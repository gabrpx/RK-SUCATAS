// Lista de revisão da sincronização com o Mercado Livre — o coração da
// Feature A. Substitui o antigo "clica e já aplica": agora todo ponto de
// entrada (botão da aba Mercado Livre, toast de venda cancelada, toast de
// orçamento convertido) abre esta mesma lista, com o preço atual no ML vs.
// o novo calculado (sistema + margem) lado a lado, e nada é escrito até o
// usuário selecionar as checkboxes e confirmar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '../../utils';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { aviso } from '../../components/ui/toast';
import { useData } from '../../context/DataContext';
import { mercadolivreApi } from './api';
import type { AnuncioParaSincronizar } from './types';

const formatCurrency = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

interface Grupo {
  estoqueId: string;
  estoqueNome: string;
  anuncios: AnuncioParaSincronizar[];
}

export interface SincronizacaoModalProps {
  aberto: boolean;
  focoEstoqueIds?: string[];
  onFechar: () => void;
}

export function SincronizacaoModal({ aberto, focoEstoqueIds, onFechar }: SincronizacaoModalProps) {
  const { refreshData } = useData();
  const [carregando, setCarregando] = useState(true);
  const [anuncios, setAnuncios] = useState<AnuncioParaSincronizar[]>([]);
  const [margem, setMargem] = useState(30);
  const [salvandoMargem, setSalvandoMargem] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [aplicando, setAplicando] = useState(false);
  const grupoFocoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setSelecionados(new Set());
      try {
        const resultado = await mercadolivreApi.buscarPreviewSincronizacao();
        if (cancelado) return;
        if (resultado.success && resultado.data) {
          setAnuncios(resultado.data.anuncios);
          setMargem(resultado.data.margemPercentual);
        } else {
          aviso.falha(resultado.error, 'Não deu pra carregar os anúncios');
        }
      } catch (err) {
        if (!cancelado) aviso.falha(err, 'Não deu pra carregar os anúncios');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [aberto]);

  // Recalcula o preço novo ao vivo com a margem digitada, sem nova chamada
  // de rede — precoEfetivoSistema (já com promoção) veio pronto no preview.
  const anunciosComMargem = useMemo(
    () =>
      anuncios.map((a) => {
        const precoNovoSistema = arredondarCentavos(a.precoEfetivoSistema * (1 + margem / 100));
        const mudaPreco = a.disponivelNoMl && Math.round(precoNovoSistema * 100) !== Math.round((a.precoAtualMl ?? 0) * 100);
        const semAlteracao = a.disponivelNoMl && !mudaPreco && !a.mudaQuantidade && !a.mudaStatus;
        return { ...a, precoNovoSistema, mudaPreco, semAlteracao };
      }),
    [anuncios, margem]
  );

  const grupos = useMemo<Grupo[]>(() => {
    const porItem = new Map<string, Grupo>();
    for (const anuncio of anunciosComMargem) {
      const grupo = porItem.get(anuncio.estoqueId) ?? { estoqueId: anuncio.estoqueId, estoqueNome: anuncio.estoqueNome, anuncios: [] };
      grupo.anuncios.push(anuncio);
      porItem.set(anuncio.estoqueId, grupo);
    }
    return Array.from(porItem.values());
  }, [anunciosComMargem]);

  // Só o PRIMEIRO grupo focado vira alvo de scroll — os outros ainda ganham
  // o destaque visual, mas só um elemento pode segurar a ref de scroll.
  const primeiroGrupoFocoId = useMemo(() => {
    if (!focoEstoqueIds?.length) return null;
    return grupos.find((g) => focoEstoqueIds.includes(g.estoqueId))?.estoqueId ?? null;
  }, [grupos, focoEstoqueIds]);

  useEffect(() => {
    if (!aberto || carregando || !primeiroGrupoFocoId) return;
    const id = setTimeout(() => grupoFocoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    return () => clearTimeout(id);
  }, [aberto, carregando, primeiroGrupoFocoId]);

  const disponiveisIds = useMemo(() => anunciosComMargem.filter((a) => a.disponivelNoMl).map((a) => a.linkId), [anunciosComMargem]);
  const todosSelecionados = disponiveisIds.length > 0 && disponiveisIds.every((id) => selecionados.has(id));

  const alternarSelecao = (linkId: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(linkId)) novo.delete(linkId);
      else novo.add(linkId);
      return novo;
    });
  };

  const alternarTodos = () => setSelecionados(todosSelecionados ? new Set() : new Set(disponiveisIds));

  const salvarMargemPadrao = async () => {
    setSalvandoMargem(true);
    try {
      const resultado = await mercadolivreApi.atualizarConfiguracao(margem);
      if (!resultado.success) throw new Error(resultado.error);
      aviso.sucesso('Margem padrão atualizada');
    } catch (err) {
      aviso.falha(err, 'Não deu pra salvar a margem');
    } finally {
      setSalvandoMargem(false);
    }
  };

  const aplicar = async () => {
    if (selecionados.size === 0) return;
    setAplicando(true);
    try {
      const resultado = await mercadolivreApi.aplicarSincronizacao([...selecionados]);
      if (resultado.success && resultado.data) {
        const { sincronizados, erros, indisponiveis, semAlteracao } = resultado.data;
        if (erros.length > 0) {
          aviso.atencao(`${sincronizados} anúncio(s) atualizado(s), ${erros.length} com erro`, {
            descricao: erros
              .slice(0, 2)
              .map((e) => `${e.estoqueNome}: ${e.error}`)
              .join(' · '),
          });
        } else {
          const extras = [indisponiveis > 0 ? `${indisponiveis} indisponível(is)` : null, semAlteracao > 0 ? `${semAlteracao} sem alteração` : null].filter(Boolean);
          aviso.sucesso(`${sincronizados} anúncio(s) atualizado(s) no Mercado Livre`, extras.length > 0 ? { descricao: extras.join(' · ') } : undefined);
        }
        onFechar();
        await refreshData();
      } else {
        aviso.falha(resultado.error, 'Não deu pra aplicar a sincronização');
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra aplicar a sincronização');
    } finally {
      setAplicando(false);
    }
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Sincronizar com o Mercado Livre"
      subtitulo={!carregando && anuncios.length > 0 ? `${anuncios.length} anúncio(s) vinculado(s)` : undefined}
      icone={RefreshCw}
      tamanho="lg"
      rodape={
        !carregando && anuncios.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={alternarTodos} className="text-xs font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80">
              {todosSelecionados ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando || selecionados.size === 0}
              className="h-10 px-4 rounded-control bg-accent text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {aplicando && <Loader2 size={14} className="animate-spin" />}
              Aplicar {selecionados.size > 0 ? `(${selecionados.size})` : ''}
            </button>
          </div>
        ) : undefined
      }
    >
      {carregando ? (
        <div className="py-10 flex items-center justify-center text-text-faint">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : anuncios.length === 0 ? (
        <EmptyState icone={RefreshCw} mensagem="Nenhuma peça com anúncio do Mercado Livre vinculado ainda." />
      ) : (
        <div className="space-y-5">
          <ModalSection
            titulo="Margem sobre o preço do sistema"
            descricao="Compensação das taxas do Mercado Livre, aplicada em cima do preço efetivo de cada peça (já com promoção, se houver)."
          >
            <div className="flex items-center gap-3">
              <div className="relative w-28">
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={margem}
                  onChange={(e) => setMargem(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full h-10 rounded-control border border-border-default bg-surface-inset px-3 pr-7 text-sm text-text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-faint">%</span>
              </div>
              <button
                type="button"
                onClick={salvarMargemPadrao}
                disabled={salvandoMargem}
                className="h-10 px-3 rounded-control border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-raised disabled:opacity-50 flex items-center gap-1.5"
              >
                {salvandoMargem && <Loader2 size={13} className="animate-spin" />}
                Salvar como padrão
              </button>
            </div>
          </ModalSection>

          <div className="space-y-3">
            {grupos.map((grupo) => {
              const emFoco = focoEstoqueIds?.includes(grupo.estoqueId);
              return (
                <div
                  key={grupo.estoqueId}
                  ref={grupo.estoqueId === primeiroGrupoFocoId ? grupoFocoRef : undefined}
                  className={cn('rounded-control border p-3', emFoco ? 'border-accent/50 bg-accent-soft-bg/20' : 'border-border-subtle')}
                >
                  <p className="text-sm font-medium text-text-primary mb-2">{grupo.estoqueNome}</p>
                  <div className="space-y-2">
                    {grupo.anuncios.map((anuncio) => (
                      <label
                        key={anuncio.linkId}
                        className={cn(
                          'flex items-center gap-3 p-2.5 rounded-control border border-border-subtle bg-surface-inset',
                          !anuncio.disponivelNoMl ? 'opacity-60' : 'cursor-pointer hover:bg-surface-raised'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selecionados.has(anuncio.linkId)}
                          disabled={!anuncio.disponivelNoMl}
                          onChange={() => alternarSelecao(anuncio.linkId)}
                          className="shrink-0 size-4 accent-[var(--accent)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-faint">{anuncio.mlbId}</span>
                            <a
                              href={anuncio.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              onClick={(e) => e.stopPropagation()}
                              className="text-text-faint hover:text-accent-soft-fg"
                            >
                              <ExternalLink size={11} />
                            </a>
                          </div>
                          {!anuncio.disponivelNoMl ? (
                            <p className="text-xs text-warning mt-0.5">Anúncio não encontrado no Mercado Livre</p>
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-text-faint line-through tabular-nums">{formatCurrency(anuncio.precoAtualMl ?? 0)}</span>
                              <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(anuncio.precoNovoSistema)}</span>
                              {anuncio.mudaQuantidade && (
                                <span className="text-[11px] text-text-faint">
                                  · qtd {anuncio.quantidadeAtualMl} → {anuncio.quantidadeNovaSistema}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {anuncio.fechado ? (
                          <StatusBadge texto="Encerrado" tom="danger" />
                        ) : anuncio.semAlteracao ? (
                          <StatusBadge texto="Sem alteração" tom="neutral" />
                        ) : anuncio.disponivelNoMl ? (
                          <StatusBadge texto="Vai atualizar" tom="positive" />
                        ) : null}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
