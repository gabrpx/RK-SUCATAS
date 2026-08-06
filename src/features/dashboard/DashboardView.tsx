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
} from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import { NOME_LOJA } from '../../constants/loja';
import { MetricCard } from '../../components/ui/MetricCard';
import { AlertBar } from '../../components/ui/AlertBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { clientesSumidos, rankingTopClientes } from '../clientes/metricas';
import { resumoFiadoPorCliente } from '../fiado/metricas';
import type { Estoque } from '../estoque/types';
import type { Venda } from '../vendas/types';
import type { Orcamento } from '../orcamentos/types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

// Mesmo critério usado no filtro "estoque baixo" da tela de Estoque —
// mantido em sincronia com EstoqueView.tsx (busca "matchesEstoqueBaixo").
const isEstoqueBaixo = (item: Estoque) => item.quantidade > 0 && item.quantidade <= 2;

// Total de um orçamento após desconto — mesma fórmula de OrcamentosView.tsx
// (subtotal dos itens menos desconto fixo ou percentual), duplicada aqui
// porque a original não é exportada e é pequena o suficiente pra não valer
// a pena criar um módulo compartilhado só por causa disso.
function totalOrcamento(o: Orcamento): number {
  const subtotal = o.itens.reduce((sum, i) => sum + Number(i.quantidade) * Number(i.valor_unitario), 0);
  const desconto = o.desconto_tipo === 'percentual' ? subtotal * ((Number(o.desconto_valor) || 0) / 100) : Number(o.desconto_valor) || 0;
  return Math.max(0, subtotal - desconto);
}

// Paleta do gráfico de donut usa só tokens semânticos (nunca hex solto) —
// a ordem importa pouco aqui porque cada fatia já carrega o nome na legenda.
const PIE_COLORS = ['var(--accent)', 'var(--positive)', 'var(--warning)', 'var(--negative)', 'var(--text-muted)'];

// Tooltip custom do gráfico de área: card no estilo do design system em vez
// do balão cinza padrão do Recharts.
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-border-default bg-surface-raised px-3 py-2 shadow-lg">
      <p className="text-[10px] uppercase tracking-wide text-text-faint mb-1">{label}</p>
      <p className="text-sm font-medium text-text-primary">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// Dot custom da série de área: fica invisível em todo ponto, exceto no
// último — é o "ponto destacado no último valor" pedido pro gráfico.
function UltimoPontoDot(props: { cx?: number; cy?: number; index?: number; totalPontos: number }) {
  const { cx, cy, index, totalPontos } = props;
  if (index !== totalPontos - 1 || cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="var(--positive)" fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={3.5} fill="var(--positive)" stroke="var(--surface-card)" strokeWidth={2} />
    </g>
  );
}

// Card-container padrão usado pelas seções de gráfico/lista da tela.
function PanelCard({ titulo, acaoLabel, onAcao, children }: { titulo: string; acaoLabel?: string; onAcao?: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{titulo}</h3>
        {acaoLabel && onAcao && (
          <button onClick={onAcao} className="text-[11px] font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80">
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
function LinhaAtividade({
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
  onSelectItem,
  onTabChange,
  onOpenSearch,
  onNavigateEstoqueBaixo,
  onNavigateCliente,
  onNavigateClientesSumidos,
  onNavigateFiado,
}: {
  theme?: 'light' | 'dark';
  onSelectItem: (item: Estoque | Venda) => void;
  onTabChange: (tab: string) => void;
  onOpenSearch?: () => void;
  onNavigateEstoqueBaixo?: () => void;
  onNavigateCliente?: (clienteId: string) => void;
  onNavigateClientesSumidos?: () => void;
  onNavigateFiado?: () => void;
}) {
  const { estoque, vendas, caixa, orcamentos, clientes, fiadoRecebimentos, loading } = useData();
  const [searchTerm, setSearchTerm] = useState('');

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

    const valorTotalEstoque = estoque.reduce((sum, item) => sum + Number(item.valor) * Number(item.quantidade), 0);
    const totalUnidadesEstoque = estoque.reduce((sum, item) => sum + Number(item.quantidade), 0);
    const itensEstoqueBaixo = estoque.filter(isEstoqueBaixo);

    const vendasMes = vendas.filter((v) => {
      const d = parseLocalDate(v.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const valorVendasMes = vendasMes.reduce((sum, v) => sum + Number(v.valor_total), 0);
    const ticketMedio = vendasMes.length > 0 ? valorVendasMes / vendasMes.length : 0;

    const saidasMes = caixa.filter((c) => {
      if (c.tipo !== 'saida') return false;
      const d = parseLocalDate(c.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });
    const valorSaidasMes = saidasMes.reduce((sum, c) => sum + Number(c.valor), 0);

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

    return { valorTotalEstoque, totalUnidadesEstoque, itensEstoqueBaixo, vendasMes, valorVendasMes, ticketMedio, valorSaidasMes, ultimasVendas, pendencias, sumidos, topClientes, fiadoEmAberto, fiadoTotalEmAberto };
  }, [estoque, vendas, caixa, orcamentos, clientes, fiadoRecebimentos]);

  // Saldo líquido diário (entradas - saídas) dos últimos 30 dias — série
  // única pro gráfico de área, com o valor de hoje sempre na última posição.
  const chartData = useMemo(() => {
    const dias: { data: string; label: string; valor: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dias.push({ data: key, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), valor: 0 });
    }
    const porDia = new Map(dias.map((d) => [d.data, d]));
    for (const entry of caixa) {
      const linha = porDia.get(entry.data);
      if (!linha) continue;
      linha.valor += entry.tipo === 'entrada' ? Number(entry.valor) : -Number(entry.valor);
    }
    return dias;
  }, [caixa]);

  const pieData = useMemo(() => {
    const porFormaPagamento = new Map<string, number>();
    for (const v of metrics.vendasMes) {
      const nome = v.forma_pagamento?.nome || 'Outro';
      porFormaPagamento.set(nome, (porFormaPagamento.get(nome) || 0) + Number(v.valor_total));
    }
    return Array.from(porFormaPagamento.entries()).map(([name, value]) => ({ name, value }));
  }, [metrics.vendasMes]);

  const temAlerta = metrics.itensEstoqueBaixo.length > 0 || metrics.pendencias.length > 0;

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

          <button className="relative size-9 rounded-control border border-border-default bg-surface-inset text-text-secondary flex items-center justify-center" aria-label="Notificações">
            <Bell size={16} />
            {temAlerta && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-danger" />}
          </button>

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
          contexto={`${metrics.vendasMes.length} vendas`}
          tom="positive"
        />
        <MetricCard
          icone={Wallet}
          label="Saídas do mês"
          valor={formatCurrency(metrics.valorSaidasMes)}
          contexto="Despesas do caixa"
          tom="negative"
        />
        <MetricCard
          icone={Receipt}
          label="Ticket médio"
          valor={formatCurrency(metrics.ticketMedio)}
          contexto="Por venda realizada"
          tom="neutral"
        />
      </div>

      {/* 3. Alertas */}
      {metrics.itensEstoqueBaixo.length > 0 && (
        <AlertBar
          tom="warning"
          icone={AlertTriangle}
          mensagem={`${metrics.itensEstoqueBaixo.length} peça(s) com estoque baixo (≤ 2 unidades)`}
          acaoLabel="Ver itens"
          onAcao={() => onNavigateEstoqueBaixo?.()}
        />
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
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="corDesempenho" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--positive)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--positive)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="valor"
                  stroke="var(--positive)"
                  fill="url(#corDesempenho)"
                  strokeWidth={2}
                  dot={(props: any) => <UltimoPontoDot key={props.index} {...props} totalPontos={chartData.length} />}
                  activeDot={{ r: 4, fill: 'var(--positive)', stroke: 'var(--surface-card)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard titulo="Formas de pagamento">
          <div className="p-4">
            {pieData.length === 0 ? (
              <EmptyState icone={Receipt} mensagem="Sem vendas registradas este mês ainda." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3} stroke="none">
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legenda em lista — nunca flutuante sobre o gráfico */}
                <ul className="mt-3 space-y-2">
                  {pieData.map((entry, i) => (
                    <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0 text-text-secondary">
                        <span className="size-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                      <span className="text-text-primary font-medium shrink-0">{formatCurrency(entry.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
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
    </div>
  );
}
