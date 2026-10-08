// Aba Vendas: registra a venda de um item do Estoque. Ao salvar, o backend
// (via registrar_venda) baixa a quantidade no Estoque e lança a entrada
// correspondente no Caixa — tudo numa transação só, então esta tela nunca
// precisa se preocupar em manter as três tabelas sincronizadas na mão.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Search, Plus, Trash2, Loader2, Calendar, Package, Edit2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, parseLocalDate } from '../../utils';
import { formatarTempoRelativoCurto } from '../../utils/tempoRelativo';
import { usePermissao } from '../../hooks/usePermissao';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { aviso } from '../../components/ui/toast';
import { CustomDropdown } from '../../components/CustomDropdown';
import { Modal } from '../../components/ui/Modal';
import { InventoryDrawer } from '../estoque-preview/InventoryDrawer';
import { Select } from '../../components/ui/Select';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { Button } from '@/src/components/ui/button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { vendasApi } from './api';
import { useSincronizacaoMl } from '../mercadolivre/SincronizacaoMlContext';
import { PromocaoBadge } from '../promocoes/PromocaoBadge';
import { formaPagamentoEfetiva, saldoPorVenda } from '../fiado/metricas';
import { valorRestanteEstimado, valorVendidoEmPartes } from './metricas';
import { pendenciasObrigatoriasDaFicha } from '../estoque/gaveta/pendenciasGaveta';
import { caixaApi } from '../caixa/api';
import type { CaixaTipo } from '../caixa/types';
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
}

export function VendasView({ onSelectItem, onRegisterActions }: VendasViewProps) {
  const { pode } = usePermissao();
  const { vendas, setVendas, estoque, fiadoRecebimentos, refreshData, loading } = useData();
  const { formasPagamento } = useCatalogos();
  const { abrir: abrirSincronizacao } = useSincronizacaoMl();
  const podeForcarCancelamento = pode('vendas.cancelar_fiado');
  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [pagamentoFiltro, setPagamentoFiltro] = useState('Todos');
  const [isNovaVendaOpen, setIsNovaVendaOpen] = useState(false);
  const [isMovimentoAvulsoOpen, setIsMovimentoAvulsoOpen] = useState(false);
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
          <div className="p-3 bg-accent/10 rounded-2xl">
            <ShoppingCart className="text-accent" size={28} />
          </div>
          <div>
            <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', 'text-text-primary')}>Vendas</h2>
            <p className="text-sm text-text-muted">
              {filtered.length} vendas · {formatCurrency(totalVendido)} no período
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {pode('caixa.criar') && (
            <Button variant="secondary" onClick={() => setIsMovimentoAvulsoOpen(true)} className="h-auto px-5 py-3.5 md:py-3 rounded-2xl font-black text-xs uppercase tracking-widest">
              <Plus size={18} /> Entrada/saída avulsa
            </Button>
          )}
          <Button onClick={() => setIsNovaVendaOpen(true)} className="h-auto px-5 py-3.5 md:py-3 rounded-control font-black text-xs uppercase tracking-widest shadow-lg shadow-accent-shadow">
            <Plus size={18} /> Nova Venda
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <label className={cn('flex-1 flex items-center gap-2 px-4 py-3 md:py-2.5 rounded-xl border cursor-text', 'bg-surface-inset border-border-default')}>
          <Search size={16} className="text-text-muted shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por peça ou cliente..." className="bg-transparent outline-none text-sm w-full" />
        </label>
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
      <div className={cn('rounded-3xl border overflow-hidden', 'bg-surface-card border-border-subtle')}>
        {loading && vendas.length === 0 ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-accent" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">Nenhuma venda encontrada para este filtro.</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filtered.map((venda) => (
              <div key={venda.id} onClick={() => onSelectItem(venda)} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-raised transition-colors cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Package size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={cn('font-bold text-sm break-words line-clamp-2 min-w-0', 'text-text-primary')}>
                        {venda.quantidade > 1 ? `${venda.quantidade}x ` : ''}
                        {venda.nome_item}
                      </p>
                      {venda.canal === 'mercado_livre' && (
                        <span className="shrink-0">
                          <StatusBadge texto="Mercado Livre" tom="accent" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
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
                      {venda.criado_em && (() => {
                        const rel = formatarTempoRelativoCurto(venda.criado_em);
                        return rel ? (
                          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-text-faint">
                            · {rel}
                          </motion.span>
                        ) : null;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-black text-sm text-text-primary">{formatCurrency(venda.valor_total)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVendaToCancel(venda);
                    }}
                    className="size-8 rounded-lg text-text-muted hover:text-danger hover:bg-danger-bg"
                    title="Cancelar venda (devolve o estoque)"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NovaVendaDrawer isOpen={isNovaVendaOpen} onClose={() => setIsNovaVendaOpen(false)} />
      <MovimentoAvulsoModal isOpen={isMovimentoAvulsoOpen} onClose={() => setIsMovimentoAvulsoOpen(false)} onSaved={refreshData} />

      {/* Confirmação de cancelamento */}
      <Modal
        aberto={!!vendaToCancel}
        onFechar={() => setVendaToCancel(null)}
        titulo="Cancelar esta venda?"
        icone={AlertCircle}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setVendaToCancel(null)} className="h-auto flex-1 py-3 rounded-2xl font-bold text-sm">
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelar}
              disabled={cancelando || (temRecebimentoFiado && !podeForcarCancelamento)}
              className="h-auto flex-1 py-3 rounded-2xl font-bold text-sm"
            >
              {cancelando ? <Loader2 size={16} className="animate-spin" /> : temRecebimentoFiado ? 'Reverter e cancelar' : 'Cancelar venda'}
            </Button>
          </div>
        }
      >
        {vendaToCancel && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              "{vendaToCancel.nome_item}" ({formatCurrency(vendaToCancel.valor_total)}) será removida. A quantidade volta pro estoque e a entrada no caixa é desfeita.
            </p>
            {temRecebimentoFiado && (
              <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-xl px-3 py-2.5 text-left">
                Esta venda já tem {formatCurrency(recebidoDoVendaToCancel)} recebido(s) via fiado.
                {podeForcarCancelamento
                  ? ' Cancelar aqui também reverte esse(s) recebimento(s) e as entradas de caixa vinculadas.'
                  : ' Só um admin pode cancelar uma venda fiado já com recebimento.'}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function MovimentoAvulsoModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { formasPagamento } = useCatalogos();
  const [tipo, setTipo] = useState<CaixaTipo>('entrada');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTipo('entrada');
    setDescricao('');
    setValor('');
    setFormaPagamentoId('');
    setData(new Date().toISOString().slice(0, 10));
  };

  const fechar = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const salvar = async () => {
    const valorNumerico = Number(valor.replace(',', '.'));
    if (!descricao.trim()) return aviso.atencao('Informe uma descrição');
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return aviso.atencao('Informe um valor maior que zero');
    setSaving(true);
    try {
      const result = await caixaApi.lancar({
        tipo,
        descricao: descricao.trim(),
        valor: valorNumerico,
        forma_pagamento_id: formaPagamentoId || null,
        data,
      });
      if (!result.success) throw new Error(result.error || 'Não foi possível lançar o movimento');
      await onSaved();
      aviso.sucesso(tipo === 'entrada' ? 'Entrada registrada' : 'Saída registrada');
      fechar();
    } catch (error) {
      aviso.falha(error, 'Erro ao registrar movimento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      aberto={isOpen}
      onFechar={fechar}
      titulo="Lançamento avulso"
      subtitulo="Registre uma entrada ou saída sem vincular a uma peça."
      tamanho="sm"
      rodape={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={fechar} disabled={saving} className="flex-1">Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="flex-1">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar lançamento'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['entrada', 'saida'] as CaixaTipo[]).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setTipo(opcao)}
              className={cn('rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors', tipo === opcao ? 'border-accent bg-accent/10 text-accent' : 'border-border-default text-text-muted')}
            >
              {opcao === 'entrada' ? 'Entrada' : 'Saída'}
            </button>
          ))}
        </div>
        <label className="block text-sm font-medium text-text-secondary">
          Descrição
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: frete recebido, compra de material..." className="mt-1.5 w-full rounded-xl border border-border-default bg-surface-inset px-3 py-2.5 text-sm outline-none focus:border-accent" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-text-secondary">
            Valor
            <input type="number" min="0.01" step="0.01" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="mt-1.5 w-full rounded-xl border border-border-default bg-surface-inset px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </label>
          <label className="block text-sm font-medium text-text-secondary">
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1.5 w-full rounded-xl border border-border-default bg-surface-inset px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </label>
        </div>
        <label className="block text-sm font-medium text-text-secondary">
          Forma de pagamento
          <Select ariaLabel="Forma de pagamento" className="mt-1.5" value={formaPagamentoId} onChange={setFormaPagamentoId} options={[{ value: '', label: 'Não informada' }, ...formasPagamento.map((forma) => ({ value: forma.id, label: forma.nome }))]} size="lg" />
        </label>
      </div>
    </Modal>
  );
}

export function NovaVendaDrawer({ isOpen, onClose, onSaved, initialClienteId }: { isOpen: boolean; onClose: () => void; onSaved?: () => void; initialClienteId?: string | null }) {
  const { estoque, vendas, clientes, motosClientes, refreshData } = useData();
  const { formasPagamento } = useCatalogos();
  const { abrir: abrirSincronizacao } = useSincronizacaoMl();
  const [busca, setBusca] = useState<string>(() => {
    // "Venda rápida" do modal de família pré-preenche a busca via sessionStorage
    try {
      const pre = sessionStorage.getItem('rk:venda-rapida-busca');
      if (pre) { sessionStorage.removeItem('rk:venda-rapida-busca'); return pre; }
    } catch { /* privado */ }
    return '';
  });
  const [itemSelecionado, setItemSelecionado] = useState<Estoque | null>(null);
  const [modoVenda, setModoVenda] = useState<'estoque' | 'manual'>('estoque');
  const [nomeItemManual, setNomeItemManual] = useState('');
  const [quantidadeManual, setQuantidadeManual] = useState('1');
  const [valorUnitarioManual, setValorUnitarioManual] = useState('');
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

  useEffect(() => {
    if (!isOpen || !initialClienteId) return;
    const clienteInicial = clientes.find((cliente) => cliente.id === initialClienteId);
    setClienteId(initialClienteId);
    setClienteNome(clienteInicial?.nome ?? '');
  }, [isOpen, initialClienteId, clientes]);

  const disponiveis = useMemo(() => estoque.filter((e) => e.quantidade > 0), [estoque]);
  const clienteInicial = initialClienteId ? clientes.find((cliente) => cliente.id === initialClienteId) ?? null : null;
  const clienteSelecionado = clienteId ? clientes.find((cliente) => cliente.id === clienteId) ?? null : null;
  const clienteSelecionadoValido = !!clienteSelecionado && clienteSelecionado.ativo && !clienteSelecionado.banido;
  const vinculoObrigatorioAusente = !!initialClienteId && (!clienteId || !clienteSelecionadoValido);
  const opcoesClientes = useMemo(() => {
    const opcoes = [
      ...(!initialClienteId ? [{ value: '', label: 'Venda no balcão' }] : []),
      ...clientes.filter((cliente) => cliente.ativo && !cliente.banido).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((cliente) => ({ value: cliente.id, label: cliente.nome })),
    ];
    if (clienteId && !opcoes.some((opcao) => opcao.value === clienteId)) {
      const cliente = clientes.find((item) => item.id === clienteId);
      opcoes.push({ value: clienteId, label: cliente ? `${cliente.nome} (indisponível)` : 'Cliente selecionado (indisponível)' });
    }
    return opcoes;
  }, [clientes, clienteId, initialClienteId]);
  const motosPorCliente = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const moto of motosClientes) {
      const nome = moto.modelo_moto?.nome;
      if (!nome) continue;
      mapa.set(moto.cliente_id, [...(mapa.get(moto.cliente_id) ?? []), nome]);
    }
    return mapa;
  }, [motosClientes]);
  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.toLowerCase();
    return disponiveis.filter((e) => e.nome.toLowerCase().includes(termo) || e.codigo?.toLowerCase().includes(termo)).slice(0, 8);
  }, [busca, disponiveis]);

  const reset = useCallback(() => {
    setBusca('');
    setItemSelecionado(null);
    setModoVenda('estoque');
    setNomeItemManual('');
    setQuantidadeManual('1');
    setValorUnitarioManual('');
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
  const unidadeSelecionada = useMemo(
    () => fichasDisponiveis.find((unidade) => unidade.id === unidadeSelecionadaId) ?? null,
    [fichasDisponiveis, unidadeSelecionadaId],
  );
  const pendenciasUnidadeSelecionada = unidadeSelecionada ? pendenciasObrigatoriasDaFicha(unidadeSelecionada) : [];

  const selecionarItem = (item: Estoque) => {
    setItemSelecionado(item);
    setComponenteSelecionado(null);
    setUnidadeSelecionadaId(null);
    setValorUnitario(String(item.promocao_ativa?.valor_promocional ?? item.valor));
    setBusca('');
  };

  const alternarModo = (modo: 'estoque' | 'manual') => {
    if (modo === modoVenda) return;
    if (modo === 'manual') {
      setBusca('');
      setItemSelecionado(null);
      setComponenteSelecionado(null);
      setUnidadeSelecionadaId(null);
      setQuantidade('1');
      setValorUnitario('');
    } else {
      setNomeItemManual('');
      setQuantidadeManual('1');
      setValorUnitarioManual('');
    }
    setModoVenda(modo);
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
    if (modoVenda === 'estoque' && !itemSelecionado) return;
    const nomeManual = nomeItemManual.trim();
    const qtdManual = Number(quantidadeManual);
    const valorManual = Number(valorUnitarioManual);
    if (modoVenda === 'manual') {
      if (!nomeManual) return aviso.atencao('Informe o nome do item');
      if (!Number.isFinite(qtdManual) || !Number.isInteger(qtdManual) || qtdManual <= 0) return aviso.atencao('Informe uma quantidade inteira maior que zero');
      if (!valorUnitarioManual.trim() || !Number.isFinite(valorManual) || valorManual < 0) return aviso.atencao('Informe um valor unitário válido');
    } else {
      const qtd = componenteSelecionado || unidadeSelecionadaId ? 1 : Number(quantidade);
      if (!qtd || qtd <= 0) return aviso.atencao('Quantidade inválida');
      if (!componenteSelecionado && qtd > itemSelecionado!.quantidade) {
        return aviso.atencao(`Só há ${itemSelecionado!.quantidade} unidade(s) em estoque`, { descricao: itemSelecionado!.nome });
      }
    }
    if (vinculoObrigatorioAusente) return aviso.atencao('O cliente selecionado está indisponível', { descricao: 'Selecione um cliente ativo para manter a venda vinculada.' });
    if (!formaPagamentoId) return aviso.atencao('Selecione a forma de pagamento');

    setSaving(true);
    try {
      const result = modoVenda === 'manual'
        ? await vendasApi.registrar({
          estoque_id: null,
          nome_item: nomeManual,
          quantidade: qtdManual,
          valor_unitario: valorManual,
          forma_pagamento_id: formaPagamentoId,
          cliente_nome: clienteNome || null,
          cliente_id: clienteId,
          observacoes: observacoes || null,
          data,
        })
        : await vendasApi.registrar({
          estoque_id: itemSelecionado!.id,
          quantidade: componenteSelecionado || unidadeSelecionadaId ? 1 : Number(quantidade),
          valor_unitario: Number(valorUnitario) || 0,
          forma_pagamento_id: formaPagamentoId,
          modelo_moto_id: itemSelecionado!.modelo_moto_id,
          cliente_nome: clienteNome || null,
          cliente_id: clienteId,
          observacoes: observacoes || null,
          data,
          componente: componenteSelecionado,
          unidade_id: unidadeSelecionadaId,
        });
      if (!result.success) throw new Error(result.error);
      // A RPC mantém venda e Caixa atômicos; estoque só é alterado no modo estoque.
      await refreshData();
      onSaved?.();
      const temAnuncio = modoVenda === 'estoque' && (itemSelecionado!.links_ml?.length ?? 0) > 0;
      const estoqueIdVendido = modoVenda === 'estoque' ? itemSelecionado!.id : null;
      handleClose();
      if (temAnuncio && estoqueIdVendido) {
        aviso.info('Este item tem anúncio no Mercado Livre', {
          descricao: 'Sincronize pra atualizar preço e quantidade por lá também.',
          acao: { label: 'Sincronizar agora', onClick: () => abrirSincronizacao([estoqueIdVendido]) },
        });
      }
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      const nomeErro = err instanceof Error ? err.name : '';
      const erroTexto = `${nomeErro} ${mensagem}`;
      if (/abort|cancel|network|fetch failed|failed to fetch|load failed|connection|offline|timeout/i.test(erroTexto)) {
        aviso.erro(/network|fetch failed|failed to fetch|load failed|connection|offline|timeout/i.test(erroTexto)
          ? 'Não foi possível conectar para registrar a venda. Verifique sua conexão e tente novamente.'
          : 'A solicitação foi interrompida. Tente registrar a venda novamente.');
      } else {
        aviso.falha(err, 'Erro ao registrar venda');
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass = cn(
    'w-full border rounded-xl py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50',
    'bg-surface-inset border-border-default text-text-primary'
  );
  const labelClass = cn('text-xs font-bold uppercase tracking-wider mb-1.5 block', 'text-text-muted');

  return (
    <InventoryDrawer isOpen={isOpen} onClose={handleClose} title="Nova venda" footer={<div className="flex gap-2"><Button type="button" variant="ghost" onClick={handleClose} className="min-h-11 rounded-control">Cancelar</Button>{(modoVenda === 'manual' || itemSelecionado) && <Button onClick={handleSubmit} disabled={saving || !formaPagamentoId || vinculoObrigatorioAusente || (modoVenda === 'manual' && !nomeItemManual.trim())} className="min-h-11 flex-1 rounded-control font-semibold">{saving ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar venda'}</Button>}</div>}>
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <button type="button" aria-pressed={modoVenda === 'estoque'} onClick={() => alternarModo('estoque')} className={cn('rounded-control border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', modoVenda === 'estoque' ? 'border-accent bg-accent text-white' : 'border-border-default text-text-muted hover:bg-surface-raised')}>Estoque</button>
          <button type="button" aria-pressed={modoVenda === 'manual'} onClick={() => alternarModo('manual')} className={cn('rounded-control border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', modoVenda === 'manual' ? 'border-accent bg-accent text-white' : 'border-border-default text-text-muted hover:bg-surface-raised')}>Item sem estoque</button>
        </div>
        {initialClienteId && (vinculoObrigatorioAusente
          ? <p role="alert" className="text-xs text-danger">{clienteInicial ? (clienteInicial.ativo && !clienteInicial.banido ? 'Selecione um cliente ativo para manter a venda vinculada.' : `O cadastro de ${clienteInicial.nome} está inativo ou indisponível.`) : 'O cliente pré-selecionado não está disponível na lista carregada.'} Recarregue os clientes antes de registrar esta venda.</p>
          : <p className="text-xs text-text-muted">Venda vinculada a {clienteSelecionado?.nome}.</p>)}
        {modoVenda === 'manual' ? (
          <div>
            <label className={labelClass} htmlFor="venda-item-manual">Nome do item</label>
            <input id="venda-item-manual" value={nomeItemManual} onChange={(e) => setNomeItemManual(e.target.value)} placeholder="Ex.: retrovisor esquerdo" className={inputClass} autoFocus />
          </div>
        ) : !itemSelecionado ? (
          <div>
            <label className={labelClass}>Buscar item no estoque</label>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou código..." className={inputClass} autoFocus />
            {resultados.length > 0 && (
              <div className={cn('mt-2 rounded-xl border divide-y overflow-hidden', 'border-border-default divide-border-default')}>
                {resultados.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selecionarItem(item)}
                    className={cn('w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-sm transition-colors', 'hover:bg-surface-raised')}
                  >
                    <div className="min-w-0">
                      <p className="font-bold break-words line-clamp-2">{item.nome}</p>
                      <p className="text-xs text-text-muted">
                        {item.codigo} · {item.quantidade} em estoque
                      </p>
                    </div>
                    {item.promocao_ativa ? (
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[11px] text-text-muted line-through">{formatCurrency(item.valor)}</span>
                        <span className="font-bold text-text-primary">{formatCurrency(item.promocao_ativa.valor_promocional)}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-text-primary shrink-0">{formatCurrency(item.valor)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {busca.trim() && resultados.length === 0 && <p className="text-xs text-text-muted mt-2">Nenhum item disponível encontrado.</p>}
          </div>
        ) : (
          <div className={cn('rounded-xl border p-4 flex items-center justify-between gap-3', 'border-accent/30 bg-accent/5')}>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{itemSelecionado.nome}</p>
              <p className="text-xs text-text-muted">
                {itemSelecionado.codigo} · {itemSelecionado.quantidade} disponíveis
                {itemSelecionado.componentes && itemSelecionado.componentes.length > 0 && ' · peça composta'}
              </p>
              {itemSelecionado.promocao_ativa && (
                <div className="mt-1.5">
                  <PromocaoBadge promocao={itemSelecionado.promocao_ativa} />
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setItemSelecionado(null)} className="size-7 rounded-lg text-text-muted shrink-0">
              <Edit2 size={14} />
            </Button>
          </div>
        )}

        {modoVenda === 'estoque' && itemSelecionado && !unidadeSelecionadaId && itemSelecionado.componentes && itemSelecionado.componentes.length > 0 && (
          <div>
            <label className={labelClass}>O que está sendo vendido?</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selecionarComponente(null)}
                className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', !componenteSelecionado ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
              >
                Item completo
              </button>
              {itemSelecionado.componentes.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => selecionarComponente(c)}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', componenteSelecionado === c ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
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
                <p className="text-xs text-text-muted mt-2">
                  Valor original: {formatCurrency(itemSelecionado.valor)} · Já vendido em partes: {formatCurrency(vendidoEmPartes)} · Restante: {formatCurrency(restante)}
                </p>
              );
            })()}
            {componenteSelecionado && (
              <p className="text-xs text-warning mt-2">
                Vai vender só "{componenteSelecionado}" — o item some incompleto do estoque até o resto ser vendido também.
              </p>
            )}
          </div>
        )}

        {/* Ficha específica: sempre opcional — vender por quantidade
            genérica sem apontar ficha continua funcionando normalmente. */}
        {modoVenda === 'estoque' && itemSelecionado && !componenteSelecionado && fichasDisponiveis.length > 0 && (
          <div>
            <label className={labelClass}>Vender uma ficha específica? (opcional)</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selecionarUnidade(null)}
                className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', !unidadeSelecionadaId ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
              >
                Unidade genérica
              </button>
              {fichasDisponiveis.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => selecionarUnidade(u.id)}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', unidadeSelecionadaId === u.id ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
                >
                  {u.sku ? `SKU ${u.sku} · ` : ''}{u.nome || 'Sem nome'}
                  {u.avaria && ' · avaria'}
                </button>
              ))}
            </div>
            {unidadeSelecionadaId && (
              <>
                <p className="text-xs text-warning mt-2">
                  Vai vender exatamente esta ficha — ela sai marcada como vendida (com o histórico de foto/avaria preservado), sem precisar apagar nada na mão.
                </p>
                {pendenciasUnidadeSelecionada.length > 0 && (
                  <p className="text-xs text-warning mt-1">
                    Ficha incompleta: {pendenciasUnidadeSelecionada.map((pendencia) => pendencia === 'sem_foto' ? 'sem foto própria' : 'sem preço próprio').join(' · ')}. A venda continua permitida.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {(modoVenda === 'manual' || itemSelecionado) && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Quantidade</label>
                <input
                  type="number"
                  min="1"
                  max={modoVenda === 'estoque' ? (componenteSelecionado || unidadeSelecionadaId ? 1 : itemSelecionado?.quantidade) : undefined}
                  value={modoVenda === 'manual' ? quantidadeManual : quantidade}
                  disabled={modoVenda === 'estoque' && (!!componenteSelecionado || !!unidadeSelecionadaId)}
                  onChange={(e) => modoVenda === 'manual' ? setQuantidadeManual(e.target.value) : setQuantidade(e.target.value)}
                  className={cn(inputClass, modoVenda === 'estoque' && (componenteSelecionado || unidadeSelecionadaId) && 'opacity-50')}
                />
              </div>
              <div>
                {modoVenda === 'manual'
                  ? <CurrencyInput label="Valor unitário" size="lg" value={valorUnitarioManual ? Math.round(Number(valorUnitarioManual) * 100) : null} onChange={(centavos) => setValorUnitarioManual(centavos == null ? '' : String(centavos / 100))} />
                  : <CurrencyInput label="Valor unitário" size="lg" value={valorUnitario ? Math.round(Number(valorUnitario) * 100) : null} onChange={(centavos) => setValorUnitario(centavos == null ? '' : String(centavos / 100))} />}
              </div>
            </div>

            <div>
              <label className={labelClass}>Forma de pagamento</label>
              <CustomDropdown variant="form" value={formaPagamentoId} onChange={setFormaPagamentoId} placeholder="Selecione..." options={formasPagamento.map((p) => ({ value: p.id, label: p.nome }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cliente (opcional)</label>
                <Select
                  ariaLabel="Cliente da venda"
                  value={clienteId ?? ''}
                  onChange={(id) => {
                    setClienteId(id || null);
                    setClienteNome(id ? opcoesClientes.find((opcao) => opcao.value === id)?.label ?? '' : '');
                  }}
                  options={opcoesClientes}
                  size="lg"
                  renderOption={(opcao) => <span className="flex min-w-0 flex-wrap items-center gap-1.5"><span className="truncate">{opcao.label}</span>{(motosPorCliente.get(opcao.value) ?? []).map((moto, indice) => <span key={`${moto}-${indice}`} className="rounded-full border border-accent/20 bg-accent-soft-bg px-2 py-0.5 text-[10px] font-medium text-accent">{moto}</span>)}</span>}
                  renderValue={(opcao) => <span className="flex min-w-0 items-center gap-1.5"><span className="truncate">{opcao.label}</span>{(motosPorCliente.get(opcao.value) ?? []).slice(0, 1).map((moto) => <span key={moto} className="max-w-28 truncate rounded-full bg-accent-soft-bg px-2 py-0.5 text-[10px] text-accent">{moto}</span>)}</span>}
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

            <div className={cn('flex items-center justify-between p-4 rounded-xl', 'bg-surface-card')}>
              <span className="text-xs font-bold uppercase text-text-muted">Total</span>
              <span className="text-xl font-black text-text-primary">{formatCurrency(Number(modoVenda === 'manual' ? valorUnitarioManual || 0 : valorUnitario || 0) * Number(modoVenda === 'manual' ? quantidadeManual || 0 : quantidade || 0))}</span>
            </div>
          </>
        )}
      </div>
    </InventoryDrawer>
  );
}
