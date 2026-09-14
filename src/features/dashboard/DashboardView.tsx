// Painel com a visão geral do negócio: valor em estoque, vendas do mês,
// saídas do caixa, desempenho dos últimos 30 dias, formas de pagamento,
// últimas vendas e orçamentos pendentes. Todas as métricas são derivadas
// client-side de estoque/vendas/caixa/orçamentos — não existe endpoint de
// dashboard dedicado (mesmo padrão do sistema anterior).
//
// Construída inteiramente com os componentes de src/components/ui/ e os
// tokens de src/styles/theme.css — nada de hex/cor direta aqui.
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Package,
  ShoppingCart,
  Wallet,
  Receipt,
  Search,
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
import { EASE_STANDARD } from '../../components/ui/motion';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import { useTarefas } from '../tarefas/useTarefas';
import { NOME_LOJA } from '../../constants/loja';
import { MetricCard } from '../../components/ui/MetricCard';
import { AnimatedNumber } from '../../components/ui/animated-number';
import { NotificationList, type NotificationItem } from '../../components/ui/NotificationList';
import { TransactionList } from '../../components/ui/TransactionList';
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
import { usePermissao } from '../../hooks/usePermissao';
import { fetchWithRetry } from '../../utils/api';

export const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const PRIORIDADE_ORDEM: Record<Tarefa['prioridade'], number> = { alta: 0, media: 1, baixa: 2 };

type ResumoPendente = {
  id: string;
  codigo: string;
  cliente_nome: string;
  criado_em: string;
  total?: number;
  itens?: Orcamento['itens'];
};

type ResumoDashboard = {
  pendencias: ResumoPendente[];
  fiadoResumo: { clienteNome: string; totalEmAberto: number; diasEmAbertoMax: number }[];
  fiadoTotalEmAberto: number;
  pendenciasManuaisTotalEmAberto?: number;
  pendenciasManuaisQtd?: number;
};

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
    <div className="rounded-control border border-border-default bg-surface-overlay px-3 py-2 shadow-md">
      <p className="text-3xs uppercase tracking-wide text-text-faint mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// Card-container padrão usado pelas seções de gráfico/lista da tela.
// Exportado pelo mesmo motivo de ChartTooltip acima — VisaoDono também usa,
// então o realce de borda/entrada aqui já beneficia as duas telas.
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
  const reduzMovimento = useReducedMotion();

  return (
    <motion.div
      initial={reduzMovimento ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, ease: EASE_STANDARD }}
      className="bg-surface-card border border-border-subtle rounded-card overflow-hidden"
    >
      <div className="h-px w-full bg-gradient-surface-edge" />
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-2xs font-semibold uppercase tracking-wide text-text-muted truncate">{titulo}</h3>
          {headerExtra}
        </div>
        {acaoLabel && onAcao && (
          <button onClick={onAcao} className="shrink-0 -my-2 -mr-2 py-2 pl-2 pr-2 rounded-control text-2xs font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80 active:bg-surface-raised transition-opacity duration-fast">
            {acaoLabel}
          </button>
        )}
      </div>
      {children}
    </motion.div>
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

  const conteudo = (
      <div className={cn('size-8 rounded-control flex items-center justify-center shrink-0', iconClasses)}>
        <Icone size={15} strokeWidth={1.75} />
      </div>
  );
  const detalhes = (
    <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2 break-words">{titulo}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge texto={legenda} tom="neutral" />
          <span className="text-2xs text-text-faint">{data}</span>
        </div>
      </div>
  );
  const valorNode = <span className={cn('text-sm font-medium shrink-0 tabular-nums text-right', valorClasses)}>{formatCurrency(valor)}</span>;

  if (!onClick) {
    return <div className="flex items-start gap-3 px-5 py-3">{conteudo}{detalhes}{valorNode}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-5 py-3 text-left transition-colors duration-fast hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    >
      {conteudo}{detalhes}{valorNode}
    </button>
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
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-w-0 bg-surface-card border border-border-subtle rounded-card p-4 space-y-3">
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
  onSelectItem,
  onTabChange,
  onOpenSearch,
  onNavigateEstoqueBaixo,
  onNavigateCliente,
  onNavigateClientesSumidos,
  onNavigateFiado,
}: {
  onSelectItem: (item: Estoque | Venda) => void;
  onTabChange: (tab: string) => void;
  onOpenSearch?: () => void;
  onNavigateEstoqueBaixo?: () => void;
  onNavigateCliente?: (clienteId: string) => void;
  onNavigateClientesSumidos?: () => void;
  onNavigateFiado?: () => void;
}) {
  const { estoque, vendas, caixa, orcamentos, clientes, fiadoRecebimentos, caixaPendencias, loading } = useData();
  const { tarefas } = useTarefas();
  // Duas permissões independentes dentro do Dashboard: os números do negócio
  // (cards de métrica + gráficos) e a Visão do Dono. Dá pra liberar só uma —
  // ex: alguém que abre o Dashboard e enxerga APENAS a visão completa.
  const { pode } = usePermissao();
  const verValores = pode('dashboard.ver_valores');
  const verVisaoDono = pode('dashboard.ver_visao_dono');
  const [searchTerm, setSearchTerm] = useState('');
  const [visaoDonoNoTopo, setVisaoDonoNoTopo] = useState(() => {
    try { return localStorage.getItem('dashboard_visao_dono_posicao') === 'topo'; } catch { return false; }
  });
  const alternarPosicaoVisaoDono = () => {
    setVisaoDonoNoTopo((prev) => {
      const nova = !prev;
      try { localStorage.setItem('dashboard_visao_dono_posicao', nova ? 'topo' : 'fim'); } catch {}
      return nova;
    });
  };

  const [resumoDashboard, setResumoDashboard] = useState<ResumoDashboard | null>(null);
  const [resumoDashboardErro, setResumoDashboardErro] = useState(false);
  const [resumoDashboardCarregando, setResumoDashboardCarregando] = useState(false);
  const carregarResumoDashboard = useCallback(async () => {
    const verDash = pode('dashboard.ver');
    const verOrc = pode('orcamentos.ver');
    const verCx = pode('caixa.ver');
    if (!verDash || (verOrc && verCx)) return;

    setResumoDashboardCarregando(true);
    setResumoDashboardErro(false);
    try {
      const resposta = await fetchWithRetry('/api/dashboard/resumo-pendencias');
      if (!resposta.ok) throw new Error(`Resumo indisponível (${resposta.status})`);
      const resultado = await resposta.json() as { success?: boolean; data?: ResumoDashboard };
      if (!resultado.success || !resultado.data) throw new Error('Resposta de resumo inválida');
      setResumoDashboard(resultado.data);
    } catch {
      setResumoDashboardErro(true);
    } finally {
      setResumoDashboardCarregando(false);
    }
  }, [pode]);

  useEffect(() => {
    void carregarResumoDashboard();
  }, [carregarResumoDashboard]);

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
    const pendencias = orcamentos.length > 0
      ? orcamentos
          .filter((o) => o.status === 'aberto')
          .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
          .slice(0, 5)
      : (resumoDashboard?.pendencias || []);

    const sumidos = clientesSumidos(clientes, vendas, orcamentos);
    const topClientes = rankingTopClientes(clientes, vendas, orcamentos, { limite: 5 });

    // Só alerta fiado parado há um tempo — recém-vendido não precisa de
    // cobrança ainda, isso é ruído (ver regra "todo alerta precisa de ação").
    const DIAS_FIADO_ALERTA = 15;
    let fiadoEmAberto: { clienteNome?: string; totalEmAberto: number; diasEmAbertoMax: number }[];
    let fiadoTotalEmAberto: number;
    if (vendas.length > 0 || fiadoRecebimentos.length > 0) {
      const resumo = resumoFiadoPorCliente(vendas, fiadoRecebimentos).filter((r) => r.diasEmAbertoMax >= DIAS_FIADO_ALERTA);
      fiadoEmAberto = resumo;
      fiadoTotalEmAberto = resumo.reduce((soma, r) => soma + r.totalEmAberto, 0);
    } else if (resumoDashboard) {
      fiadoEmAberto = resumoDashboard.fiadoResumo;
      fiadoTotalEmAberto = resumoDashboard.fiadoTotalEmAberto;
    } else {
      fiadoEmAberto = [];
      fiadoTotalEmAberto = 0;
    }

    const pendenciasManuaisAberto = caixaPendencias.filter((p) => p.status === 'aberta');
    const pendenciasManuaisTotal = pendenciasManuaisAberto.reduce((s, p) => s + Number(p.valor_total), 0);
    const pendenciasTotalGeral = fiadoTotalEmAberto + (pendenciasManuaisTotal || resumoDashboard?.pendenciasManuaisTotalEmAberto || 0);
    const pendenciasQtdGeral = fiadoEmAberto.length + (pendenciasManuaisAberto.length || resumoDashboard?.pendenciasManuaisQtd || 0);

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
      pendenciasTotalGeral,
      pendenciasQtdGeral,
    };
  }, [estoque, vendas, caixa, orcamentos, clientes, fiadoRecebimentos, caixaPendencias, resumoDashboard]);

  const variacaoVendas = useMemo(() => compararComMesPassado(metrics.valorVendasMes, metrics.valorVendasMesAnterior), [metrics.valorVendasMes, metrics.valorVendasMesAnterior]);
  const variacaoSaidas = useMemo(
    () => compararComMesPassado(metrics.valorSaidasMes, metrics.valorSaidasMesAnterior, { menorEhMelhor: true }),
    [metrics.valorSaidasMes, metrics.valorSaidasMesAnterior]
  );
  const variacaoTicket = useMemo(() => compararComMesPassado(metrics.ticketMedio, metrics.ticketMedioAnterior), [metrics.ticketMedio, metrics.ticketMedioAnterior]);

  // Card de notificações (substitui o antigo sino do cabeçalho): agrega os
  // sinais acionáveis do dashboard — estoque baixo, orçamentos pendentes e
  // tarefas pendentes — numa pilha animada. Fica na coluna direita da linha
  // de gráficos, acima de "Formas de pagamento", equilibrando a altura do
  // gráfico de Desempenho à esquerda (ver JSX da seção 4). Só os 3 primeiros
  // aparecem empilhados; o contador mostra o total e "Ver todas" leva pras
  // tarefas.
  const notificacoesDashboard = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    if (metrics.itensEstoqueBaixo.length > 0) {
      items.push({
        id: 'estoque-baixo',
        title: `${metrics.itensEstoqueBaixo.length} peça(s) com estoque baixo`,
        subtitle: '≤ 2 unidades',
        time: 'Estoque',
        count: metrics.itensEstoqueBaixo.length,
        onClick: () => onNavigateEstoqueBaixo?.(),
      });
    }
    metrics.pendencias.forEach((o) => {
      items.push({
        id: `pend-${o.id}`,
        title: o.cliente_nome,
        subtitle: `Orçamento #${o.codigo}`,
        time: new Date(o.criado_em).toLocaleDateString('pt-BR'),
        onClick: () => onTabChange('orcamentos'),
      });
    });
    tarefasPendentes.forEach((t) => {
      items.push({
        id: `tar-${t.id}`,
        title: t.titulo,
        subtitle: t.atribuido?.nome_exibicao || 'Sem responsável',
        time: t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : 'Sem prazo',
        onClick: () => onTabChange('tarefas'),
      });
    });
    return items;
  }, [metrics.itensEstoqueBaixo, metrics.pendencias, tarefasPendentes, onTabChange, onNavigateEstoqueBaixo]);

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
          <h1 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight leading-none">Painel geral</h1>
          <p className="text-sm text-text-faint mt-2">
            {NOME_LOJA} · período atual
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            onClick={() => onOpenSearch?.()}
            className="hidden md:flex items-center gap-2 w-64 px-3 py-2 rounded-control border border-border-default bg-surface-inset text-text-faint cursor-pointer hover:border-border-default/80 transition-colors duration-fast"
          >
            <Search size={15} strokeWidth={1.75} />
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
            className="md:hidden size-11 rounded-control border border-border-default bg-surface-inset text-text-secondary flex items-center justify-center"
            aria-label="Buscar"
          >
            <Search size={18} strokeWidth={1.75} />
          </button>


          <div className="size-9 rounded-full bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center text-xs font-semibold shrink-0">
            {iniciais || 'U'}
          </div>
        </div>
      </div>

      {verVisaoDono && visaoDonoNoTopo && (
        <VisaoDono
          estoque={estoque}
          vendas={vendas}
          caixa={caixa}
          orcamentos={orcamentos}
          clientes={clientes}
          fiadoRecebimentos={fiadoRecebimentos}
          caixaPendencias={caixaPendencias}
          tarefas={tarefas}
          onTabChange={onTabChange}
          onNavigateCliente={onNavigateCliente}
          noTopo={visaoDonoNoTopo}
          onAlternarPosicao={alternarPosicaoVisaoDono}
          resumoFiado={resumoDashboard?.fiadoResumo}
          resumoFiadoTotal={resumoDashboard?.fiadoTotalEmAberto}
          resumoPendenciasManuaisTotal={resumoDashboard?.pendenciasManuaisTotalEmAberto}
        />
      )}

      {/* 2. Métricas — em telas estreitas os cards empilham para que o valor,
          rótulo e contexto sejam lidos por inteiro. A grade começa em duas
          colunas somente quando há espaço real para isso. */}
      {verValores && (
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="min-w-0">
          <MetricCard
            icone={Package}
            label="Valor em estoque"
            valor={metrics.valorTotalEstoque}
            formatarValor={formatCurrency}
            contexto={`${metrics.totalUnidadesEstoque} unidades`}
            tom="positive"
          />
        </div>
        <div className="min-w-0">
          <MetricCard
            icone={ShoppingCart}
            label="Vendas do mês"
            valor={metrics.valorVendasMes}
            formatarValor={formatCurrency}
            contexto={`${metrics.vendasMes.length} vendas neste mês`}
            tom={variacaoVendas.positivo ? 'positive' : 'negative'}
            tendencia={variacaoVendas}
          />
        </div>
        <div className="min-w-0">
          <MetricCard
            icone={Wallet}
            label="Saídas do mês"
            valor={metrics.valorSaidasMes}
            formatarValor={formatCurrency}
            contexto={variacaoSaidas.pct != null ? 'vs. mês passado' : variacaoSaidas.texto}
            tom="negative"
            tendencia={variacaoSaidas}
          />
        </div>
        <div className="min-w-0">
          <MetricCard
            icone={Receipt}
            label="Ticket médio"
            valor={metrics.ticketMedio}
            formatarValor={formatCurrency}
            contexto={variacaoTicket.pct != null ? 'vs. mês passado' : variacaoTicket.texto}
            tom={variacaoTicket.positivo ? 'positive' : 'negative'}
            tendencia={variacaoTicket}
          />
        </div>
      </div>
      )}

      {/* 3. Alertas */}
      {/* Estoque baixo ganha um tratamento próprio (não o AlertBar genérico):
          a contagem é o elemento mais forte, seguindo a regra do design
          system de que número > label — a frase inteira competindo com o
          número escondia o que mais importa aqui. */}
      {metrics.itensEstoqueBaixo.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-l-2 border-l-warning bg-warning-bg pl-4 pr-3 py-3 rounded-[0_9px_9px_0]">
          <div className="flex items-center gap-3 min-w-0">
            <AlertTriangle size={18} strokeWidth={1.75} className="text-warning shrink-0" />
            <div className="min-w-0">
              <p className="text-3xl font-semibold text-warning leading-none tabular-nums tracking-tight">
                <AnimatedNumber value={metrics.itensEstoqueBaixo.length} />
              </p>
              <p className="text-xs text-text-secondary mt-1 leading-snug break-words">peça(s) com estoque baixo (≤ 2 unidades)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateEstoqueBaixo?.()}
            className="shrink-0 -my-2 -mr-2 py-2 px-2 rounded-control text-2xs font-semibold uppercase tracking-wide underline underline-offset-2 text-warning hover:opacity-80 transition-opacity duration-fast"
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
      {resumoDashboardErro && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-2 border-l-danger bg-danger-bg pl-4 pr-3 py-3 rounded-[0_9px_9px_0]">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle size={17} strokeWidth={1.75} className="text-danger shrink-0 mt-0.5" />
            <p className="text-sm leading-snug text-text-primary break-words">Não foi possível atualizar o resumo de pendências.</p>
          </div>
          <button
            type="button"
            onClick={() => void carregarResumoDashboard()}
            disabled={resumoDashboardCarregando}
            className="self-end sm:self-auto shrink-0 rounded-control px-2 py-2 text-2xs font-semibold uppercase tracking-wide text-danger underline underline-offset-2 disabled:opacity-50"
          >
            {resumoDashboardCarregando ? 'Atualizando…' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {metrics.pendenciasTotalGeral > 0 && (
        <AlertBar
          tom="warning"
          icone={HandCoins}
          mensagem={`${metrics.pendenciasQtdGeral} pendência(s) em aberto (${formatCurrency(metrics.pendenciasTotalGeral)})`}
          acaoLabel="Ver pendências"
          onAcao={() => onNavigateFiado?.()}
        />
      )}

      {/* 4. Desempenho + Formas de pagamento — são valores do negócio, então
          seguem a mesma permissão dos cards de métrica. */}
      {verValores && (
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        <PanelCard titulo="Desempenho (30 dias)">
          <div className="p-4">
            <p className="sr-only">
              Saldo acumulado dos últimos 30 dias: {chartData.length > 0 ? `${formatCurrency(chartData[chartData.length - 1].valor)} no último ponto, partindo de ${formatCurrency(chartData[0].valor)}.` : 'sem lançamentos no período.'}
            </p>
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

        <div className="flex flex-col gap-4">
          {notificacoesDashboard.length > 0 && (
            <NotificationList
              itens={notificacoesDashboard}
              label={`${notificacoesDashboard.length} notificação(ões)`}
              onVerTudo={() => onTabChange('tarefas')}
            />
          )}

          <PanelCard
            titulo="Formas de pagamento"
            headerExtra={pieData.length > 0 && <StatusBadge texto={variacaoVendas.texto} tom={variacaoVendas.positivo ? 'positive' : 'negative'} />}
          >
          <div className="p-4">
            {pieData.length === 0 ? (
              <EmptyState icone={Receipt} mensagem="Sem vendas registradas este mês ainda." />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div role="img" aria-label={`Distribuição das vendas por forma de pagamento. Total ${formatCurrency(metrics.valorVendasMes)}.`}>
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
                </div>

                {/* Legenda em lista — nunca flutuante sobre o gráfico */}
                <ul className="w-full space-y-2">
                  {pieData.map((entry, i) => (
                    <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0 text-text-secondary">
                        <span className={cn('size-2 rounded-full shrink-0', getColorClassName(PIE_COLORS[i % PIE_COLORS.length], 'bg'))} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-text-faint text-2xs tabular-nums">{entry.percentual.toFixed(0)}%</span>
                        <span className="text-text-primary font-medium tabular-nums">{formatCurrency(entry.value)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          </PanelCard>
        </div>
      </div>
      )}

      {/* 5. Últimas vendas + Pendências */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {metrics.ultimasVendas.length === 0 ? (
          <PanelCard titulo="Últimas vendas" acaoLabel="Ver todas" onAcao={() => onTabChange('vendas')}>
            <EmptyState icone={ShoppingCart} mensagem="Nenhuma venda registrada ainda." />
          </PanelCard>
        ) : (
          <TransactionList
            titulo="Últimas vendas"
            onVerTudo={() => onTabChange('vendas')}
            transactions={metrics.ultimasVendas.map((v) => ({
              id: v.id,
              icon: <CheckCircle2 size={16} strokeWidth={1.75} />,
              name: v.nome_item,
              category: v.forma_pagamento?.nome || 'Outro',
              amount: formatCurrency(v.valor_total),
              transactionId: v.id.slice(0, 8),
              date: parseLocalDate(v.data).toLocaleDateString('pt-BR'),
              time: new Date(v.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              detalhes: [
                { label: 'Quantidade', valor: `${v.quantidade} × ${formatCurrency(v.valor_unitario)}` },
                ...(v.cliente_nome ? [{ label: 'Cliente', valor: v.cliente_nome }] : []),
                { label: 'Canal', valor: v.canal === 'mercado_livre' ? 'Mercado Livre' : 'Balcão' },
                ...(v.modelo_moto?.nome ? [{ label: 'Moto', valor: v.modelo_moto.nome }] : []),
              ],
              onAbrir: () => onSelectItem(v),
            }))}
          />
        )}

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
                    valor={o.itens ? totalOrcamento(o) : (o.total ?? 0)}
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
                <span key={nome} className="text-xs text-text-secondary bg-surface-inset px-2.5 py-1 rounded-badge">
                  {nome}: <span className="font-medium text-text-primary tabular-nums">{qtd}</span>
                </span>
              ))}
            </div>
            <div className="divide-y divide-border-subtle">
              {tarefasPendentes.slice(0, 5).map((t) => (
                <button key={t.id} type="button" onClick={() => onTabChange('tarefas')} className="w-full flex items-start gap-3 px-5 py-3 text-left cursor-pointer hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent transition-colors duration-fast">
                  <div
                    className={cn(
                      'size-8 rounded-control flex items-center justify-center shrink-0',
                      t.prioridade === 'alta' ? 'bg-danger-bg text-danger' : t.prioridade === 'media' ? 'bg-warning-bg text-warning' : 'bg-surface-inset text-text-muted'
                    )}
                  >
                    <ClipboardList size={15} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2 break-words">{t.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge texto={t.atribuido?.nome_exibicao || 'Sem responsável'} tom="neutral" />
                      {t.prazo && <span className="text-2xs text-text-faint">{new Date(t.prazo).toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                </button>
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

      {verVisaoDono && !visaoDonoNoTopo && (
        <VisaoDono
          estoque={estoque}
          vendas={vendas}
          caixa={caixa}
          orcamentos={orcamentos}
          clientes={clientes}
          fiadoRecebimentos={fiadoRecebimentos}
          caixaPendencias={caixaPendencias}
          tarefas={tarefas}
          onTabChange={onTabChange}
          onNavigateCliente={onNavigateCliente}
          noTopo={visaoDonoNoTopo}
          onAlternarPosicao={alternarPosicaoVisaoDono}
          resumoFiado={resumoDashboard?.fiadoResumo}
          resumoFiadoTotal={resumoDashboard?.fiadoTotalEmAberto}
          resumoPendenciasManuaisTotal={resumoDashboard?.pendenciasManuaisTotalEmAberto}
        />
      )}
    </div>
  );
}
