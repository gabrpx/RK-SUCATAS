// Painel com a visão geral do negócio: valor em estoque, vendas do mês,
// saídas do caixa, desempenho dos últimos 30 dias, formas de pagamento,
// últimas vendas e orçamentos pendentes. Todas as métricas são derivadas
// client-side de estoque/vendas/caixa/orçamentos — não existe endpoint de
// dashboard dedicado (mesmo padrão do sistema anterior).
//
// Construída inteiramente com os componentes de src/components/ui/ e os
// tokens de src/styles/theme.css — nada de hex/cor direta aqui.
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  Package,
  ShoppingCart,
  Wallet,
  Receipt,
  Search,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Users,
  UserX,
  HandCoins,
  ClipboardList,
  X,
} from 'lucide-react';
import { AreaChart } from '../../components/ui/tremor/AreaChart';
import { DonutChart } from '../../components/ui/tremor/DonutChart';
import { getColorClassName, type AvailableChartColorsKeys } from '../../components/ui/tremor/chartColors';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import { useTarefas } from '../tarefas/useTarefas';
import { NOME_LOJA } from '../../constants/loja';
import { MetricCard } from '../../components/ui/MetricCard';
import { AlertBar } from '../../components/ui/AlertBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { clientesSumidos, rankingTopClientes } from '../clientes/metricas';
import { resumoFiadoPorCliente } from '../fiado/metricas';
import { isEstoqueBaixo } from '../estoque/valorEstoque';
import { calcularSaldoAcumulado30Dias, compararComMesPassado } from './metricas';
import { VisaoDono } from './VisaoDono';
import type { Estoque } from '../estoque/types';
import type { Venda } from '../vendas/types';
import type { Orcamento } from '../orcamentos/types';
import type { Tarefa } from '../tarefas/types';
import type { Role } from '../../constants/roles';

export const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const PRIORIDADE_ORDEM: Record<Tarefa['prioridade'], number> = { alta: 0, media: 1, baixa: 2 };

// Total de um orçamento após desconto — mesma fórmula de OrcamentosView.tsx
// (subtotal dos itens menos desconto fixo ou percentual), duplicada aqui
// porque a original não é exportada e é pequena o suficiente pra não valer
// a pena criar um módulo compartilhado só por causa disso.
function totalOrcamento(o: Orcamento): number {
  const subtotal = o.itens.reduce((sum, i) => sum + Number(i.quantidade) * Number(i.valor_unitario), 0);
  const desconto = o.desconto_tipo === 'percentual' ? subtotal * ((Number(o.desconto_valor) || 0) / 100) : Number(o.desconto_valor) || 0;
  return Math.max(0, subtotal - desconto);
}

// Paleta do donut de formas de pagamento — chaves de src/components/ui/tremor/chartColors.ts,
// que só mapeiam pros tokens semânticos de theme.css (nunca cor nova do Tremor).
// A ordem importa pouco aqui porque cada fatia já carrega o nome na legenda.
const PIE_COLORS: AvailableChartColorsKeys[] = ['accent', 'positive', 'warning', 'negative', 'muted'];

// Tooltip custom do gráfico de área: card no estilo do design system em vez
// do balão cinza padrão do Recharts/Tremor. Exportado porque a Visão do Dono
// (VisaoDono.tsx) e o AreaChart do Dashboard reaproveitam.
export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-border-default bg-surface-raised px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wide text-text-faint mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// Card-container padrão usado pelas seções de gráfico/lista da tela.
// Exportado pelo mesmo motivo de ChartTooltip acima.
export function PanelCard({
  titulo,
  acaoLabel,
  onAcao,
  headerExtra,
  children,
}: {
  titulo: string;
  acaoLabel?: string;
  onAcao?: () => void;
  /** Nó extra no cabeçalho, entre o título e a ação — ex: badge de comparação com o período anterior. */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted truncate">{titulo}</h3>
          {headerExtra}
        </div>
        {acaoLabel && onAcao && (
          <button onClick={onAcao} className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80">
            {acaoLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// Linha de lista compartilhada por "Últimas vendas" e "Pendências" — ícone
// de status à esquerda, nome + meio/pagamento + data no meio, valor à direita.
// Exportado pelo mesmo motivo de ChartTooltip acima.
export function LinhaAtividade({
  icone: Icone,
  tom,
  titulo,
  legenda,
  data,
  valor,
  onClick,
}: {
  icone: typeof CheckCircle2;
  tom: 'positive' | 'warning';
  titulo: string;
  legenda: string;
  data: string;
  valor: number;
  onClick?: () => void;
}) {
  const iconClasses = tom === 'positive' ? 'bg-positive-bg text-positive' : 'bg-warning-bg text-warning';
  const valorClasses = tom === 'positive' ? 'text-positive' : 'text-warning';

  return (
    <div
      onClick={onClick}
      className={cn('flex items-center gap-3 px-5 py-3', onClick && 'cursor-pointer hover:bg-surface-raised')}
    >
      <div className={cn('size-8 rounded-control flex items-center justify-center shrink-0', iconClasses)}>
        <Icone size={15} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">{titulo}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge texto={legenda} tom="neutral" />
          <span className="text-[11px] text-text-faint">{data}</span>
        </div>
      </div>
      <span className={cn('text-sm font-medium shrink-0', valorClasses)}>{formatCurrency(valor)}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SKELETON — mesma estrutura de seções da tela real, pra não pular layout
// quando os dados chegam.
// -----------------------------------------------------------------------------
function DashboardSkeleton() {
  const bar = 'bg-surface-inset rounded animate-pulse';
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={cn(bar, 'h-7 w-40')} />
          <div className={cn(bar, 'h-3 w-56')} />
        </div>
        <div className={cn(bar, 'h-10 w-64 hidden md:block')} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-card border border-border-subtle rounded-card p-4 space-y-3">
            <div className={cn(bar, 'size-9 rounded-control')} />
            <div className={cn(bar, 'h-2.5 w-20')} />
            <div className={cn(bar, 'h-5 w-28')} />
          </div>
        ))}
      </div>
      <div className={cn(bar, 'h-12 w-full')} />
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        <div className={cn(bar, 'h-80 w-full')} />
        <div className={cn(bar, 'h-80 w-full')} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cn(bar, 'h-64 w-full')} />
        <div className={cn(bar, 'h-64 w-full')} />
      </div>
    </div>
  );
}

export function DashboardView({
  userRoles,
  onSelectItem,
  onTabChange,
  onOpenSearch,
  onNavigateEstoqueBaixo,
  onNavigateCliente,
  onNavigateClientesSumidos,
  onNavigateFiado,
}: {
  userRoles?: Role[];
  onSelectItem: (item: Estoque | Venda) => void;
  onTabChange: (tab: string) => void;
  onOpenSearch?: () => void;
  onNavigateEstoqueBaixo?: () => void;
  onNavigateCliente?: (clienteId: string) => void;
  onNavigateClientesSumidos?: () => void;
  onNavigateFiado?: () => void;
}) {
  const { estoque, vendas, caixa, orcamentos, clientes, fiadoRecebimentos, loading } = useData();
  const { tarefas } = useTarefas();
  const [searchTerm, setSearchTerm] = useState('');
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);

  // Dashboard só é visível pra admin/equipe (ver TAB_ROLES) — quem chega
  // aqui sempre vê TODAS as tarefas pendentes do sistema, não só as suas
  // (mesmo escopo que o backend já devolve pra esses papéis em GET /tarefas).
  const tarefasPendentes = useMemo(
    () => tarefas.filter((t) => t.status === 'pendente').sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade]),
    [tarefas]
  );
  const tarefasPendentesPorResponsavel = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const t of tarefasPendentes) {
      const nome = t.atribuido?.nome_exibicao || 'Sem responsável';
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
    return Array.from(contagem.entries()).sort((a, b) => b[1] - a[1]);
  }, [tarefasPendentes]);

  const userName = (typeof window !== 'undefined' && localStorage.getItem('user_name')) || 'Admin';
  const iniciais = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const metrics = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const refMesAnterior = new Date(anoAtual, mesAtual - 1, 1);
    const mesAnterior = refMesAnterior.getMonth();
    const anoMesAnterior = refMesAnterior.getFullYear();

    const valorTotalEstoque = estoque.reduce((sum, item) => sum + Number(item.valor) * Number(item.quantidade), 0);
    const totalUnidadesEstoque = estoque.reduce((sum, item) => sum + Number(item.quantidade), 0);
    const itensEstoqueBaixo = estoque.filter(isEstoqueBaixo);

    const vendasMes = vendas.filter((v) => {
      const d = parseLocalDate(v.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const valorVendasMes = vendasMes.reduce((sum, v) => sum + Number(v.valor_total), 0);
    const ticketMedio = vendasMes.length > 0 ? valorVendasMes / vendasMes.length : 0;

    // Mês anterior — só pra alimentar os indicadores de tendência dos KPIs
    // e do card de formas de pagamento (comparação "X% a mais/menos que o
    // mês passado"). "Valor em estoque" fica de fora dessa comparação: é
    // uma foto do estoque agora, e o sistema não guarda snapshot histórico
    // de valor de estoque — não dá pra comparar sem inventar um número.
    const vendasMesAnterior = vendas.filter((v) => {
      const d = parseLocalDate(v.data);
      return d.getMonth() === mesAnterior && d.getFullYear() === anoMesAnterior;
    });
    const valorVendasMesAnterior = vendasMesAnterior.reduce((sum, v) => sum + Number(v.valor_total), 0);
    const ticketMedioAnterior = vendasMesAnterior.length > 0 ? valorVendasMesAnterior / vendasMesAnterior.length : 0;

    const saidasMes = caixa.filter((c) => {
      if (c.tipo !== 'saida') return false;
      const d = parseLocalDate(c.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const valorSaidasMes = saidasMes.reduce((sum, c) => sum + Number(c.valor), 0);

    const saidasMesAnterior = caixa.filter((c) => {
      if (c.tipo !== 'saida') return false;
      const d = parseLocalDate(c.data);
      return d.getMonth() === mesAnterior && d.getFullYear() === anoMesAnterior;
    });
    const valorSaidasMesAnterior = saidasMesAnterior.reduce((sum, c) => sum + Number(c.valor), 0);

    const ultimasVendas = [...vendas].sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime()).slice(0, 5);
    const pendencias = orcamentos
      .filter((o) => o.status === 'aberto')
      .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
      .slice(0, 5);

    const sumidos = clientesSumidos(clientes, vendas, orcamentos);
    const topClientes = rankingTopClientes(clientes, vendas, orcamentos, { limite: 5 });

    // Só alerta fiado parado há um tempo — recém-vendido não precisa de
    // cobrança ainda, isso é ruído (ver regra "todo alerta precisa de ação").
    const DIAS_FIADO_ALERTA = 15;
    const fiadoEmAberto = resumoFiadoPorCliente(vendas, fiadoRecebimentos).filter((r) => r.diasEmAbertoMax >= DIAS_FIADO_ALERTA);
    const fiadoTotalEmAberto = fiadoEmAberto.reduce((soma, r) => soma + r.totalEmAberto, 0);

    return {
      valorTotalEstoque,
      totalUnidadesEstoque,
      itensEstoqueBaixo,
      vendasMes,
      valorVendasMes,
      valorVendasMesAnterior,
      ticketMedio,
      ticketMedioAnterior,
      valorSaidasMes,
      valorSaidasMesAnterior,
      ultimasVendas,
      pendencias,
      sumidos,
      topClientes,
      fiadoEmAberto,
      fiadoTotalEmAberto,
    };
  }, [estoque, vendas, caixa, orcamentos, clientes, fiadoRecebimentos]);

  const variacaoVendas = useMemo(() => compararComMesPassado(metrics.valorVendasMes, metrics.valorVendasMesAnterior), [metrics.valorVendasMes, metrics.valorVendasMesAnterior]);
  const variacaoSaidas = useMemo(
    () => compararComMesPassado(metrics.valorSaidasMes, metrics.valorSaidasMesAnterior, { menorEhMelhor: true }),
    [metrics.valorSaidasMes, metrics.valorSaidasMesAnterior]
  );
  const variacaoTicket = useMemo(() => compararComMesPassado(metrics.ticketMedio, metrics.ticketMedioAnterior), [metrics.ticketMedio, metrics.ticketMedioAnterior]);

  // Saldo acumulado dos últimos 30 dias (não o saldo líquido de cada dia
  // isolado — ver metricas.ts pro motivo: isso é o que corrige o gráfico
  // "batimento cardíaco").
  const chartData = useMemo(() => calcularSaldoAcumulado30Dias(caixa), [caixa]);
  const corDesempenho: AvailableChartColorsKeys = (chartData[chartData.length - 1]?.valor ?? 0) >= 0 ? 'positive' : 'negative';

  const pieData = useMemo(() => {
    const porFormaPagamento = new Map<string, number>();
    for (const v of metrics.vendasMes) {
      const nome = v.forma_pagamento?.nome || 'Outro';
      porFormaPagamento.set(nome, (porFormaPagamento.get(nome) || 0) + Number(v.valor_total));
    }
    const total = Array.from(porFormaPagamento.values()).reduce((soma, v) => soma + v, 0);
    return Array.from(porFormaPagamento.entries())
      .map(([name, value]) => ({ name, value, percentual: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [metrics.vendasMes]);

  const temAlerta = metrics.itensEstoqueBaixo.length > 0 || metrics.pendencias.length > 0 || tarefasPendentes.length > 0;

  if (loading && estoque.length === 0) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* 1. Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Painel geral</h1>
          <p className="text-sm text-text-faint mt-0.5">
            {NOME_LOJA} · atualizado agora
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            onClick={() => onOpenSearch?.()}
            className="hidden md:flex items-center gap-2 w-64 px-3 py-2 rounded-control border border-border-default bg-surface-inset text-text-faint cursor-pointer hover:border-border-default/80"
          >
            <Search size={14} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => onOpenSearch?.()}
              placeholder="Buscar peças, vendas..."
              className="flex-1 bg-transparent outline-none text-sm text-text-secondary placeholder:text-text-faint"
            />
          </div>

          <button
            onClick={() => onOpenSearch?.()}
            className="md:hidden size-9 rounded-control border border-border-default bg-surface-inset text-text-secondary flex items-center justify-center"
            aria-label="Buscar"
          >
            <Search size={16} />
          </button>

          <div className="relative">
            <button
              onClick={() => setNotificacoesAbertas((v) => !v)}
              className="relative size-9 rounded-control border border-border-default bg-surface-inset text-text-secondary flex items-center justify-center"
              aria-label="Notificações"
            >
              <Bell size={16} />
              {temAlerta && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-danger" />}
            </button>

            {notificacoesAbertas && (
              <>
                {/* Backdrop invisível só pra fechar ao clicar fora — o painel em si não precisa de overlay escuro */}
                <div className="fixed inset-0 z-[70]" onClick={() => setNotificacoesAbertas(false)} />
                <div className="fixed inset-x-4 top-[calc(4rem+var(--safe-top))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 z-[80] sm:w-80 sm:max-w-[85vw] max-h-[min(24rem,70vh)] flex flex-col overflow-hidden rounded-card border border-border-subtle bg-surface-card shadow-2xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tarefas pendentes</h4>
                    <button onClick={() => setNotificacoesAbertas(false)} className="text-text-faint hover:text-text-primary">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {tarefasPendentes.length === 0 ? (
                      <div className="p-4">
                        <EmptyState icone={ClipboardList} mensagem="Nenhuma tarefa pendente." />
                      </div>
                    ) : (
                      <div className="divide-y divide-border-subtle">
                        {tarefasPendentes.slice(0, 8).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setNotificacoesAbertas(false);
                              onTabChange('tarefas');
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-surface-raised flex items-start gap-2.5"
                          >
                            <ClipboardList size={14} className="text-accent-soft-fg shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-text-primary truncate">{t.titulo}</p>
                              <p className="text-[11px] text-text-faint truncate">
                                {t.atribuido?.nome_exibicao || 'Sem responsável'}
                                {t.prazo ? ` · ${new Date(t.prazo).toLocaleDateString('pt-BR')}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0">
                              <StatusBadge texto={t.prioridade} tom={t.prioridade === 'alta' ? 'danger' : t.prioridade === 'media' ? 'warning' : 'neutral'} />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-border-subtle shrink-0">
                    <button
                      onClick={() => {
                        setNotificacoesAbertas(false);
                        onTabChange('tarefas');
                      }}
                      className="w-full text-center text-[11px] font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80"
                    >
                      Ver todas as tarefas
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="size-9 rounded-full bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center text-xs font-semibold shrink-0">
            {iniciais || 'U'}
          </div>
        </div>
      </div>

      {/* 2. Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icone={Package}
          label="Valor em estoque"
          valor={formatCurrency(metrics.valorTotalEstoque)}
          contexto={`${metrics.totalUnidadesEstoque} unidades`}
          tom="positive"
        />
        <MetricCard
          icone={ShoppingCart}
          label="Vendas do mês"
          valor={formatCurrency(metrics.valorVendasMes)}
          contexto={`${metrics.vendasMes.length} vendas · ${variacaoVendas.texto}`}
          tom={variacaoVendas.positivo ? 'positive' : 'negative'}
        />
        <MetricCard
          icone={Wallet}
          label="Saídas do mês"
          valor={formatCurrency(metrics.valorSaidasMes)}
          contexto={variacaoSaidas.texto}
          tom="negative"
        />
        <MetricCard
          icone={Receipt}
          label="Ticket médio"
          valor={formatCurrency(metrics.ticketMedio)}
          contexto={variacaoTicket.texto}
          tom={variacaoTicket.positivo ? 'positive' : 'negative'}
        />
      </div>

      {/* 3. Alertas */}
      {/* Estoque baixo ganha um tratamento próprio (não o AlertBar genérico):
          a contagem é o elemento mais forte, seguindo a regra do design
          system de que número > label — a frase inteira competindo com o
          número escondia o que mais importa aqui. */}
      {metrics.itensEstoqueBaixo.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-l-2 border-l-warning bg-warning-bg pl-4 pr-3 py-3 rounded-[0_9px_9px_0]">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle size={18} className="text-warning shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-semibold text-warning leading-none tabular-nums">{metrics.itensEstoqueBaixo.length}</p>
              <p className="text-xs text-text-secondary mt-1 truncate">peça(s) com estoque baixo (≤ 2 unidades)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateEstoqueBaixo?.()}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide underline underline-offset-2 text-warning hover:opacity-80"
          >
            Ver itens
          </button>
        </div>
      )}
      {metrics.sumidos.length > 0 && (
        <AlertBar
          tom="warning"
          icone={UserX}
          mensagem={`${metrics.sumidos.length} cliente(s) sem comprar há 90+ dias`}
          acaoLabel="Ver clientes"
          onAcao={() => onNavigateClientesSumidos?.()}
        />
      )}
      {metrics.fiadoEmAberto.length > 0 && (
        <AlertBar
          tom="warning"
          icone={HandCoins}
          mensagem={`${metrics.fiadoEmAberto.length} cliente(s) com fiado em aberto há 15+ dias (${formatCurrency(metrics.fiadoTotalEmAberto)})`}
          acaoLabel="Ver fiado"
          onAcao={() => onNavigateFiado?.()}
        />
      )}

      {/* 4. Desempenho + Formas de pagamento */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        <PanelCard titulo="Desempenho (30 dias)">
          <div className="p-4">
            <AreaChart
              data={chartData}
              index="label"
              categories={['valor']}
              colors={[corDesempenho]}
              valueFormatter={formatCurrency}
              showXAxis={false}
              showYAxis={false}
              showGridLines={false}
              customTooltip={ChartTooltip}
              className="h-[260px] w-full"
            />
          </div>
        </PanelCard>

        <PanelCard
          titulo="Formas de pagamento"
          headerExtra={pieData.length > 0 && <StatusBadge texto={variacaoVendas.texto} tom={variacaoVendas.positivo ? 'positive' : 'negative'} />}
        >
          <div className="p-4">
            {pieData.length === 0 ? (
              <EmptyState icone={Receipt} mensagem="Sem vendas registradas este mês ainda." />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <DonutChart
                  data={pieData}
                  category="name"
                  value="value"
                  colors={PIE_COLORS}
                  valueFormatter={formatCurrency}
                  showLabel
                  label={formatCurrency(metrics.valorVendasMes)}
                  className="h-40 w-40 shrink-0"
                />

                {/* Legenda em lista — nunca flutuante sobre o gráfico */}
                <ul className="w-full space-y-2">
                  {pieData.map((entry, i) => (
                    <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0 text-text-secondary">
                        <span className={cn('size-2 rounded-full shrink-0', getColorClassName(PIE_COLORS[i % PIE_COLORS.length], 'bg'))} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-text-faint text-xs tabular-nums">{entry.percentual.toFixed(0)}%</span>
                        <span className="text-text-primary font-medium">{formatCurrency(entry.value)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </PanelCard>
      </div>

      {/* 5. Últimas vendas + Pendências */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard titulo="Últimas vendas" acaoLabel="Ver todas" onAcao={() => onTabChange('vendas')}>
          {metrics.ultimasVendas.length === 0 ? (
            <EmptyState icone={ShoppingCart} mensagem="Nenhuma venda registrada ainda." />
          ) : (
            <div className="divide-y divide-border-subtle">
              {metrics.ultimasVendas.map((v) => (
                <div key={v.id}>
                  <LinhaAtividade
                    icone={CheckCircle2}
                    tom="positive"
                    titulo={v.nome_item}
                    legenda={v.forma_pagamento?.nome || 'Outro'}
                    data={parseLocalDate(v.data).toLocaleDateString('pt-BR')}
                    valor={v.valor_total}
                    onClick={() => onSelectItem(v)}
                  />
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard titulo="Pendências" acaoLabel="Ver todas" onAcao={() => onTabChange('orcamentos')}>
          {metrics.pendencias.length === 0 ? (
            <EmptyState icone={Inbox} mensagem="Nenhum orçamento pendente no momento." />
          ) : (
            <div className="divide-y divide-border-subtle">
              {metrics.pendencias.map((o) => (
                <div key={o.id}>
                  <LinhaAtividade
                    icone={Clock}
                    tom="warning"
                    titulo={o.cliente_nome}
                    legenda={`#${o.codigo}`}
                    data={new Date(o.criado_em).toLocaleDateString('pt-BR')}
                    valor={totalOrcamento(o)}
                    onClick={() => onTabChange('orcamentos')}
                  />
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      {/* 5.5 Tarefas pendentes — resumo de todos os usuários, só visível aqui
          porque o Dashboard inteiro já é restrito a admin/equipe (TAB_ROLES). */}
      <PanelCard titulo="Tarefas pendentes" acaoLabel="Ver todas" onAcao={() => onTabChange('tarefas')}>
        {tarefasPendentes.length === 0 ? (
          <EmptyState icone={ClipboardList} mensagem="Nenhuma tarefa pendente no momento." />
        ) : (
          <>
            <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2 flex-wrap">
              {tarefasPendentesPorResponsavel.map(([nome, qtd]) => (
                <span key={nome} className="text-xs text-text-secondary bg-surface-inset px-2.5 py-1 rounded-full">
                  {nome}: <span className="font-medium text-text-primary">{qtd}</span>
                </span>
              ))}
            </div>
            <div className="divide-y divide-border-subtle">
              {tarefasPendentes.slice(0, 5).map((t) => (
                <div key={t.id} onClick={() => onTabChange('tarefas')} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-surface-raised">
                  <div
                    className={cn(
                      'size-8 rounded-control flex items-center justify-center shrink-0',
                      t.prioridade === 'alta' ? 'bg-danger-bg text-danger' : t.prioridade === 'media' ? 'bg-warning-bg text-warning' : 'bg-surface-inset text-text-muted'
                    )}
                  >
                    <ClipboardList size={15} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{t.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge texto={t.atribuido?.nome_exibicao || 'Sem responsável'} tom="neutral" />
                      {t.prazo && <span className="text-[11px] text-text-faint">{new Date(t.prazo).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </PanelCard>

      {/* 6. Top clientes */}
      <PanelCard titulo="Top clientes" acaoLabel="Ver todos" onAcao={() => onTabChange('clientes')}>
        {metrics.topClientes.length === 0 ? (
          <EmptyState icone={Users} mensagem="Nenhuma venda vinculada a um cliente cadastrado ainda." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {metrics.topClientes.map(({ cliente, totalGasto, quantidadeCompras }) => (
              <div key={cliente.id}>
                <LinhaAtividade
                  icone={Users}
                  tom="positive"
                  titulo={cliente.nome}
                  legenda={`${quantidadeCompras} compra${quantidadeCompras === 1 ? '' : 's'}`}
                  data={cliente.telefone || ''}
                  valor={totalGasto}
                  onClick={() => onNavigateCliente?.(cliente.id)}
                />
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {/* 7. Visão do dono — só pra quem tem role admin (não pra 'equipe',
          mesmo essa também vendo o resto do Dashboard). */}
      {userRoles?.includes('admin') && (
        <VisaoDono
          estoque={estoque}
          vendas={vendas}
          caixa={caixa}
          orcamentos={orcamentos}
          clientes={clientes}
          fiadoRecebimentos={fiadoRecebimentos}
          tarefas={tarefas}
          onTabChange={onTabChange}
          onNavigateCliente={onNavigateCliente}
        />
      )}
    </div>
  );
}
