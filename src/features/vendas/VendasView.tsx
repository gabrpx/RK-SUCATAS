// Aba Vendas: registra a venda de um item do Estoque. Ao salvar, o backend
// (via registrar_venda) baixa a quantidade no Estoque e lança a entrada
// correspondente no Caixa — tudo numa transação só, então esta tela nunca
// precisa se preocupar em manter as três tabelas sincronizadas na mão.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Search, Plus, Trash2, X, Loader2, Calendar, Package, Edit2, AlertCircle } from 'lucide-react';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { aviso } from '../../components/ui/toast';
import { CustomDropdown } from '../../components/CustomDropdown';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { vendasApi } from './api';
import { SeletorCliente } from '../clientes/SeletorCliente';
import { useSincronizacaoMl } from '../mercadolivre/SincronizacaoMlContext';
import { PromocaoBadge } from '../promocoes/PromocaoBadge';
import { formaPagamentoEfetiva, saldoPorVenda } from '../fiado/metricas';
import { valorRestanteEstimado, valorVendidoEmPartes } from './metricas';
import type { Venda } from './types';
import type { Estoque } from '../estoque/types';
import type { Role } from '../../constants/roles';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

type PeriodoFiltro = 'hoje' | '7d' | '30d' | 'mes' | 'tudo';

function isDentroDoPeriodo(dataStr: string, periodo: PeriodoFiltro): boolean {
  if (periodo === 'tudo') return true;
  const data = parseLocalDate(dataStr);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);
  const diffDias = Math.round((hoje.getTime() - data.getTime()) / 86400000);
  if (periodo === 'hoje') return diffDias === 0;
  if (periodo === '7d') return diffDias >= 0 && diffDias < 7;
  if (periodo === '30d') return diffDias >= 0 && diffDias < 30;
  if (periodo === 'mes') return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  return true;
}

interface VendasViewProps {
  onSelectItem: (item: Venda) => void;
  onRegisterActions?: (actions: { edit: (item: Venda) => void; delete: (id: string) => void }) => void;
  userRoles?: Role[];
}

export function VendasView({ onSelectItem, onRegisterActions, userRoles = [] }: VendasViewProps) {
  const { vendas, setVendas, estoque, fiadoRecebimentos, refreshData, loading } = useData();
  const { formasPagamento } = useCatalogos();
  const { abrir: abrirSincronizacao } = useSincronizacaoMl();
  const podeForcarCancelamento = userRoles.includes('admin');
  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [pagamentoFiltro, setPagamentoFiltro] = useState('Todos');
  const [isNovaVendaOpen, setIsNovaVendaOpen] = useState(false);
  const [vendaToCancel, setVendaToCancel] = useState<Venda | null>(null);
  const [cancelando, setCancelando] = useState(false);

  // Recebimentos de fiado já confirmados pra venda em confirmação de
  // cancelamento — se houver algum, o cancelamento normal (cancelar_venda)
  // falha por causa do "on delete restrict" (ver migration_031), então a UI
  // precisa oferecer o caminho de reversão em cascata (migration_037).
  const recebidoDoVendaToCancel = vendaToCancel ? Number(vendaToCancel.valor_total) - saldoPorVenda(vendaToCancel, fiadoRecebimentos) : 0;
  const temRecebimentoFiado = recebidoDoVendaToCancel > 0.01;

  const filtered = useMemo(() => {
    return vendas
      .filter((v) => isDentroDoPeriodo(v.data, periodo))
      .filter((v) => pagamentoFiltro === 'Todos' || v.forma_pagamento_id === pagamentoFiltro)
      .filter((v) => v.nome_item.toLowerCase().includes(search.toLowerCase()) || (v.cliente_nome || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime());
  }, [vendas, periodo, pagamentoFiltro, search]);

  const totalVendido = useMemo(() => filtered.reduce((sum, v) => sum + Number(v.valor_total), 0), [filtered]);

  const handleCancelar = async () => {
    if (!vendaToCancel) return;
    setCancelando(true);
    try {
      const result = temRecebimentoFiado ? await vendasApi.cancelarFiadoCompleto(vendaToCancel.id) : await vendasApi.cancelar(vendaToCancel.id);
      if (!result.success) throw new Error(result.error);
      const itemCancelado = vendaToCancel.estoque_id ? estoque.find((e) => e.id === vendaToCancel.estoque_id) : undefined;
      // Cancelar mexe em vendas + estoque + caixa ao mesmo tempo — resincroniza tudo.
      await refreshData();
      setVendaToCancel(null);
      if ((itemCancelado?.links_ml?.length ?? 0) > 0) {
        aviso.info('A quantidade deste item voltou pro estoque', {
          descricao: 'Sincronize pra refletir isso no(s) anúncio(s) do Mercado Livre também.',
          acao: { label: 'Sincronizar agora', onClick: () => abrirSincronizacao([itemCancelado!.id]) },
        });
      }
    } catch (err: any) {
      aviso.falha(err, 'Erro ao cancelar venda');
    } finally {
      setCancelando(false);
    }
  };

  useEffect(() => {
    onRegisterActions?.({
      edit: () => {},
      delete: (id: string) => {
        const venda = vendas.find((v) => v.id === id);
        if (venda) setVendaToCancel(venda);
      },
    });
  }, [onRegisterActions, vendas]);

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 rounded-2xl">
            <ShoppingCart className="text-violet-500" size={28} />
          </div>
          <div>
            <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', 'text-white')}>Vendas</h2>
            <p className="text-sm text-zinc-500">
              {filtered.length} vendas · {formatCurrency(totalVendido)} no período
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsNovaVendaOpen(true)}
          className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-violet-500/20"
        >
          <Plus size={18} /> Nova Venda
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className={cn('flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border', 'bg-zinc-900 border-zinc-800')}>
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por peça ou cliente..." className="bg-transparent outline-none text-sm w-full" />
        </div>
        <CustomDropdown
          icon={<Calendar size={14} />}
          value={periodo}
          onChange={(v) => setPeriodo(v as PeriodoFiltro)}
          options={[
            { value: 'hoje', label: 'Hoje' },
            { value: '7d', label: '7 dias' },
            { value: '30d', label: '30 dias' },
            { value: 'mes', label: 'Este mês' },
            { value: 'tudo', label: 'Tudo' },
          ]}
        />
        <CustomDropdown
          value={pagamentoFiltro}
          onChange={setPagamentoFiltro}
          options={[{ value: 'Todos', label: 'Todas formas' }, ...formasPagamento.map((p) => ({ value: p.id, label: p.nome }))]}
        />
      </div>

      {/* Lista */}
      <div className={cn('rounded-3xl border overflow-hidden', 'bg-zinc-900/50 border-zinc-800')}>
        {loading && vendas.length === 0 ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-violet-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">Nenhuma venda encontrada para este filtro.</div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filtered.map((venda) => (
              <div key={venda.id} onClick={() => onSelectItem(venda)} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-800/20 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                    <Package size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={cn('font-bold text-sm truncate min-w-0', 'text-white')}>
                        {venda.quantidade > 1 ? `${venda.quantidade}x ` : ''}
                        {venda.nome_item}
                      </p>
                      {venda.canal === 'mercado_livre' && (
                        <span className="shrink-0">
                          <StatusBadge texto="Mercado Livre" tom="accent" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                      {parseLocalDate(venda.data).toLocaleDateString('pt-BR')}
                      {(() => {
                        const efetiva = formaPagamentoEfetiva(venda, fiadoRecebimentos);
                        if (!efetiva) return <span>· {venda.forma_pagamento?.nome}</span>;
                        return (
                          <span className="flex items-center gap-1">
                            · {efetiva.formas.join(', ')}
                            {!efetiva.quitadoTotal && (
                              <span className="shrink-0">
                                <StatusBadge texto="Parcial" tom="warning" />
                              </span>
                            )}
                          </span>
                        );
                      })()}
                      {venda.cliente_nome && <span>· {venda.cliente_nome}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-black text-sm text-emerald-500">{formatCurrency(venda.valor_total)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVendaToCancel(venda);
                    }}
                    className="p-2 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Cancelar venda (devolve o estoque)"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NovaVendaModal isOpen={isNovaVendaOpen} onClose={() => setIsNovaVendaOpen(false)} />

      {/* Confirmação de cancelamento */}
      <AnimatePresence>
        {vendaToCancel && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn('w-full max-w-sm rounded-3xl border p-6 text-center', 'bg-zinc-950 border-zinc-800')}>
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-4">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-lg font-black mb-2">Cancelar esta venda?</h3>
              <p className="text-sm text-zinc-500 mb-6">
                "{vendaToCancel.nome_item}" ({formatCurrency(vendaToCancel.valor_total)}) será removida. A quantidade volta pro estoque e a entrada no caixa é desfeita.
              </p>
              {temRecebimentoFiado && (
                <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4 text-left">
                  Esta venda já tem {formatCurrency(recebidoDoVendaToCancel)} recebido(s) via fiado.
                  {podeForcarCancelamento
                    ? ' Cancelar aqui também reverte esse(s) recebimento(s) e as entradas de caixa vinculadas.'
                    : ' Só um admin pode cancelar uma venda fiado já com recebimento.'}
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setVendaToCancel(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-zinc-900 text-zinc-300">
                  Voltar
                </button>
                <button
                  onClick={handleCancelar}
                  disabled={cancelando || (temRecebimentoFiado && !podeForcarCancelamento)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelando ? <Loader2 size={16} className="animate-spin" /> : temRecebimentoFiado ? 'Reverter e cancelar' : 'Cancelar venda'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NovaVendaModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { estoque, vendas, refreshData } = useData();
  const { formasPagamento } = useCatalogos();
  const { abrir: abrirSincronizacao } = useSincronizacaoMl();
  const [busca, setBusca] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState<Estoque | null>(null);
  const [componenteSelecionado, setComponenteSelecionado] = useState<string | null>(null);
  // Ficha específica (unidade física) escolhida pra vender, em vez de uma
  // unidade genérica do lote — sempre opcional, mutuamente exclusivo com
  // componente (não dá pra vender uma ficha inteira E só uma parte dela).
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState('1');
  const [valorUnitario, setValorUnitario] = useState('');
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const disponiveis = useMemo(() => estoque.filter((e) => e.quantidade > 0), [estoque]);
  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.toLowerCase();
    return disponiveis.filter((e) => e.nome.toLowerCase().includes(termo) || e.codigo?.toLowerCase().includes(termo)).slice(0, 8);
  }, [busca, disponiveis]);

  const reset = useCallback(() => {
    setBusca('');
    setItemSelecionado(null);
    setComponenteSelecionado(null);
    setUnidadeSelecionadaId(null);
    setQuantidade('1');
    setValorUnitario('');
    setFormaPagamentoId('');
    setClienteNome('');
    setClienteId(null);
    setObservacoes('');
    setData(new Date().toISOString().slice(0, 10));
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  // Fichas ainda não vendidas do item selecionado — só essas podem ser
  // escolhidas na venda (ver migration_038).
  const fichasDisponiveis = useMemo(() => (itemSelecionado?.unidades ?? []).filter((u) => !u.vendida_em), [itemSelecionado]);

  const selecionarItem = (item: Estoque) => {
    setItemSelecionado(item);
    setComponenteSelecionado(null);
    setUnidadeSelecionadaId(null);
    setValorUnitario(String(item.promocao_ativa?.valor_promocional ?? item.valor));
    setBusca('');
  };

  const selecionarComponente = (nome: string | null) => {
    setComponenteSelecionado(nome);
    setUnidadeSelecionadaId(null);
    setQuantidade('1');
    if (!nome) {
      setValorUnitario(String(itemSelecionado?.promocao_ativa?.valor_promocional ?? itemSelecionado?.valor ?? 0));
      return;
    }
    // Sugere o valor RESTANTE do conjunto (valor original menos as partes já
    // vendidas), não o valor cheio do item pai — ex: mesa de R$600, já vendeu
    // a Superior por R$350, ao escolher a Inferior o campo já vem com R$250.
    // Ainda assim editável: é só um default, o vendedor decide o valor final.
    const restante = itemSelecionado ? valorRestanteEstimado(itemSelecionado.valor, itemSelecionado.id, vendas) : 0;
    setValorUnitario(restante > 0 ? String(restante) : '');
  };

  const selecionarUnidade = (id: string | null) => {
    setUnidadeSelecionadaId(id);
    setComponenteSelecionado(null);
    setQuantidade('1');
    if (!id) {
      setValorUnitario(String(itemSelecionado?.promocao_ativa?.valor_promocional ?? itemSelecionado?.valor ?? 0));
      return;
    }
    const unidade = fichasDisponiveis.find((u) => u.id === id);
    const valorDaFicha = unidade?.valor ?? itemSelecionado?.promocao_ativa?.valor_promocional ?? itemSelecionado?.valor ?? 0;
    setValorUnitario(String(valorDaFicha));
  };

  const handleSubmit = async () => {
    if (!itemSelecionado) return;
    const qtd = componenteSelecionado || unidadeSelecionadaId ? 1 : Number(quantidade);
    if (!qtd || qtd <= 0) return aviso.atencao('Quantidade inválida');
    if (!componenteSelecionado && qtd > itemSelecionado.quantidade) {
      return aviso.atencao(`Só há ${itemSelecionado.quantidade} unidade(s) em estoque`, { descricao: itemSelecionado.nome });
    }
    if (!formaPagamentoId) return aviso.atencao('Selecione a forma de pagamento');

    setSaving(true);
    try {
      const result = await vendasApi.registrar({
        estoque_id: itemSelecionado.id,
        quantidade: qtd,
        valor_unitario: Number(valorUnitario) || 0,
        forma_pagamento_id: formaPagamentoId,
        modelo_moto_id: itemSelecionado.modelo_moto_id,
        cliente_nome: clienteNome || null,
        cliente_id: clienteId,
        observacoes: observacoes || null,
        data,
        componente: componenteSelecionado,
        unidade_id: unidadeSelecionadaId,
      });
      if (!result.success) throw new Error(result.error);
      // Registrar mexe em vendas + estoque + caixa — resincroniza tudo de uma vez.
      await refreshData();
      const temAnuncio = (itemSelecionado.links_ml?.length ?? 0) > 0;
      const estoqueIdVendido = itemSelecionado.id;
      handleClose();
      if (temAnuncio) {
        aviso.info('Este item tem anúncio no Mercado Livre', {
          descricao: 'Sincronize pra atualizar preço e quantidade por lá também.',
          acao: { label: 'Sincronizar agora', onClick: () => abrirSincronizacao([estoqueIdVendido]) },
        });
      }
    } catch (err: any) {
      aviso.falha(err, 'Erro ao registrar venda');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = cn(
    'w-full border rounded-xl py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50',
    'bg-zinc-950 border-zinc-800 text-zinc-200'
  );
  const labelClass = cn('text-xs font-bold uppercase tracking-wider mb-1.5 block', 'text-zinc-400');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className={cn('w-full md:max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] border p-6 md:p-8 max-h-[90vh] overflow-y-auto', 'bg-zinc-950 border-zinc-800')}
      >
        <div className="md:hidden w-full flex justify-center -mt-2 mb-4">
          <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <h3 className={cn('text-xl font-black', 'text-white')}>Nova Venda</h3>
          <button onClick={handleClose} className="p-2 rounded-full text-zinc-500 hover:bg-zinc-800/50">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {!itemSelecionado ? (
            <div>
              <label className={labelClass}>Buscar item no estoque</label>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou código..." className={inputClass} autoFocus />
              {resultados.length > 0 && (
                <div className={cn('mt-2 rounded-xl border divide-y overflow-hidden', 'border-zinc-800 divide-zinc-800')}>
                  {resultados.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selecionarItem(item)}
                      className={cn('w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-sm transition-colors', 'hover:bg-zinc-900')}
                    >
                      <div className="min-w-0">
                        <p className="font-bold truncate">{item.nome}</p>
                        <p className="text-xs text-zinc-500">
                          {item.codigo} · {item.quantidade} em estoque
                        </p>
                      </div>
                      {item.promocao_ativa ? (
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[11px] text-zinc-500 line-through">{formatCurrency(item.valor)}</span>
                          <span className="font-bold text-emerald-500">{formatCurrency(item.promocao_ativa.valor_promocional)}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-emerald-500 shrink-0">{formatCurrency(item.valor)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {busca.trim() && resultados.length === 0 && <p className="text-xs text-zinc-500 mt-2">Nenhum item disponível encontrado.</p>}
            </div>
          ) : (
            <div className={cn('rounded-xl border p-4 flex items-center justify-between gap-3', 'border-violet-500/30 bg-violet-500/5')}>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{itemSelecionado.nome}</p>
                <p className="text-xs text-zinc-500">
                  {itemSelecionado.codigo} · {itemSelecionado.quantidade} disponíveis
                  {itemSelecionado.componentes && itemSelecionado.componentes.length > 0 && ' · peça composta'}
                </p>
                {itemSelecionado.promocao_ativa && (
                  <div className="mt-1.5">
                    <PromocaoBadge promocao={itemSelecionado.promocao_ativa} />
                  </div>
                )}
              </div>
              <button onClick={() => setItemSelecionado(null)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800/50 shrink-0">
                <Edit2 size={14} />
              </button>
            </div>
          )}

          {itemSelecionado && !unidadeSelecionadaId && itemSelecionado.componentes && itemSelecionado.componentes.length > 0 && (
            <div>
              <label className={labelClass}>O que está sendo vendido?</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selecionarComponente(null)}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', !componenteSelecionado ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-800 text-zinc-400')}
                >
                  Item completo
                </button>
                {itemSelecionado.componentes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selecionarComponente(c)}
                    className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', componenteSelecionado === c ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-800 text-zinc-400')}
                  >
                    Só: {c}
                  </button>
                ))}
              </div>
              {(() => {
                const vendidoEmPartes = valorVendidoEmPartes(itemSelecionado.id, vendas);
                if (vendidoEmPartes <= 0) return null;
                const restante = valorRestanteEstimado(itemSelecionado.valor, itemSelecionado.id, vendas);
                return (
                  <p className="text-xs text-zinc-500 mt-2">
                    Valor original: {formatCurrency(itemSelecionado.valor)} · Já vendido em partes: {formatCurrency(vendidoEmPartes)} · Restante: {formatCurrency(restante)}
                  </p>
                );
              })()}
              {componenteSelecionado && (
                <p className="text-xs text-amber-500 mt-2">
                  Vai vender só "{componenteSelecionado}" — o item some incompleto do estoque até o resto ser vendido também.
                </p>
              )}
            </div>
          )}

          {/* Ficha específica: sempre opcional — vender por quantidade
              genérica sem apontar ficha continua funcionando normalmente. */}
          {itemSelecionado && !componenteSelecionado && fichasDisponiveis.length > 0 && (
            <div>
              <label className={labelClass}>Vender uma ficha específica? (opcional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selecionarUnidade(null)}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', !unidadeSelecionadaId ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-800 text-zinc-400')}
                >
                  Unidade genérica
                </button>
                {fichasDisponiveis.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => selecionarUnidade(u.id)}
                    className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', unidadeSelecionadaId === u.id ? 'bg-violet-600 border-violet-600 text-white' : 'border-zinc-800 text-zinc-400')}
                  >
                    {u.apelido || 'Sem apelido'}
                    {u.avaria && ' · avaria'}
                  </button>
                ))}
              </div>
              {unidadeSelecionadaId && (
                <p className="text-xs text-amber-500 mt-2">
                  Vai vender exatamente esta ficha — ela sai marcada como vendida (com o histórico de foto/avaria preservado), sem precisar apagar nada na mão.
                </p>
              )}
            </div>
          )}

          {itemSelecionado && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    max={componenteSelecionado || unidadeSelecionadaId ? 1 : itemSelecionado.quantidade}
                    value={quantidade}
                    disabled={!!componenteSelecionado || !!unidadeSelecionadaId}
                    onChange={(e) => setQuantidade(e.target.value)}
                    className={cn(inputClass, (componenteSelecionado || unidadeSelecionadaId) && 'opacity-50')}
                  />
                </div>
                <div>
                  <label className={labelClass}>Valor unitário (R$)</label>
                  <input type="number" min="0" step="0.01" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Forma de pagamento</label>
                <CustomDropdown variant="form" value={formaPagamentoId} onChange={setFormaPagamentoId} placeholder="Selecione..." options={formasPagamento.map((p) => ({ value: p.id, label: p.nome }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Cliente (opcional)</label>
                  <SeletorCliente
                    clienteId={clienteId}
                    nome={clienteNome}
                    onChange={(id, nome) => {
                      setClienteId(id);
                      setClienteNome(nome);
                    }}
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <label className={labelClass}>Data</label>
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Observações (opcional)</label>
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={inputClass} />
              </div>

              <div className={cn('flex items-center justify-between p-4 rounded-xl', 'bg-zinc-900')}>
                <span className="text-xs font-bold uppercase text-zinc-500">Total</span>
                <span className="text-xl font-black text-emerald-500">{formatCurrency(Number(valorUnitario || 0) * Number(quantidade || 0))}</span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving || !formaPagamentoId}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Venda'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
