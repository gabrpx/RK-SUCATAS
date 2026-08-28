// Seção extra do Dashboard, só pra quem tem role 'admin' — visão mais
// detalhada do negócio (faturamento, desempenho da loja, caixa, vendas e
// tarefas) do que o Dashboard padrão mostra pra 'equipe'. Fica num acordeão,
// expandido por padrão pro dono, recolhível se achar a tela longa demais.
//
// Tudo derivado client-side dos mesmos dados que o Dashboard padrão já
// carrega via useData()/useTarefas() — nenhum endpoint novo (mesmo padrão
// documentado no topo de DashboardView.tsx).
//
// Lucro real/bruto/líquido fica de fora de propósito: o sistema não guarda
// custo de aquisição de peça (só o preço de venda em estoque.valor), então
// não há dado pra calcular lucro sem inventar um número. Essa seção fala
// sempre em "dinheiro que entra e sai", nunca em "lucro".
import React, { Children, useMemo, useState } from 'react';
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Store,
  Boxes,
  Receipt,
  Users,
  UserX,
  HandCoins,
  ArrowUpCircle,
  ArrowDownCircle,
  Puzzle,
  ClipboardList,
  CheckCircle2,
  Package,
  ArrowUpToLine,
  ArrowDownToLine,
  MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { cn, parseLocalDate } from '../../utils';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, ChartTooltip, LinhaAtividade } from './DashboardView';
import { linkWhatsapp } from '../../utils/whatsapp';
import { SPRING_MICRO } from '../../components/ui/motion';
import { rankingTopClientes, clientesSumidos } from '../clientes/metricas';
import { resumoFiadoPorCliente } from '../fiado/metricas';
import type { Estoque } from '../estoque/types';
import type { Venda } from '../vendas/types';
import type { CaixaEntry, CaixaPendencia } from '../caixa/types';
import type { Orcamento } from '../orcamentos/types';
import type { Cliente } from '../clientes/types';
import type { FiadoRecebimento } from '../fiado/types';
import type { Tarefa } from '../tarefas/types';

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function noMes(dataStr: string, mes: number, ano: number): boolean {
  const d = parseLocalDate(dataStr);
  return d.getMonth() === mes && d.getFullYear() === ano;
}

// Frase de comparação com o mês anterior, em português direto — nunca só
// "+12%" solto (regra de linguagem fácil de entender desta seção).
function compararComMesPassado(atual: number, anterior: number): { texto: string; positivo: boolean } {
  if (anterior <= 0) {
    return { texto: atual > 0 ? 'Não dá pra comparar (mês passado não teve nada)' : 'Sem comparação com o mês passado', positivo: true };
  }
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  return { texto: `${Math.abs(pct)}% ${pct >= 0 ? 'a mais' : 'a menos'} que o mês passado`, positivo: pct >= 0 };
}

// Lista "nome — valor" com barrinha proporcional ao maior valor do grupo —
// usada tanto pra maiores saídas do caixa quanto pra top categorias vendidas.
function ListaComparativa({ itens, cor }: { itens: { nome: string; valor: number }[]; cor: string }) {
  if (itens.length === 0) return <EmptyState icone={Package} mensagem="Sem dados suficientes neste período." />;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <div className="space-y-3 px-5 py-4">
      {itens.map((item) => (
        <div key={item.nome} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-text-secondary truncate">{item.nome}</span>
            <span className="text-text-primary font-medium shrink-0">{formatCurrency(item.valor)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(item.valor / max) * 100}%`, background: cor }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Subpainel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{titulo}</h4>
      {children}
    </section>
  );
}

// Linha de MetricCards: no mobile vira carrossel com scroll-snap (o valor em
// moeda cabe inteiro em ~78% da largura, sem cortar) e no desktop volta a ser
// grade — mesmo padrão já usado no Dashboard padrão (ver DashboardView, seção
// "Métricas"), aqui centralizado pra não repetir a classe longa em cada linha.
function MetricRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-0.5 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:overflow-visible">
      {Children.map(children, (child) => (
        <div className="shrink-0 w-[78%] snap-start sm:w-auto sm:shrink">{child}</div>
      ))}
    </div>
  );
}

export interface VisaoDonoProps {
  estoque: Estoque[];
  vendas: Venda[];
  caixa: CaixaEntry[];
  orcamentos: Orcamento[];
  clientes: Cliente[];
  fiadoRecebimentos: FiadoRecebimento[];
  caixaPendencias: CaixaPendencia[];
  tarefas: Tarefa[];
  onTabChange: (tab: string) => void;
  onNavigateCliente?: (clienteId: string) => void;
  noTopo?: boolean;
  onAlternarPosicao?: () => void;
  resumoFiado?: { clienteNome: string; totalEmAberto: number; diasEmAbertoMax: number }[];
  resumoFiadoTotal?: number;
  resumoPendenciasManuaisTotal?: number;
}

export function VisaoDono({ estoque, vendas, caixa, orcamentos, clientes, fiadoRecebimentos, caixaPendencias, tarefas, onTabChange, onNavigateCliente, noTopo, onAlternarPosicao, resumoFiado, resumoFiadoTotal, resumoPendenciasManuaisTotal }: VisaoDonoProps) {
  const [expandido, setExpandido] = useState(true);
  const [pendenciaExpandida, setPendenciaExpandida] = useState<string | null>(null);

  const periodo = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const refAnterior = new Date(anoAtual, mesAtual - 1, 1);
    return { mesAtual, anoAtual, mesAnterior: refAnterior.getMonth(), anoMesAnterior: refAnterior.getFullYear() };
  }, []);

  // --- Faturamento & Crescimento ------------------------------------------
  const faturamento = useMemo(() => {
    const vendasMesAtual = vendas.filter((v) => noMes(v.data, periodo.mesAtual, periodo.anoAtual));
    const vendasMesAnterior = vendas.filter((v) => noMes(v.data, periodo.mesAnterior, periodo.anoMesAnterior));
    const totalAtual = vendasMesAtual.reduce((s, v) => s + Number(v.valor_total), 0);
    const totalAnterior = vendasMesAnterior.reduce((s, v) => s + Number(v.valor_total), 0);

    const porCanal = { balcao: 0, mercado_livre: 0 };
    for (const v of vendasMesAtual) porCanal[v.canal] += Number(v.valor_total);

    const novasAdicoes = estoque.filter((e) => noMes(e.criado_em, periodo.mesAtual, periodo.anoAtual));
    const valorNovasAdicoes = novasAdicoes.reduce((s, e) => s + Number(e.valor) * Number(e.quantidade), 0);

    const tendencia: { mes: string; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(periodo.anoAtual, periodo.mesAtual - i, 1);
      const total = vendas.filter((v) => noMes(v.data, ref.getMonth(), ref.getFullYear())).reduce((s, v) => s + Number(v.valor_total), 0);
      tendencia.push({ mes: MESES_ABREV[ref.getMonth()], valor: total });
    }

    return { totalAtual, totalAnterior, vendasMesAtual, porCanal, novasAdicoes: novasAdicoes.length, valorNovasAdicoes, tendencia };
  }, [vendas, estoque, periodo]);

  const variacaoFaturamento = compararComMesPassado(faturamento.totalAtual, faturamento.totalAnterior);

  // --- Desempenho da Loja ---------------------------------------------------
  const desempenho = useMemo(() => {
    const vendasMesAnterior = vendas.filter((v) => noMes(v.data, periodo.mesAnterior, periodo.anoMesAnterior));
    const ticketAtual = faturamento.vendasMesAtual.length > 0 ? faturamento.totalAtual / faturamento.vendasMesAtual.length : 0;
    const ticketAnterior = vendasMesAnterior.length > 0 ? faturamento.totalAnterior / vendasMesAnterior.length : 0;

    // Cliente "novo" = a primeira compra com cadastro dele caiu neste mês.
    const primeiraCompraPorCliente = new Map<string, Date>();
    for (const v of vendas) {
      if (!v.cliente_id) continue;
      const d = parseLocalDate(v.data);
      const atual = primeiraCompraPorCliente.get(v.cliente_id);
      if (!atual || d < atual) primeiraCompraPorCliente.set(v.cliente_id, d);
    }
    let clientesNovos = 0;
    for (const d of primeiraCompraPorCliente.values()) {
      if (d.getMonth() === periodo.mesAtual && d.getFullYear() === periodo.anoAtual) clientesNovos++;
    }

    const topClientesCompleto = rankingTopClientes(clientes, vendas, orcamentos, { limite: 10 });
    const sumidosCompleto = clientesSumidos(clientes, vendas, orcamentos);
    const fiadoCalculado = resumoFiadoPorCliente(vendas, fiadoRecebimentos);
    const fiadoCompleto = fiadoCalculado.length > 0 ? fiadoCalculado : (resumoFiado || []);
    const fiadoTotalGeral = fiadoCompleto.length > 0 && fiadoCalculado.length > 0
      ? fiadoCompleto.reduce((s, r) => s + r.totalEmAberto, 0)
      : (resumoFiadoTotal ?? 0);

    const pendenciasManuaisAberto = caixaPendencias.filter((p) => p.status === 'aberta');
    const pendenciasManuaisTotal = pendenciasManuaisAberto.reduce((s, p) => s + Number(p.valor_total), 0);
    const pendenciasTotalGeral = fiadoTotalGeral + (pendenciasManuaisTotal || resumoPendenciasManuaisTotal || 0);
    const pendenciasQtdGeral = fiadoCompleto.length + pendenciasManuaisAberto.length;

    const agora = new Date();
    const pendenciasUnificadas: Array<{
      chave: string;
      clienteNome: string | null;
      descricao: string;
      diasEmAberto: number;
      valor: number;
      clienteId: string | null;
      telefone: string | null;
      dataTexto: string;
    }> = [];

    for (const f of fiadoCompleto) {
      const clienteObj = f.clienteId ? clientes.find((c) => c.id === f.clienteId) : null;
      pendenciasUnificadas.push({
        chave: `fiado-${f.clienteId ?? f.clienteNome}`,
        clienteNome: f.clienteNome,
        descricao: `${f.vendas.length} venda${f.vendas.length === 1 ? '' : 's'} fiado`,
        diasEmAberto: f.diasEmAbertoMax,
        valor: f.totalEmAberto,
        clienteId: f.clienteId ?? null,
        telefone: clienteObj?.telefone ?? null,
        dataTexto: f.vendas.length > 0 ? new Date(`${f.vendas[0].venda.data}T00:00:00`).toLocaleDateString('pt-BR') : '',
      });
    }

    for (const p of pendenciasManuaisAberto) {
      const dias = Math.max(0, Math.floor((agora.getTime() - new Date(`${p.data}T00:00:00`).getTime()) / 86400000));
      pendenciasUnificadas.push({
        chave: `manual-${p.id}`,
        clienteNome: p.cliente?.nome ?? null,
        descricao: p.descricao,
        diasEmAberto: dias,
        valor: Number(p.valor_total),
        clienteId: p.cliente_id,
        telefone: p.cliente?.telefone ?? null,
        dataTexto: new Date(`${p.data}T00:00:00`).toLocaleDateString('pt-BR'),
      });
    }

    pendenciasUnificadas.sort((a, b) => b.diasEmAberto - a.diasEmAberto);

    return { ticketAtual, ticketAnterior, clientesNovos, topClientesCompleto, sumidosCompleto, fiadoCompleto, fiadoTotalGeral, pendenciasTotalGeral, pendenciasQtdGeral, pendenciasUnificadas };
  }, [vendas, clientes, orcamentos, fiadoRecebimentos, caixaPendencias, periodo, faturamento.totalAtual, faturamento.totalAnterior, faturamento.vendasMesAtual, resumoFiado, resumoFiadoTotal, resumoPendenciasManuaisTotal]);

  const variacaoTicket = compararComMesPassado(desempenho.ticketAtual, desempenho.ticketAnterior);

  // --- Caixa Detalhado --------------------------------------------------------
  const caixaDetalhado = useMemo(() => {
    const caixaMesAtual = caixa.filter((c) => noMes(c.data, periodo.mesAtual, periodo.anoAtual));
    const entradas = caixaMesAtual.filter((c) => c.tipo === 'entrada').reduce((s, c) => s + Number(c.valor), 0);
    const saidas = caixaMesAtual.filter((c) => c.tipo === 'saida').reduce((s, c) => s + Number(c.valor), 0);

    const saidasPorDescricao = new Map<string, number>();
    for (const c of caixaMesAtual) {
      if (c.tipo !== 'saida') continue;
      saidasPorDescricao.set(c.descricao, (saidasPorDescricao.get(c.descricao) ?? 0) + Number(c.valor));
    }
    const maioresSaidas = Array.from(saidasPorDescricao.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    // Saldo acumulado dia a dia dentro do mês atual (diferente do gráfico
    // "Desempenho (30 dias)" do Dashboard padrão, que é janela corrida).
    const hoje = new Date();
    const diasNoMes = new Date(periodo.anoAtual, periodo.mesAtual + 1, 0).getDate();
    const ehMesCorrente = periodo.mesAtual === hoje.getMonth() && periodo.anoAtual === hoje.getFullYear();
    const ultimoDia = ehMesCorrente ? hoje.getDate() : diasNoMes;

    const porDia = new Map<number, number>();
    for (const c of caixaMesAtual) {
      const dia = parseLocalDate(c.data).getDate();
      porDia.set(dia, (porDia.get(dia) ?? 0) + (c.tipo === 'entrada' ? Number(c.valor) : -Number(c.valor)));
    }
    let acumulado = 0;
    const saldoAcumulado: { dia: string; valor: number }[] = [];
    for (let dia = 1; dia <= ultimoDia; dia++) {
      acumulado += porDia.get(dia) ?? 0;
      saldoAcumulado.push({ dia: String(dia), valor: acumulado });
    }

    return { entradas, saidas, maioresSaidas, saldoAcumulado, saldoFinal: acumulado };
  }, [caixa, periodo]);

  // --- Vendas Detalhadas -------------------------------------------------------
  const vendasDetalhadas = useMemo(() => {
    const estoquePorId = new Map(estoque.map((e) => [e.id, e]));

    const porCategoria = new Map<string, number>();
    for (const v of faturamento.vendasMesAtual) {
      const item = v.estoque_id ? estoquePorId.get(v.estoque_id) : null;
      const nomeCategoria = item?.categoria?.nome || 'Sem categoria';
      porCategoria.set(nomeCategoria, (porCategoria.get(nomeCategoria) ?? 0) + Number(v.valor_total));
    }
    const topCategorias = Array.from(porCategoria.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    const emPartes = faturamento.vendasMesAtual.filter((v) => v.componente_vendido || v.unidade_id);
    const valorEmPartes = emPartes.reduce((s, v) => s + Number(v.valor_total), 0);
    const percentualEmPartes = faturamento.totalAtual > 0 ? (valorEmPartes / faturamento.totalAtual) * 100 : 0;

    const ultimasVendas = [...vendas].sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime()).slice(0, 15);

    return { topCategorias, percentualEmPartes, quantidadeEmPartes: emPartes.length, ultimasVendas };
  }, [vendas, estoque, faturamento.vendasMesAtual, faturamento.totalAtual]);

  // --- Tarefas: Atribuição e Acompanhamento -------------------------------
  const tarefasResumo = useMemo(() => {
    const pendentes = tarefas.filter((t) => t.status === 'pendente');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const porResponsavel = new Map<string, { total: number; atrasadas: number }>();
    for (const t of pendentes) {
      const nome = t.atribuido?.nome_exibicao || 'Sem responsável';
      const atual = porResponsavel.get(nome) ?? { total: 0, atrasadas: 0 };
      atual.total += 1;
      if (t.prazo && parseLocalDate(t.prazo) < hoje) atual.atrasadas += 1;
      porResponsavel.set(nome, atual);
    }

    return {
      pendentesTotal: pendentes.length,
      porResponsavel: Array.from(porResponsavel.entries()).sort((a, b) => b[1].total - a[1].total),
      geral: pendentes.filter((t) => t.tipo === 'geral').length,
      visita: pendentes.filter((t) => t.tipo === 'visita').length,
    };
  }, [tarefas]);

  return (
    <div className="bg-surface-card border border-border-subtle rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-accent-soft-bg/40 hover:bg-accent-soft-bg/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-sm font-semibold text-text-primary truncate">Visão completa do negócio</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onAlternarPosicao && (
            <span
              role="button"
              tabIndex={0}
              title={noTopo ? 'Mover para o final' : 'Mover para o topo'}
              onClick={(e) => { e.stopPropagation(); onAlternarPosicao(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onAlternarPosicao(); } }}
              className="p-1 rounded-control text-text-faint hover:text-text-secondary hover:bg-surface-inset transition-colors"
            >
              {noTopo ? <ArrowDownToLine size={15} /> : <ArrowUpToLine size={15} />}
            </span>
          )}
          <ChevronDown size={18} className={cn('text-text-faint transition-transform shrink-0', expandido && 'rotate-180')} />
        </div>
      </button>

      {expandido && (
        <div className="p-4 md:p-5 space-y-8 border-t border-border-subtle">
          {/* Faturamento & Crescimento */}
          <Subpainel titulo="Faturamento & Crescimento">
            <MetricRow>
              <MetricCard
                icone={variacaoFaturamento.positivo ? TrendingUp : TrendingDown}
                label="Quanto entrou este mês"
                valor={faturamento.totalAtual}
                formatarValor={formatCurrency}
                contexto={variacaoFaturamento.texto}
                tom={variacaoFaturamento.positivo ? 'positive' : 'negative'}
              />
              <MetricCard icone={ShoppingCart} label="Vendido no balcão" valor={faturamento.porCanal.balcao} formatarValor={formatCurrency} contexto="Neste mês" tom="neutral" />
              <MetricCard icone={Store} label="Vendido no Mercado Livre" valor={faturamento.porCanal.mercado_livre} formatarValor={formatCurrency} contexto="Neste mês" tom="neutral" />
              <MetricCard
                icone={Boxes}
                label="Peças novas no estoque"
                valor={faturamento.novasAdicoes}
                contexto={`${formatCurrency(faturamento.valorNovasAdicoes)} em valor de venda`}
                tom="neutral"
              />
            </MetricRow>
            <div className="bg-surface-inset rounded-control p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint mb-3">Como o faturamento andou nos últimos 6 meses</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={faturamento.tendencia} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-faint)' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-raised)' }} />
                  <Bar dataKey="valor" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Subpainel>

          {/* Desempenho da Loja */}
          <Subpainel titulo="Desempenho da Loja">
            <MetricRow>
              <MetricCard
                icone={Receipt}
                label="Ticket médio"
                valor={desempenho.ticketAtual}
                formatarValor={formatCurrency}
                contexto={variacaoTicket.texto}
                tom={variacaoTicket.positivo ? 'positive' : 'negative'}
              />
              <MetricCard icone={Users} label="Clientes novos" valor={desempenho.clientesNovos} contexto="Primeira compra este mês" tom="neutral" />
              <MetricCard icone={UserX} label="Clientes sumidos" valor={desempenho.sumidosCompleto.length} contexto="90+ dias sem comprar" tom="neutral" />
              <MetricCard
                icone={HandCoins}
                label="Pendências em aberto"
                valor={desempenho.pendenciasTotalGeral}
                formatarValor={formatCurrency}
                contexto={`${desempenho.pendenciasQtdGeral} pendência(s)`}
                tom={desempenho.pendenciasTotalGeral > 0 ? 'negative' : 'positive'}
              />
            </MetricRow>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-surface-inset rounded-control overflow-hidden">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint px-5 pt-4 pb-2">Quem mais compra</p>
                {desempenho.topClientesCompleto.length === 0 ? (
                  <EmptyState icone={Users} mensagem="Nenhuma venda vinculada a um cliente cadastrado ainda." />
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {desempenho.topClientesCompleto.map(({ cliente, totalGasto, quantidadeCompras }) => (
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
              </div>

              <div className="bg-surface-inset rounded-control overflow-hidden">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint px-5 pt-4 pb-2">Pendências em aberto — quem deve e há quanto tempo</p>
                {desempenho.pendenciasUnificadas.length === 0 ? (
                  <EmptyState icone={HandCoins} mensagem="Nenhuma pendência em aberto no momento." />
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {desempenho.pendenciasUnificadas.slice(0, 10).map((r) => {
                      const aberto = pendenciaExpandida === r.chave;
                      const titulo = r.clienteNome || r.descricao;
                      const subtitulo = r.clienteNome ? r.descricao : null;
                      return (
                        <div key={r.chave}>
                          <div
                            onClick={() => setPendenciaExpandida(aberto ? null : r.chave)}
                            className="flex items-center gap-3 px-5 py-3 transition-colors duration-fast cursor-pointer hover:bg-surface-raised"
                          >
                            <div className="size-8 rounded-control flex items-center justify-center shrink-0 bg-warning-bg text-warning">
                              <HandCoins size={15} strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary truncate">{titulo}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {subtitulo && <span className="text-2xs text-text-faint truncate max-w-[140px]">{subtitulo}</span>}
                                <StatusBadge texto={`${r.diasEmAberto} dia${r.diasEmAberto === 1 ? '' : 's'}`} tom="neutral" />
                              </div>
                            </div>
                            <span className="text-sm font-medium shrink-0 tabular-nums text-warning">{formatCurrency(r.valor)}</span>
                            <ChevronDown size={14} className={cn('text-text-faint transition-transform duration-200 shrink-0', aberto && 'rotate-180')} />
                          </div>
                          <AnimatePresence initial={false}>
                            {aberto && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={SPRING_MICRO}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-3 pt-1 space-y-2.5">
                                  <div className="text-xs text-text-secondary space-y-0.5">
                                    {r.clienteNome && <p className="text-text-primary font-medium">{r.clienteNome} — {r.descricao}</p>}
                                    {!r.clienteNome && <p>{r.descricao}</p>}
                                    {r.dataTexto && <p className="text-text-faint">Desde {r.dataTexto}</p>}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {r.telefone && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const msg = `Olá ${r.clienteNome || 'Cliente'}! Passando para lembrar do valor pendente de ${formatCurrency(r.valor)}. Qualquer dúvida estou à disposição.`;
                                          const url = linkWhatsapp(r.telefone, msg);
                                          if (url) window.open(url, '_blank');
                                        }}
                                        className="h-8 px-3 rounded-control text-xs font-medium gap-1.5 border border-positive/30 text-positive hover:bg-positive-bg inline-flex items-center"
                                      >
                                        <MessageCircle size={13} /> WhatsApp
                                      </button>
                                    )}
                                    {r.clienteId && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onNavigateCliente?.(r.clienteId!);
                                        }}
                                        className="h-8 px-3 rounded-control text-xs font-medium gap-1.5 border border-border-subtle text-text-secondary hover:bg-surface-raised inline-flex items-center"
                                      >
                                        <Users size={13} /> Ver cliente
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onTabChange('caixa');
                                      }}
                                      className="h-8 px-3 rounded-control text-xs font-medium gap-1.5 border border-border-subtle text-text-secondary hover:bg-surface-raised inline-flex items-center"
                                    >
                                      <Receipt size={13} /> Ver no Caixa
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Subpainel>

          {/* Caixa Detalhado */}
          <Subpainel titulo="Caixa Detalhado">
            <MetricRow>
              <MetricCard icone={ArrowUpCircle} label="Quanto entrou" valor={caixaDetalhado.entradas} formatarValor={formatCurrency} contexto="Neste mês" tom="positive" />
              <MetricCard icone={ArrowDownCircle} label="Quanto saiu" valor={caixaDetalhado.saidas} formatarValor={formatCurrency} contexto="Neste mês" tom="negative" />
              <MetricCard
                icone={caixaDetalhado.saldoFinal >= 0 ? TrendingUp : TrendingDown}
                label="Quanto sobrou no caixa"
                valor={caixaDetalhado.saldoFinal}
                formatarValor={formatCurrency}
                contexto="Acumulado do mês"
                tom={caixaDetalhado.saldoFinal >= 0 ? 'positive' : 'negative'}
              />
            </MetricRow>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-surface-inset rounded-control overflow-hidden">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint px-5 pt-4 pb-1">Para onde o dinheiro foi</p>
                <ListaComparativa itens={caixaDetalhado.maioresSaidas} cor="var(--negative)" />
              </div>
              <div className="bg-surface-inset rounded-control p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint mb-3">Saldo do caixa ao longo do mês</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={caixaDetalhado.saldoAcumulado} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="dia" hide />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke={caixaDetalhado.saldoFinal >= 0 ? 'var(--positive)' : 'var(--negative)'}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Subpainel>

          {/* Vendas Detalhadas */}
          <Subpainel titulo="Vendas Detalhadas">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-surface-inset rounded-control overflow-hidden">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint px-5 pt-4 pb-1">O que mais vende</p>
                <ListaComparativa itens={vendasDetalhadas.topCategorias} cor="var(--accent)" />
              </div>

              <div className="grid grid-cols-1 gap-3 content-start">
                <MetricCard
                  icone={Puzzle}
                  label="Vendido em peças avulsas"
                  valor={vendasDetalhadas.percentualEmPartes}
                  formatarValor={(v) => `${v.toFixed(0)}%`}
                  contexto={`${vendasDetalhadas.quantidadeEmPartes} venda(s) de partes de um item, não do item inteiro`}
                  tom="neutral"
                />
                <div className="bg-surface-inset rounded-control overflow-hidden">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint px-5 pt-4 pb-2">Vendas mais recentes</p>
                  {vendasDetalhadas.ultimasVendas.length === 0 ? (
                    <EmptyState icone={ShoppingCart} mensagem="Nenhuma venda registrada ainda." />
                  ) : (
                    <div className="divide-y divide-border-subtle max-h-72 overflow-y-auto">
                      {vendasDetalhadas.ultimasVendas.map((v) => (
                        <div key={v.id}>
                          <LinhaAtividade
                            icone={CheckCircle2}
                            tom="positive"
                            titulo={v.nome_item}
                            legenda={v.canal === 'mercado_livre' ? 'Mercado Livre' : 'Balcão'}
                            data={parseLocalDate(v.data).toLocaleDateString('pt-BR')}
                            valor={v.valor_total}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Subpainel>

          {/* Tarefas — Atribuição e Acompanhamento */}
          <Subpainel titulo="Tarefas — Atribuição e Acompanhamento">
            <div className="bg-surface-inset rounded-control overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="text-sm text-text-secondary">
                    <span className="text-text-primary font-medium">{tarefasResumo.pendentesTotal}</span> pendente(s)
                  </span>
                  <span className="text-sm text-text-secondary">
                    <span className="text-text-primary font-medium">{tarefasResumo.geral}</span> geral · <span className="text-text-primary font-medium">{tarefasResumo.visita}</span> visita
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange('tarefas')}
                  className="-my-2 -mr-2 py-2 px-2 rounded-control text-[11px] font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80 shrink-0"
                >
                  + Nova tarefa
                </button>
              </div>
              {tarefasResumo.porResponsavel.length === 0 ? (
                <EmptyState icone={ClipboardList} mensagem="Nenhuma tarefa pendente no momento." />
              ) : (
                <div className="divide-y divide-border-subtle border-t border-border-subtle">
                  {tarefasResumo.porResponsavel.map(([nome, { total, atrasadas }]) => (
                    <div key={nome} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="text-sm text-text-primary truncate">{nome}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge texto={`${total} pendente${total === 1 ? '' : 's'}`} tom="neutral" />
                        {atrasadas > 0 && <StatusBadge texto={`${atrasadas} atrasada${atrasadas === 1 ? '' : 's'}`} tom="danger" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Subpainel>
        </div>
      )}
    </div>
  );
}
