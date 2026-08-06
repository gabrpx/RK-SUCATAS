// Aba Mercado Livre — conexão OAuth, reputação da conta, sincronização manual
// de preço/estoque dos anúncios, importação de pedidos pra Vendas, central de
// perguntas e o painel de anúncios sem peça vinculada no estoque. Nada aqui
// muda o anúncio real no Mercado Livre sem um clique explícito — a única
// coisa que roda sozinha em segundo plano é a detecção de pedido/pergunta
// novos (src/services/mercadolivreScheduler.ts), que só lê e nunca escreve.
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  type LucideIcon,
  Store,
  Loader2,
  ExternalLink,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Unlink,
  RefreshCw,
  PackageSearch,
  HelpCircle,
  Link2,
  Link2Off,
  Send,
  Search,
  Copy,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../utils';
import { aviso } from '../../components/ui/toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { MetricCard, type MetricTone } from '../../components/ui/MetricCard';
import { AlertBar } from '../../components/ui/AlertBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useData } from '../../context/DataContext';
import { SeletorCliente } from '../clientes/SeletorCliente';
import { useSincronizacaoMl } from './SincronizacaoMlContext';
import { mercadolivreApi, type MercadoLivreConta } from './api';
import { estoqueApi } from '../estoque/api';
import { calcularAlertasReputacao, type TipoAlertaReputacao } from './alertas';
import type { PedidoPreview, ImportarPedidoItemInput, PerguntaPreview, AnuncioOrfaoML, ContagemPendencias, GrupoAnuncioDuplicado, ItemAnuncioDuplicado } from './types';

// Erros que o callback do backend pode mandar de volta na query string —
// texto amigável pra cada um, o resto cai no genérico.
const MENSAGENS_ERRO: Record<string, string> = {
  estado_invalido: 'O login expirou ou foi aberto de outra aba. Tente conectar de novo.',
  troca_token: 'O Mercado Livre recusou a autorização. Tente conectar de novo.',
};

// Cor por SIGNIFICADO (positiva/neutra/negativa), nunca decorativa — mesma
// regra de CLAUDE.md > Design system. Ordem fixa: positivo, neutro, negativo.
const CORES_AVALIACAO = { positivo: 'var(--positive)', neutro: 'var(--text-muted)', negativo: 'var(--negative)' };

// Cada tipo de alerta de reputação aponta pro mesmo ícone que a métrica
// correspondente já usa no grid de cards, pra manter a leitura consistente.
const ALERTA_ICONE: Record<TipoAlertaReputacao, LucideIcon> = {
  claims: AlertTriangle,
  delayed_handling_time: Clock,
  cancellations: XCircle,
};

const pct = (n: number | undefined) => (n != null ? `${Math.round(n * 100)}%` : '—');

const formatCurrency = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

// A API do Mercado Livre devolve o período em inglês ("365 days") — o resto
// da tela é todo em português, então traduz só esse pedaço.
const periodoPt = (periodo: string) => periodo.replace(/(\d+)\s*days?/i, '$1 dias');

// Tooltip custom do donut: card no estilo do design system em vez do balão
// padrão do Recharts.
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-border-default bg-surface-raised px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wide text-text-faint mb-1">{payload[0].name}</p>
      <p className="text-sm font-medium text-text-primary">{pct(payload[0].value)}</p>
    </div>
  );
}

export function MercadoLivreView() {
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [confirmandoDesconexao, setConfirmandoDesconexao] = useState(false);
  const [conta, setConta] = useState<MercadoLivreConta | null>(null);
  const [pendencias, setPendencias] = useState<ContagemPendencias | null>(null);
  const { abrir: abrirSincronizacao } = useSincronizacaoMl();
  const pedidosRef = useRef<HTMLDivElement>(null);

  const carregarStatus = async () => {
    setCarregando(true);
    try {
      const status = await mercadolivreApi.status();
      if (!status.conectado) {
        setConta(null);
        return;
      }
      const resultado = await mercadolivreApi.dadosConta();
      if (resultado.success && resultado.data) setConta(resultado.data);
      else {
        setConta(null);
        aviso.falha(resultado.error, 'Não deu pra carregar os dados da conta');
      }
    } catch (err) {
      aviso.falha(err, 'Erro ao verificar conexão com o Mercado Livre');
    } finally {
      setCarregando(false);
    }
  };

  // Indicador leve de pendências (pedidos novos) — contagem ao vivo, só pra
  // dar um empurrão pra abrir a seção certa sem precisar clicar "Buscar".
  const carregarPendencias = async () => {
    try {
      const resultado = await mercadolivreApi.buscarPendencias();
      if (resultado.success && resultado.data) setPendencias(resultado.data);
    } catch {
      // indicador passivo — falha aqui não merece toast, só fica sem contagem
    }
  };

  useEffect(() => {
    if (!conta) {
      setPendencias(null);
      return;
    }
    carregarPendencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conta]);

  // Trata o retorno do login (?conectado=1 / ?ml_erro=...) que o callback do
  // backend anexa na URL, e já limpa a query string pra não repetir o toast
  // se a pessoa der F5.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const erro = params.get('ml_erro');
    const conectado = params.get('conectado');

    if (erro) aviso.falha(MENSAGENS_ERRO[erro] ?? 'Não deu pra conectar com o Mercado Livre', 'Falha na conexão');
    else if (conectado) aviso.sucesso('Conta do Mercado Livre conectada');

    if (erro || conectado) window.history.replaceState(null, '', window.location.pathname);

    carregarStatus();
  }, []);

  const conectar = async () => {
    setConectando(true);
    try {
      const resultado = await mercadolivreApi.iniciarLogin();
      if (resultado.success && resultado.url) {
        window.location.href = resultado.url;
      } else {
        aviso.falha(resultado.error, 'Não deu pra iniciar o login');
        setConectando(false);
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra iniciar o login');
      setConectando(false);
    }
  };

  const desconectar = async () => {
    if (!confirmandoDesconexao) {
      setConfirmandoDesconexao(true);
      return;
    }
    setDesconectando(true);
    try {
      const resultado = await mercadolivreApi.desconectar();
      if (resultado.success) {
        setConta(null);
        aviso.sucesso('Conta desconectada');
      } else {
        aviso.falha(resultado.error, 'Não deu pra desconectar');
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra desconectar');
    } finally {
      setDesconectando(false);
      setConfirmandoDesconexao(false);
    }
  };

  const nomeExibicao = [conta?.first_name, conta?.last_name].filter(Boolean).join(' ') || conta?.nickname;
  const reputacao = conta?.seller_reputation;
  const transacoes = reputacao?.transactions;
  const metrics = reputacao?.metrics;
  const alertasReputacao = calcularAlertasReputacao(conta);

  // Tom por resultado: taxa oficial 0 é positivo (é o que conta pro nível da
  // conta), qualquer taxa acima de 0 é negativo — não existe "neutro" aqui
  // porque toda reclamação/atraso/cancelamento é, por definição, algo ruim.
  const tomPorTaxa = (rate: number | undefined): MetricTone => (rate ? 'negative' : 'positive');

  const ratingsData = transacoes?.ratings
    ? [
        { name: 'Positivas', value: transacoes.ratings.positive, cor: CORES_AVALIACAO.positivo },
        { name: 'Neutras', value: transacoes.ratings.neutral, cor: CORES_AVALIACAO.neutro },
        { name: 'Negativas', value: transacoes.ratings.negative, cor: CORES_AVALIACAO.negativo },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-5 pb-24 md:pb-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-medium text-text-primary">Mercado Livre</h1>
        <p className="text-sm text-text-faint mt-0.5">Conta conectada, reputação, pedidos, perguntas e anúncios num só lugar</p>
      </div>

      <div className="rounded-card border border-border-subtle bg-surface-card p-5">
        {carregando ? (
          <div className="py-10 flex items-center justify-center text-text-faint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !conta ? (
          <EmptyState
            icone={Store}
            mensagem="Conecte a conta do Mercado Livre da loja pra ver os dados da página, os anúncios e o resto dos módulos."
            acaoLabel={conectando ? 'Abrindo o Mercado Livre...' : 'Conectar com Mercado Livre'}
            onAcao={conectando ? undefined : conectar}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-11 rounded-control bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center shrink-0">
                  <Store size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-medium text-text-primary truncate">{nomeExibicao}</p>
                  <p className="text-xs text-text-faint truncate">@{conta.nickname}</p>
                </div>
              </div>
              {conta.permalink && (
                <a
                  href={conta.permalink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 h-9 px-3 rounded-control border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-raised flex items-center gap-1.5"
                >
                  Ver página <ExternalLink size={13} />
                </a>
              )}
            </div>

            {alertasReputacao.length > 0 && (
              <div className="space-y-2">
                {alertasReputacao.map((alerta) => (
                  <div key={alerta.tipo}>
                    <AlertBar
                      tom="negative"
                      icone={ALERTA_ICONE[alerta.tipo]}
                      mensagem={alerta.mensagem}
                      acaoLabel="Ver pedidos"
                      onAcao={() => pedidosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    />
                  </div>
                ))}
              </div>
            )}

            {reputacao && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricCard icone={Award} label="Nível" valor={reputacao.level_id?.replace(/^\d_/, '') ?? '—'} tom="neutral" />
                <MetricCard
                  icone={CheckCircle2}
                  label="Vendas concluídas"
                  valor={String(transacoes?.completed ?? 0)}
                  contexto={transacoes?.total ? `de ${transacoes.total} no histórico` : undefined}
                  tom="positive"
                />
                <MetricCard
                  icone={XCircle}
                  label="Vendas canceladas"
                  valor={String(transacoes?.canceled ?? 0)}
                  contexto={transacoes?.total ? `${Math.round(((transacoes.canceled ?? 0) / transacoes.total) * 100)}% do histórico` : undefined}
                  tom={transacoes?.canceled ? 'negative' : 'positive'}
                />
                {metrics?.claims && (
                  <MetricCard
                    icone={AlertTriangle}
                    label={`Reclamações (${periodoPt(metrics.claims.period)})`}
                    valor={pct(metrics.claims.rate)}
                    contexto={metrics.claims.excluded?.real_value ? `${metrics.claims.excluded.real_value} registrada(s) ao todo` : undefined}
                    tom={tomPorTaxa(metrics.claims.rate)}
                  />
                )}
                {metrics?.delayed_handling_time && (
                  <MetricCard
                    icone={Clock}
                    label={`Atraso no envio (${periodoPt(metrics.delayed_handling_time.period)})`}
                    valor={pct(metrics.delayed_handling_time.rate)}
                    contexto={metrics.delayed_handling_time.excluded?.real_value ? `${metrics.delayed_handling_time.excluded.real_value} pedido(s) ao todo` : undefined}
                    tom={tomPorTaxa(metrics.delayed_handling_time.rate)}
                  />
                )}
                {metrics?.cancellations && (
                  <MetricCard
                    icone={XCircle}
                    label={`Cancelamentos (${periodoPt(metrics.cancellations.period)})`}
                    valor={pct(metrics.cancellations.rate)}
                    contexto={metrics.cancellations.excluded?.real_value ? `${metrics.cancellations.excluded.real_value} ao todo` : undefined}
                    tom={tomPorTaxa(metrics.cancellations.rate)}
                  />
                )}
              </div>
            )}

            {ratingsData.length > 0 && (
              <div className="rounded-control border border-border-subtle bg-surface-inset p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mb-3">Avaliações dos compradores</p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width={160} height={160} className="shrink-0">
                    <PieChart>
                      <Pie data={ratingsData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3} stroke="none">
                        {ratingsData.map((entry) => (
                          <Cell key={entry.name} fill={entry.cor} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Legenda em lista — nunca flutuante sobre o gráfico */}
                  <ul className="flex-1 w-full space-y-2">
                    {ratingsData.map((entry) => (
                      <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0 text-text-secondary">
                          <span className="size-2 rounded-full shrink-0" style={{ background: entry.cor }} />
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="text-text-primary font-medium shrink-0">{pct(entry.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => abrirSincronizacao()}
                className="shrink-0 h-9 px-3 rounded-control border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-raised flex items-center gap-1.5"
              >
                <RefreshCw size={13} />
                Sincronizar preços e estoque
              </button>
              <button
                type="button"
                onClick={desconectar}
                disabled={desconectando}
                className="shrink-0 h-9 px-3 rounded-control border border-border-default text-xs font-medium text-danger hover:bg-danger-bg flex items-center gap-1.5 disabled:opacity-50"
              >
                {desconectando ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
                {confirmandoDesconexao ? 'Confirmar desconexão' : 'Desconectar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {conta && (
        <>
          <div ref={pedidosRef}>
            <SecaoPedidos pedidosNovos={pendencias?.pedidosNovos ?? 0} onAtualizarPendencias={carregarPendencias} />
          </div>
          <SecaoPerguntas onAtualizarPendencias={carregarPendencias} />
          <SecaoAnunciosOrfaos />
          <SecaoAnunciosDuplicados />
        </>
      )}
    </div>
  );
}

// Feature 2 — busca pedidos pagos recentes e importa como venda, com preview
// e confirmação manual (nunca grava nada sem o clique de "Importar").
function SecaoPedidos({ pedidosNovos, onAtualizarPendencias }: { pedidosNovos: number; onAtualizarPendencias: () => void }) {
  const { refreshData } = useData();
  const { formasPagamento } = useCatalogos();
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoPreview[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [importando, setImportando] = useState(false);
  // Vínculo manual com um cliente cadastrado, por pedido — nunca automático
  // (nickname/id do ML não são casados sozinhos com nenhum cadastro).
  const [vinculoCliente, setVinculoCliente] = useState<Record<string, { clienteId: string | null; nome: string }>>({});

  const buscarPedidos = async () => {
    setBuscando(true);
    try {
      const resultado = await mercadolivreApi.buscarPedidosNovos(30);
      if (resultado.success && resultado.data) {
        setPedidos(resultado.data);
        const encontrados = new Set<string>();
        const vinculos: Record<string, { clienteId: string | null; nome: string }> = {};
        resultado.data.forEach((pedido) => {
          vinculos[pedido.mlOrderId] = { clienteId: null, nome: pedido.comprador ?? '' };
          pedido.itens.forEach((item) => {
            if (item.status === 'encontrado') encontrados.add(`${pedido.mlOrderId}:${item.mlItemId}`);
          });
        });
        setSelecionados(encontrados);
        setVinculoCliente(vinculos);
        setAberto(true);
      } else {
        aviso.falha(resultado.error, 'Não deu pra buscar os pedidos');
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra buscar os pedidos');
    } finally {
      setBuscando(false);
    }
  };

  const alternarSelecao = (chave: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  };

  const confirmarImportacao = async () => {
    if (selecionados.size === 0 || !formaPagamentoId) return;

    const itens: ImportarPedidoItemInput[] = [];
    for (const pedido of pedidos) {
      for (const item of pedido.itens) {
        const chave = `${pedido.mlOrderId}:${item.mlItemId}`;
        if (!selecionados.has(chave) || item.status !== 'encontrado' || !item.estoqueIdSugerido) continue;
        const vinculo = vinculoCliente[pedido.mlOrderId];
        itens.push({
          estoque_id: item.estoqueIdSugerido,
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          forma_pagamento_id: formaPagamentoId,
          cliente_nome: vinculo?.nome || pedido.comprador,
          cliente_id: vinculo?.clienteId ?? null,
          data: pedido.dataCriacao,
          ml_order_id: pedido.mlOrderId,
          ml_item_id: item.mlItemId,
          ml_shipping_id: pedido.shippingId,
        });
      }
    }
    if (itens.length === 0) return;

    setImportando(true);
    try {
      const resultado = await mercadolivreApi.importarPedidos(itens);
      if (resultado.success && resultado.data) {
        const { sucesso, pulados, falhas } = resultado.data;
        if (falhas.length > 0) {
          aviso.atencao(`${sucesso} venda(s) importada(s), ${falhas.length} falharam`, {
            descricao: falhas
              .slice(0, 2)
              .map((f) => f.error)
              .join(' · '),
          });
        } else {
          aviso.sucesso(`${sucesso} venda(s) importada(s)${pulados > 0 ? `, ${pulados} já estava(m) importada(s)` : ''}`);
        }
        setAberto(false);
        await refreshData();
        onAtualizarPendencias();
      } else {
        aviso.falha(resultado.error, 'Não deu pra importar os pedidos');
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra importar os pedidos');
    } finally {
      setImportando(false);
    }
  };

  const totalItensEncontrados = pedidos.reduce((acc, p) => acc + p.itens.filter((i) => i.status === 'encontrado').length, 0);

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-control bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center shrink-0">
            <PackageSearch size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">Pedidos do Mercado Livre</p>
            <p className="text-xs text-text-faint">
              {pedidosNovos > 0 ? `${pedidosNovos} pedido(s) pago(s) aguardando revisão` : 'Traga vendas feitas no Mercado Livre pra dentro do sistema'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={buscarPedidos}
          disabled={buscando}
          className="shrink-0 h-9 px-3 rounded-control border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-raised flex items-center gap-1.5 disabled:opacity-50"
        >
          {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar pedidos novos
        </button>
      </div>

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Importar pedidos do Mercado Livre"
        subtitulo={pedidos.length > 0 ? `${pedidos.length} pedido(s) · ${totalItensEncontrados} item(ns) encontrado(s) no estoque` : undefined}
        icone={PackageSearch}
        tamanho="lg"
        rodape={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <select
              value={formaPagamentoId}
              onChange={(e) => setFormaPagamentoId(e.target.value)}
              className="h-10 rounded-control border border-border-default bg-surface-card px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent"
            >
              <option value="">Forma de pagamento...</option>
              {formasPagamento.map((forma) => (
                <option key={forma.id} value={forma.id}>
                  {forma.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={confirmarImportacao}
              disabled={importando || selecionados.size === 0 || !formaPagamentoId}
              className="h-10 px-4 rounded-control bg-accent text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importando && <Loader2 size={14} className="animate-spin" />}
              Importar {selecionados.size > 0 ? `(${selecionados.size})` : ''}
            </button>
          </div>
        }
      >
        {pedidos.length === 0 ? (
          <EmptyState icone={PackageSearch} mensagem="Nenhum pedido pago nos últimos 30 dias que ainda não esteja no sistema." />
        ) : (
          <div>
            {pedidos.map((pedido) => (
              <Fragment key={pedido.mlOrderId}>
                <ModalSection
                  titulo={`Pedido ${pedido.mlOrderId}`}
                  descricao={`${pedido.comprador ?? 'Comprador não identificado'} · ${new Date(pedido.dataCriacao).toLocaleDateString('pt-BR')}`}
                >
                  <div className="mb-3">
                    <SeletorCliente
                      clienteId={vinculoCliente[pedido.mlOrderId]?.clienteId ?? null}
                      nome={vinculoCliente[pedido.mlOrderId]?.nome ?? pedido.comprador ?? ''}
                      onChange={(clienteId, nome) => setVinculoCliente((prev) => ({ ...prev, [pedido.mlOrderId]: { clienteId, nome } }))}
                      placeholder="Vincular a um cliente cadastrado (opcional)"
                    />
                  </div>
                  <div className="space-y-2">
                    {pedido.itens.map((item) => {
                      const chave = `${pedido.mlOrderId}:${item.mlItemId}`;
                      const desabilitado = item.status !== 'encontrado';
                      return (
                        <label
                          key={chave}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-control border border-border-subtle',
                            desabilitado ? 'opacity-60' : 'cursor-pointer hover:bg-surface-raised'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selecionados.has(chave)}
                            disabled={desabilitado}
                            onChange={() => alternarSelecao(chave)}
                            className="shrink-0 size-4 accent-[var(--accent)]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text-primary truncate">{item.estoqueNomeSugerido ?? item.titulo}</p>
                            <p className="text-xs text-text-faint">
                              {item.quantidade}x · {formatCurrency(item.valorUnitario)}
                            </p>
                          </div>
                          <StatusBadge
                            texto={item.status === 'encontrado' ? 'Encontrado' : item.status === 'ja_importado' ? 'Já importado' : 'Sem vínculo local'}
                            tom={item.status === 'encontrado' ? 'positive' : item.status === 'ja_importado' ? 'neutral' : 'warning'}
                          />
                        </label>
                      );
                    })}
                  </div>
                </ModalSection>
              </Fragment>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// Feature 3 — central de perguntas: carrega sozinha ao abrir a tela (é
// leitura, sem custo de mutação) mas cada resposta só sai com um clique.
function SecaoPerguntas({ onAtualizarPendencias }: { onAtualizarPendencias: () => void }) {
  const [carregando, setCarregando] = useState(true);
  const [perguntas, setPerguntas] = useState<PerguntaPreview[]>([]);
  const [rascunhos, setRascunhos] = useState<Record<number, string>>({});
  const [enviando, setEnviando] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resultado = await mercadolivreApi.buscarPerguntas();
        if (cancelado) return;
        if (resultado.success && resultado.data) {
          setPerguntas(resultado.data);
          setRascunhos(Object.fromEntries(resultado.data.map((p) => [p.id, p.rascunhoResposta ?? ''])));
        } else {
          aviso.falha(resultado.error, 'Não deu pra carregar as perguntas');
        }
      } catch (err) {
        if (!cancelado) aviso.falha(err, 'Não deu pra carregar as perguntas');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const responder = async (id: number) => {
    const texto = (rascunhos[id] ?? '').trim();
    if (!texto) {
      aviso.atencao('Escreva uma resposta antes de enviar');
      return;
    }
    setEnviando(id);
    try {
      const resultado = await mercadolivreApi.responderPergunta(id, texto);
      if (resultado.success) {
        aviso.sucesso('Resposta enviada');
        setPerguntas((prev) => prev.filter((p) => p.id !== id));
        onAtualizarPendencias();
      } else {
        aviso.falha(resultado.error, 'Não deu pra enviar a resposta');
      }
    } catch (err) {
      aviso.falha(err, 'Não deu pra enviar a resposta');
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-9 rounded-control bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center shrink-0">
          <HelpCircle size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Perguntas</p>
          <p className="text-xs text-text-faint">Respostas enviadas direto pro Mercado Livre</p>
        </div>
      </div>

      {carregando ? (
        <div className="py-8 flex items-center justify-center text-text-faint">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : perguntas.length === 0 ? (
        <EmptyState icone={HelpCircle} mensagem="Nenhuma pergunta sem resposta no momento." />
      ) : (
        <div className="space-y-3">
          {perguntas.map((pergunta) => (
            <div key={pergunta.id} className="rounded-control border border-border-subtle bg-surface-inset p-3.5 space-y-2.5">
              <p className="text-sm text-text-primary">{pergunta.texto}</p>
              <p className="text-[11px] text-text-faint">{new Date(pergunta.dataCriacao).toLocaleString('pt-BR')}</p>
              <textarea
                value={rascunhos[pergunta.id] ?? ''}
                onChange={(e) => setRascunhos((prev) => ({ ...prev, [pergunta.id]: e.target.value }))}
                rows={2}
                placeholder="Escreva a resposta..."
                className="w-full rounded-control border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => responder(pergunta.id)}
                  disabled={enviando === pergunta.id}
                  className="h-8 px-3 rounded-control border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-raised flex items-center gap-1.5 disabled:opacity-50"
                >
                  {enviando === pergunta.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Responder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Feature 6 — anúncios ativos no ML que nenhuma peça do estoque referencia.
// Só leitura/relatório, por isso carrega sozinha ao abrir a tela.
function SecaoAnunciosOrfaos() {
  const { refreshData } = useData();
  const [carregando, setCarregando] = useState(true);
  const [anuncios, setAnuncios] = useState<AnuncioOrfaoML[]>([]);
  const [vinculando, setVinculando] = useState<string | null>(null);

  const vincular = async (anuncio: AnuncioOrfaoML) => {
    if (!anuncio.sugestao || vinculando) return;
    setVinculando(anuncio.mlbId);
    try {
      const resultado = await estoqueApi.criarAnuncioMl(anuncio.sugestao.estoqueId, { url: anuncio.permalink });
      if (!resultado.success) throw new Error(resultado.error);
      aviso.sucesso(`Anúncio vinculado a "${anuncio.sugestao.nome}"`);
      setAnuncios((prev) => prev.filter((a) => a.mlbId !== anuncio.mlbId));
      await refreshData();
    } catch (err) {
      aviso.falha(err, 'Não deu pra vincular o anúncio');
    } finally {
      setVinculando(null);
    }
  };

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resultado = await mercadolivreApi.buscarAnunciosOrfaos();
        if (cancelado) return;
        if (resultado.success && resultado.data) setAnuncios(resultado.data);
        else aviso.falha(resultado.error, 'Não deu pra carregar os anúncios');
      } catch (err) {
        if (!cancelado) aviso.falha(err, 'Não deu pra carregar os anúncios');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-9 rounded-control bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center shrink-0">
          <Link2Off size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Anúncios sem peça vinculada</p>
          <p className="text-xs text-text-faint">Ativos no Mercado Livre, mas nenhuma peça do estoque aponta pra eles</p>
        </div>
      </div>

      {carregando ? (
        <div className="py-8 flex items-center justify-center text-text-faint">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : anuncios.length === 0 ? (
        <EmptyState icone={Link2Off} mensagem="Todo anúncio ativo no Mercado Livre já tem uma peça vinculada no estoque." />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {anuncios.map((anuncio) => (
            <li key={anuncio.mlbId} className="py-3 space-y-2">
              <div className="flex items-center gap-3">
                {anuncio.thumbnail ? (
                  <img src={anuncio.thumbnail} alt="" className="size-10 rounded-control object-cover shrink-0 bg-surface-inset" />
                ) : (
                  <div className="size-10 rounded-control bg-surface-inset shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{anuncio.titulo}</p>
                  <p className="text-xs text-text-faint">
                    {formatCurrency(anuncio.preco)} · {anuncio.quantidadeDisponivel} disponível
                  </p>
                </div>
                <a
                  href={anuncio.permalink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 h-8 px-3 rounded-control border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-raised flex items-center gap-1.5"
                >
                  Ver no ML <ExternalLink size={12} />
                </a>
              </div>
              {anuncio.sugestao && (
                <AlertBar
                  tom="neutral"
                  icone={Link2}
                  mensagem={`Este anúncio parece ser: ${anuncio.sugestao.nome}`}
                  acaoLabel={vinculando === anuncio.mlbId ? 'Vinculando...' : 'Vincular agora'}
                  onAcao={() => vincular(anuncio)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Feature C — anúncios ativos que têm título parecido com outro anúncio
// ativo do mesmo vendedor (não contra o estoque — isso é a seção acima).
// Cada grupo agrupa prováveis duplicatas; "Pausar" só muda o status no ML
// depois de confirmação, mesmo cuidado usado no resto do módulo pra nunca
// mutar o anúncio real sem um clique explícito.
function SecaoAnunciosDuplicados() {
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoAnuncioDuplicado[]>([]);
  const [confirmandoPausa, setConfirmandoPausa] = useState<ItemAnuncioDuplicado | null>(null);
  const [pausando, setPausando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resultado = await mercadolivreApi.buscarAnunciosDuplicados();
        if (cancelado) return;
        if (resultado.success && resultado.data) setGrupos(resultado.data);
        else setErroCarregar(resultado.error ?? 'Não deu pra verificar duplicatas');
      } catch (err) {
        if (!cancelado) setErroCarregar(err instanceof Error ? err.message : 'Não deu pra verificar duplicatas');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const confirmarPausa = async () => {
    if (!confirmandoPausa) return;
    setPausando(true);
    try {
      const resultado = await mercadolivreApi.pausarAnuncio(confirmandoPausa.mlbId);
      if (!resultado.success) throw new Error(resultado.error);
      aviso.sucesso('Anúncio pausado no Mercado Livre');
      setGrupos((prev) => prev.map((g) => ({ ...g, itens: g.itens.map((i) => (i.mlbId === confirmandoPausa.mlbId ? { ...i, status: 'paused' } : i)) })));
      setConfirmandoPausa(null);
    } catch (err) {
      aviso.falha(err, 'Não deu pra pausar o anúncio');
    } finally {
      setPausando(false);
    }
  };

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-9 rounded-control bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center shrink-0">
          <Copy size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Possíveis anúncios duplicados</p>
          <p className="text-xs text-text-faint">Títulos parecidos entre anúncios ativos — pode ser a mesma peça anunciada mais de uma vez</p>
        </div>
      </div>

      {carregando ? (
        <div className="py-8 flex items-center justify-center text-text-faint">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : erroCarregar ? (
        <p className="text-xs text-danger">{erroCarregar}</p>
      ) : grupos.length === 0 ? (
        <EmptyState icone={Copy} mensagem="Nenhum anúncio com título parecido a outro ativo no momento." />
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => (
            <div key={grupo.grupoId} className="rounded-control border border-border-subtle bg-surface-inset p-3 space-y-2">
              {grupo.itens.map((item) => (
                <div key={item.mlbId} className="flex items-center gap-3">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="size-9 rounded-control object-cover shrink-0 bg-surface-page" />
                  ) : (
                    <div className="size-9 rounded-control bg-surface-page shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{item.titulo}</p>
                    <p className="text-xs text-text-faint">
                      {formatCurrency(item.preco)} · {item.quantidadeDisponivel} disponível
                      {item.vinculado && ' · vinculado no estoque'}
                    </p>
                  </div>
                  {item.status === 'paused' ? (
                    <StatusBadge texto="Pausado" tom="neutral" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmandoPausa(item)}
                      className="shrink-0 h-8 px-3 rounded-control border border-border-default text-xs font-medium text-danger hover:bg-danger-bg flex items-center gap-1.5"
                    >
                      Pausar
                    </button>
                  )}
                  <a
                    href={item.permalink}
                    target="_blank"
                    rel="noreferrer noopener"
                    title="Ver no Mercado Livre"
                    className="shrink-0 size-8 rounded-control text-text-faint hover:text-accent-soft-fg flex items-center justify-center"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {confirmandoPausa && (
        <Modal
          aberto={!!confirmandoPausa}
          onFechar={() => setConfirmandoPausa(null)}
          titulo="Pausar este anúncio?"
          icone={Copy}
          tamanho="sm"
          rodape={
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmandoPausa(null)}
                className="flex-1 h-11 rounded-control border border-border-default font-medium text-sm text-text-secondary hover:bg-surface-raised"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPausa}
                disabled={pausando}
                className="flex-1 h-11 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pausando && <Loader2 size={14} className="animate-spin" />}
                Pausar
              </button>
            </div>
          }
        >
          <p className="text-sm text-text-secondary">
            <span className="text-text-primary font-medium">{confirmandoPausa.titulo}</span> deixa de ficar visível pra compradores no Mercado Livre até
            alguém reativar manualmente por lá.
          </p>
        </Modal>
      )}
    </div>
  );
}
