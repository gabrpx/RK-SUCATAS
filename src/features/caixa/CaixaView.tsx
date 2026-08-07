// Aba Caixa: livro de entradas e saídas. Entradas geradas por uma venda
// (venda_id preenchido) são somente leitura aqui — pra reverter, cancela a
// venda na aba Vendas. Lançamentos manuais (despesas, retiradas, etc.) são
// criados/editados/excluídos direto por aqui.
import { useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  Scale,
  Trash2,
  Loader2,
  Search,
  Link2,
  X,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { CustomDropdown } from '../../components/CustomDropdown';
import { aviso } from '../../components/ui/toast';
import { caixaApi } from './api';
import type { CaixaEntry, CaixaTipo } from './types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

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

export function CaixaView({ theme }: { theme: 'light' | 'dark' }) {
  const { caixa, setCaixa, showSensitiveInfo, setShowSensitiveInfo } = useData();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | CaixaTipo>('todos');
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<CaixaEntry | null>(null);

  const filtered = useMemo(() => {
    return caixa
      .filter((e) => (tipoFiltro === 'todos' ? true : e.tipo === tipoFiltro))
      .filter((e) => isDentroDoPeriodo(e.data, periodo))
      .filter((e) => e.descricao.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime());
  }, [caixa, tipoFiltro, periodo, search]);

  const totals = useMemo(() => {
    const entradas = filtered.filter((e) => e.tipo === 'entrada').reduce((sum, e) => sum + Number(e.valor), 0);
    const saidas = filtered.filter((e) => e.tipo === 'saida').reduce((sum, e) => sum + Number(e.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtered]);

  const handleDelete = async () => {
    if (!entryToDelete) return;
    const entrada = entryToDelete;
    setCaixa((prev) => prev.filter((e) => e.id !== entrada.id));
    setEntryToDelete(null);
    try {
      const result = await caixaApi.excluir(entrada.id);
      if (!result.success) throw new Error(result.error);
    } catch (err: any) {
      // Backend recusa (409) lançamento vinculado a um recebimento de fiado —
      // sem isso a linha sumia da tela mesmo sem ter sido excluída de verdade.
      setCaixa((prev) => (prev.some((e) => e.id === entrada.id) ? prev : [...prev, entrada]));
      aviso.falha(err, 'Erro ao excluir lançamento');
    }
  };

  const cardClass = cn('rounded-3xl border p-5', theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200');

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <Wallet className="text-emerald-500" size={28} />
          </div>
          <div>
            <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Caixa</h2>
            <p className={cn('text-sm', theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500')}>Entradas e saídas financeiras</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Entradas</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <p className={cn('text-2xl font-black', showSensitiveInfo ? 'text-emerald-500' : 'blur-md select-none text-emerald-500')}>
            {formatCurrency(totals.entradas)}
          </p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Saídas</span>
            <TrendingDown size={16} className="text-rose-500" />
          </div>
          <p className={cn('text-2xl font-black', showSensitiveInfo ? 'text-rose-500' : 'blur-md select-none text-rose-500')}>
            {formatCurrency(totals.saidas)}
          </p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Saldo</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSensitiveInfo((v) => !v)} className="text-zinc-500 hover:text-zinc-300">
                {showSensitiveInfo ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <Scale size={16} className={theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'} />
            </div>
          </div>
          <p
            className={cn(
              'text-2xl font-black',
              !showSensitiveInfo && 'blur-md select-none',
              totals.saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'
            )}
          >
            {formatCurrency(totals.saldo)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className={cn('flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border', theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
          <Search size={16} className="text-zinc-500 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição..."
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
        <CustomDropdown
          theme={theme}
          variant="pill"
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
          theme={theme}
          variant="pill"
          value={tipoFiltro}
          onChange={(v) => setTipoFiltro(v as 'todos' | CaixaTipo)}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'entrada', label: 'Entradas' },
            { value: 'saida', label: 'Saídas' },
          ]}
        />
      </div>

      {/* Lista */}
      <div className={cn('rounded-3xl border overflow-hidden', theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200')}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">Nenhum lançamento encontrado para este filtro.</div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filtered.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-800/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      entry.tipo === 'entrada' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                    )}
                  >
                    {entry.tipo === 'entrada' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('font-bold text-sm truncate', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>{entry.descricao}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-2">
                      {parseLocalDate(entry.data).toLocaleDateString('pt-BR')}
                      {entry.forma_pagamento && <span>· {entry.forma_pagamento.nome}</span>}
                      {entry.venda_id && (
                        <span className="flex items-center gap-1 text-violet-400">
                          <Link2 size={11} /> venda
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('font-black text-sm', entry.tipo === 'entrada' ? 'text-emerald-500' : 'text-rose-500')}>
                    {entry.tipo === 'entrada' ? '+' : '-'} {formatCurrency(entry.valor)}
                  </span>
                  {!entry.venda_id && (
                    <button
                      onClick={() => setEntryToDelete(entry)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LancamentoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} theme={theme} loading={loading} setLoading={setLoading} />

      {/* Confirmação de exclusão */}
      <AnimatePresence>
        {entryToDelete && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn('w-full max-w-sm rounded-3xl border p-6 text-center', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}
            >
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-4">
                <Trash2 size={28} />
              </div>
              <h3 className={cn('text-lg font-black mb-2', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Excluir lançamento?</h3>
              <p className="text-sm text-zinc-500 mb-6">"{entryToDelete.descricao}" será removido do caixa. Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setEntryToDelete(null)}
                  className={cn('flex-1 py-3 rounded-2xl font-bold text-sm', theme === 'dark' ? 'bg-zinc-900 text-zinc-300' : 'bg-zinc-100 text-zinc-700')}
                >
                  Cancelar
                </button>
                <button onClick={handleDelete} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600">
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LancamentoModal({
  isOpen,
  onClose,
  theme,
  loading,
  setLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const { setCaixa } = useData();
  const { formasPagamento } = useCatalogos();
  const [tipo, setTipo] = useState<CaixaTipo>('saida');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  const reset = () => {
    setTipo('saida');
    setDescricao('');
    setValor('');
    setFormaPagamentoId('');
    setData(new Date().toISOString().slice(0, 10));
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!descricao.trim() || !valor || Number(valor) <= 0) return;
    setLoading(true);
    try {
      const result = await caixaApi.lancar({
        tipo,
        descricao: descricao.trim(),
        valor: Number(valor),
        forma_pagamento_id: formaPagamentoId || null,
        data,
      });
      if (result.success) {
        setCaixa((prev) => [result.data, ...prev]);
        handleClose();
      }
    } catch (err) {
      console.error('Erro ao lançar no caixa:', err);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    'w-full border rounded-xl py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50',
    theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-900'
  );
  const labelClass = cn('text-xs font-bold uppercase tracking-wider mb-1.5 block', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={cn(
          'w-full md:max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] border p-6 md:p-8 max-h-[90vh] overflow-y-auto',
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <div className="md:hidden w-full flex justify-center -mt-2 mb-4">
          <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <h3 className={cn('text-xl font-black', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Novo Lançamento</h3>
          <button onClick={handleClose} className="p-2 rounded-full text-zinc-500 hover:bg-zinc-800/50">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipo('entrada')}
              className={cn(
                'py-3 rounded-xl font-black text-xs uppercase tracking-widest border transition-all',
                tipo === 'entrada' ? 'bg-emerald-500 border-emerald-500 text-white' : theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
              )}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setTipo('saida')}
              className={cn(
                'py-3 rounded-xl font-black text-xs uppercase tracking-widest border transition-all',
                tipo === 'saida' ? 'bg-rose-500 border-rose-500 text-white' : theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
              )}
            >
              Saída
            </button>
          </div>

          <div>
            <label className={labelClass}>Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Conta de luz, retirada..." className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Valor (R$)</label>
              <input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Forma de pagamento (opcional)</label>
            <CustomDropdown
              theme={theme}
              variant="form"
              value={formaPagamentoId}
              onChange={setFormaPagamentoId}
              placeholder="Selecione..."
              options={formasPagamento.map((p) => ({ value: p.id, label: p.nome }))}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !descricao.trim() || !valor}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Lançamento'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
