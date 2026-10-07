import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, RefreshCw, UsersRound } from 'lucide-react';
import { Tooltip } from '../../../components/ui/beui-tooltip';
import { calcularSituacaoCliente } from '../operacaoModel';
import { ClientesMetricStrip, type ClientesMetricFilter } from './ClientesMetricStrip';
import type { ClienteOperacaoEntrada, ClienteOperacaoListaItem, ClientesResumoOperacional, PedidoBuscaOperacional } from '../operacaoTypes';

const ClientesMapa = lazy(() => import('../mapa/ClientesMapa').then((modulo) => ({ default: modulo.ClientesMapa })));

export interface ClientesPainelProps {
  resumo: ClientesResumoOperacional | null;
  itens: ClienteOperacaoListaItem[];
  loading?: boolean;
  capabilityUnavailable?: boolean;
  error?: string | null;
  onRetry: () => void;
  onSelectMetric: (filter: ClientesMetricFilter) => void;
  onSelectCliente: (clienteId: string) => void;
}

function pedidosDoCliente(item: ClienteOperacaoListaItem): PedidoBuscaOperacional[] {
  return (item.pedidos as Array<Record<string, unknown>>).flatMap((pedido) => {
    if (typeof pedido?.id !== 'string' || typeof pedido?.status !== 'string' || typeof pedido?.criado_em !== 'string') return [];
    return [{
      id: pedido.id,
      status: pedido.status as PedidoBuscaOperacional['status'],
      criadoEm: pedido.criado_em,
      descricao: typeof pedido.descricao === 'string' ? pedido.descricao : null,
      prometidoPara: typeof pedido.prometido_para === 'string' ? pedido.prometido_para : null,
      proximaAcaoEm: typeof pedido.proxima_acao_em === 'string' ? pedido.proxima_acao_em : null,
    }];
  });
}

function tempoDecorrido(data: string): string {
  const inicio = new Date(data).getTime();
  if (Number.isNaN(inicio)) return 'há algum tempo';
  const dias = Math.max(0, Math.floor((Date.now() - inicio) / 86_400_000));
  if (dias === 0) return 'hoje';
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

function entradaDoCliente(item: ClienteOperacaoListaItem): ClienteOperacaoEntrada {
  return { id: item.id, pedidos: pedidosDoCliente(item), visitas: [], reservas: [] };
}

export function ClientesPainel({ resumo, itens, loading = false, capabilityUnavailable = false, error = null, onRetry, onSelectMetric, onSelectCliente }: ClientesPainelProps) {
  if (loading && !resumo && itens.length === 0) {
    return <div aria-live="polite" className="rounded-card border border-border-default bg-surface-card p-8 text-sm text-text-muted">Carregando a operação de clientes…</div>;
  }

  if (error && !resumo && itens.length === 0) {
    return (
      <section role="alert" className="rounded-card border border-danger/30 bg-danger-bg p-5 text-sm text-text-primary">
        <div className="flex items-start gap-3"><AlertCircle aria-hidden="true" className="mt-0.5 text-danger" size={18} /><div><p className="font-semibold">Não foi possível carregar a central de clientes</p><p className="mt-1 text-text-muted">{error}</p><button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-control border border-danger/30 bg-surface-card px-3 font-semibold text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"><RefreshCw aria-hidden="true" size={15} />Tentar novamente</button></div></div>
      </section>
    );
  }

  if (capabilityUnavailable) {
    return (
      <section role="status" className="rounded-card border border-accent/20 bg-accent-soft-bg p-5 text-sm text-text-primary">
        <p className="font-semibold">Central de clientes sendo atualizada</p>
        <p className="mt-1 leading-5 text-text-secondary">O cadastro atual continua disponível. Os novos indicadores serão ativados quando a base operacional estiver pronta.</p>
        <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-control border border-accent/30 bg-surface-card px-3 font-semibold text-accent-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><RefreshCw aria-hidden="true" size={15} />Verificar novamente</button>
      </section>
    );
  }

  const agora = new Date();
  const clientesComEntrada = itens.map((item) => ({ item, entrada: entradaDoCliente(item) }));
  const situacoesPorCliente = new Map(clientesComEntrada.map(({ item, entrada }) => [item.id, calcularSituacaoCliente(entrada, agora)]));
  const listaRef = useRef<HTMLUListElement>(null);
  const [temMaisClientes, setTemMaisClientes] = useState(false);
  const [listaNoFim, setListaNoFim] = useState(false);

  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const atualizar = () => {
      setTemMaisClientes(lista.scrollHeight > lista.clientHeight + 1);
      setListaNoFim(lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 1);
    };
    atualizar();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(atualizar);
    observador.observe(lista);
    if (lista.firstElementChild) observador.observe(lista.firstElementChild);
    return () => observador.disconnect();
  }, [itens.length]);

  const clientesOrdenados = [...clientesComEntrada].sort((a, b) => {
    const situacaoA = situacoesPorCliente.get(a.item.id)!;
    const situacaoB = situacoesPorCliente.get(b.item.id)!;
    const ordem = { critico: 0, atencao: 1, informativo: 2, neutro: 3 } as const;
    return ordem[situacaoA.nivel] - ordem[situacaoB.nivel] || a.item.nome.localeCompare(b.item.nome, 'pt-BR');
  });

  return (
    <div className="space-y-6">
      {resumo ? <ClientesMetricStrip resumo={resumo} onSelect={onSelectMetric} /> : (
        <section role="status" className="rounded-card border border-accent/20 bg-accent-soft-bg px-4 py-3 text-sm text-text-primary sm:px-5">
          <p className="font-semibold">Indicadores operacionais indisponíveis</p>
          <p className="mt-1 text-text-secondary">A fila e o cadastro de clientes continuam disponíveis. Tente atualizar os indicadores mais tarde.</p>
        </section>
      )}
      {error ? <p aria-live="polite" className="text-sm text-danger">{error}</p> : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <section aria-labelledby="lista-clientes-title" className="rounded-card border border-border-default bg-surface-card shadow-[var(--elevation-1)] lg:h-[512px]">
          <div className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3 sm:px-5">
            <div>
              <h2 id="lista-clientes-title" className="text-lg font-semibold tracking-tight text-text-primary">Clientes</h2>
            </div>
            <span aria-live="polite" className="text-sm text-text-muted">{clientesOrdenados.length}</span>
          </div>
          {clientesOrdenados.length === 0 ? (
            <div className="px-5 py-10 text-center"><UsersRound aria-hidden="true" className="mx-auto text-text-faint" size={24} /><p className="mt-3 text-sm font-semibold text-text-primary">Nenhum cliente para exibir</p></div>
          ) : (
            <div className="relative">
            <ul ref={listaRef} aria-label="Lista de clientes" onScroll={(evento) => setListaNoFim(evento.currentTarget.scrollTop + evento.currentTarget.clientHeight >= evento.currentTarget.scrollHeight - 1)} className="max-h-[460px] divide-y divide-border-subtle overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {clientesOrdenados.map(({ item, entrada }) => {
                const situacao = situacoesPorCliente.get(item.id)!;
                const pedidosAtivos = entrada.pedidos.filter((pedido) => !['vendida', 'nao_encontrada', 'cliente_desistiu', 'cancelada', 'atendida'].includes(pedido.status));
                const motos = item.motos as Array<{ modelo_moto?: { nome?: string } | null; modelo_texto?: string | null; principal?: boolean }>;
                const motoPrincipal = motos.find((moto) => moto.principal) ?? motos[0];
                const nomeMoto = motoPrincipal?.modelo_moto?.nome || motoPrincipal?.modelo_texto || 'Moto não informada';
                const pedidoEmDestaque = [...pedidosAtivos].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())[0];
                const badges: Array<{ label: string; style: string }> = [];
                if (situacao.codigo.startsWith('visita_')) badges.push({ label: 'Visita', style: 'bg-accent-soft-bg text-accent-soft-fg' });
                if (situacao.nivel === 'critico' || situacao.nivel === 'atencao') badges.push({ label: 'Pendente', style: 'bg-warning/15 text-warning' });
                if (pedidosAtivos.length > 0) badges.push({ label: 'Com encomenda', style: 'bg-positive/10 text-positive' });
                if (badges.length === 0) badges.push({ label: 'Sem pendências', style: 'bg-surface-inset text-text-muted' });
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => onSelectCliente(item.id)} className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30 sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5"><strong className="max-w-full truncate text-sm text-text-primary">{item.nome}</strong>{badges.map((badge) => badge.label === 'Com encomenda' && pedidoEmDestaque ? (
                          <Tooltip key={badge.label} side="top" wrapperClassName="shrink-0" className="!border-slate-200 !bg-white !text-slate-900 !shadow-lg !backdrop-blur-none" content={<span><strong className="block">{pedidoEmDestaque.descricao || 'Peça em busca'}</strong><span className="block text-slate-600">{nomeMoto} · {tempoDecorrido(pedidoEmDestaque.criadoEm)}</span></span>}>
                            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ${badge.style}`}>{badge.label}</span>
                          </Tooltip>
                        ) : <span key={badge.label} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ${badge.style}`}>{badge.label}</span>)}</span>
                        <span className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-text-muted"><span className="truncate">{nomeMoto}</span>{motos.length > 1 ? <span className="shrink-0">+{motos.length - 1}</span> : null}</span>
                      </span>
                      <ArrowRight aria-hidden="true" className="shrink-0 text-text-faint" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {temMaisClientes && !listaNoFim ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-surface-card to-transparent" /> : null}
            </div>
          )}
        </section>
        <Suspense fallback={<section aria-live="polite" className="min-h-[470px] rounded-card border border-border-default bg-surface-card p-5 text-sm text-text-muted shadow-[var(--elevation-1)]">Carregando mapa de clientes…</section>}>
          <ClientesMapa itens={itens} situacoesPorCliente={situacoesPorCliente} onSelectCliente={onSelectCliente} />
        </Suspense>
      </div>
    </div>
  );
}
