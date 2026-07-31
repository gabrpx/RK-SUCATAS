// Painel com a visão geral do negócio: valor em estoque, vendas do mês,
// saídas do caixa, desempenho dos últimos 30 dias e atividade recente.
// Todas as métricas são derivadas client-side de estoque/vendas/caixa — não
// existe endpoint de dashboard dedicado (mesmo padrão do sistema anterior).
import { useMemo, useState } from 'react';
import { Package, ShoppingCart, Wallet, Eye, EyeOff, TrendingUp, TrendingDown, Box } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import type { Estoque } from '../estoque/types';
import type { Venda } from '../vendas/types';

const COLORS = ['#8b5cf6', '#34d399', '#fb7185', '#f59e0b', '#3b82f6'];

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  theme,
  isSensitive,
  showSensitiveInfo,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  theme: 'light' | 'dark';
  isSensitive?: boolean;
  showSensitiveInfo: boolean;
  tone?: 'emerald' | 'rose';
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn(
        'group relative border p-5 sm:p-6 rounded-[2rem] overflow-hidden flex flex-col justify-between h-full transition-all duration-300',
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50 shadow-2xl hover:border-violet-500/40' : 'bg-white border-zinc-200 shadow-xl'
      )}
    >
      <div className={cn('absolute -right-8 -top-8 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity', color)} />
      <div className={cn('p-3 rounded-2xl w-fit mb-4', theme === 'dark' ? 'bg-zinc-800/80 text-zinc-400' : 'bg-zinc-100 text-zinc-500')}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <span className={cn('text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-50', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500')}>{label}</span>
        <h3
          className={cn(
            'text-lg sm:text-2xl font-black tracking-tighter',
            isSensitive && !showSensitiveInfo && 'blur-xl select-none',
            tone === 'emerald' && 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]',
            tone === 'rose' && 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]',
            !tone && (theme === 'dark' ? 'text-white' : 'text-zinc-900')
          )}
        >
          {value}
        </h3>
        {subValue && <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate opacity-70 mt-1">{subValue}</p>}
      </div>
    </motion.div>
  );
}

export function DashboardView({ theme, onSelectItem, onTabChange }: { theme: 'light' | 'dark'; onSelectItem: (item: Estoque | Venda) => void; onTabChange: (tab: string) => void }) {
  const { estoque, vendas, caixa, showSensitiveInfo, setShowSensitiveInfo } = useData();
  const [pieDestaque, setPieDestaque] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const valorTotalEstoque = estoque.reduce((sum, item) => sum + Number(item.valor) * Number(item.quantidade), 0);
    const totalUnidadesEstoque = estoque.reduce((sum, item) => sum + Number(item.quantidade), 0);
    const estoqueBaixo = estoque.filter((item) => item.quantidade > 0 && item.quantidade <= 2).length;

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
    const ultimosItens = [...estoque].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()).slice(0, 5);

    return { valorTotalEstoque, totalUnidadesEstoque, estoqueBaixo, vendasMes, valorVendasMes, ticketMedio, saidasMes, valorSaidasMes, ultimasVendas, ultimosItens };
  }, [estoque, vendas, caixa]);

  const chartData = useMemo(() => {
    const dias: { data: string; label: string; entradas: number; saidas: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dias.push({ data: key, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), entradas: 0, saidas: 0 });
    }
    const porDia = new Map(dias.map((d) => [d.data, d]));
    for (const entry of caixa) {
      const linha = porDia.get(entry.data);
      if (!linha) continue;
      if (entry.tipo === 'entrada') linha.entradas += Number(entry.valor);
      else linha.saidas += Number(entry.valor);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Dashboard</h2>
        <button onClick={() => setShowSensitiveInfo((v) => !v)} className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-800/50 transition-colors" title={showSensitiveInfo ? 'Ocultar valores' : 'Mostrar valores'}>
          {showSensitiveInfo ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={Package} label="Valor em Estoque" value={formatCurrency(metrics.valorTotalEstoque)} subValue={`${metrics.totalUnidadesEstoque} unidades`} color="bg-violet-500" theme={theme} isSensitive showSensitiveInfo={showSensitiveInfo} tone="emerald" />
        <StatCard icon={ShoppingCart} label="Vendas (Mês)" value={formatCurrency(metrics.valorVendasMes)} subValue={`${metrics.vendasMes.length} vendas`} color="bg-emerald-500" theme={theme} isSensitive showSensitiveInfo={showSensitiveInfo} tone="emerald" />
        <StatCard icon={Wallet} label="Saídas (Mês)" value={formatCurrency(metrics.valorSaidasMes)} subValue="Despesas do caixa" color="bg-rose-500" theme={theme} isSensitive showSensitiveInfo={showSensitiveInfo} tone="rose" />
        <StatCard icon={Box} label="Ticket Médio" value={formatCurrency(metrics.ticketMedio)} subValue="Por venda realizada" color="bg-amber-500" theme={theme} isSensitive showSensitiveInfo={showSensitiveInfo} />
      </div>

      {metrics.estoqueBaixo > 0 && (
        <div className={cn('flex items-center gap-3 px-5 py-3 rounded-2xl border', theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')}>
          <TrendingDown size={16} />
          <span className="text-sm font-medium">{metrics.estoqueBaixo} peça(s) com estoque baixo (≤ 2 unidades)</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cn('lg:col-span-2 rounded-3xl border p-5 md:p-6', theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-white border-zinc-200 shadow-sm')}>
          <h3 className={cn('text-sm font-black uppercase tracking-widest mb-4', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500')}>Desempenho (30 dias)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="corEntrada" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="corSaida" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} interval={4} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: theme === 'dark' ? '#18181b' : '#fff', border: 'none', borderRadius: 12, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="entradas" stroke="#34d399" fill="url(#corEntrada)" strokeWidth={2} name="Entradas" />
              <Area type="monotone" dataKey="saidas" stroke="#fb7185" fill="url(#corSaida)" strokeWidth={2} name="Saídas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={cn('rounded-3xl border p-5 md:p-6', theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-white border-zinc-200 shadow-sm')}>
          <h3 className={cn('text-sm font-black uppercase tracking-widest mb-4', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500')}>Vendas por Forma de Pagamento</h3>
          {pieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-zinc-500 text-sm">Sem vendas este mês</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} onMouseEnter={(_, i) => setPieDestaque(pieData[i].name)} onMouseLeave={() => setPieDestaque(null)}>
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} opacity={pieDestaque && pieDestaque !== entry.name ? 0.4 : 1} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: theme === 'dark' ? '#18181b' : '#fff', border: 'none', borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {pieData.map((entry, i) => (
              <span key={entry.name} className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {entry.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cn('rounded-3xl border overflow-hidden', theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-white border-zinc-200 shadow-sm')}>
          <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
            <h3 className={cn('text-sm font-black uppercase tracking-widest', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500')}>Últimas Vendas</h3>
            <button onClick={() => onTabChange('vendas')} className="text-[10px] font-bold uppercase text-violet-500 hover:underline">
              Ver todas
            </button>
          </div>
          {metrics.ultimasVendas.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {metrics.ultimasVendas.map((v) => (
                <div key={v.id} onClick={() => onSelectItem(v)} className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-zinc-800/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{v.nome_item}</p>
                    <p className="text-xs text-zinc-500">{parseLocalDate(v.data).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className="text-sm font-black text-emerald-500 shrink-0">{formatCurrency(v.valor_total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn('rounded-3xl border overflow-hidden', theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-white border-zinc-200 shadow-sm')}>
          <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
            <h3 className={cn('text-sm font-black uppercase tracking-widest', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500')}>Últimos Itens Adicionados</h3>
            <button onClick={() => onTabChange('estoque')} className="text-[10px] font-bold uppercase text-violet-500 hover:underline">
              Ver todos
            </button>
          </div>
          {metrics.ultimosItens.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">Nenhuma peça cadastrada ainda.</p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {metrics.ultimosItens.map((item) => (
                <div key={item.id} onClick={() => onSelectItem(item)} className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-zinc-800/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{item.nome}</p>
                    <p className="text-xs text-zinc-500">
                      {item.categoria?.nome || '-'} · {item.quantidade} un.
                    </p>
                  </div>
                  <span className="text-sm font-black text-emerald-500 shrink-0">{formatCurrency(item.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
