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
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { CustomDropdown } from '../../components/CustomDropdown';
import { Modal } from '../../components/ui/Modal';
import { aviso } from '../../components/ui/toast';
import { Button } from '@/src/components/ui/button';
import { caixaApi, caixaPendenciasApi } from './api';
import { PendenciasTab } from './PendenciasTab';
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

export function CaixaView({ userRoles }: { userRoles: string[] }) {
  const { caixa, setCaixa, showSensitiveInfo, setShowSensitiveInfo } = useData();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | CaixaTipo>('todos');
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<CaixaEntry | null>(null);
  const [aba, setAba] = useState<'lancamentos' | 'pendencias'>('lancamentos');

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

  const cardClass = cn('rounded-3xl border p-5', 'bg-surface-card border-border-subtle');

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-2xl">
            <Wallet className="text-accent" size={28} />
          </div>
          <div>
            <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', 'text-text-primary')}>Caixa</h2>
            <p className={cn('text-sm', 'text-text-muted')}>Entradas e saídas financeiras</p>
          </div>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="h-auto px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-accent-shadow"
        >
          <Plus size={18} /> Novo Lançamento
        </Button>
      </div>

      {/* Sub-abas: Lançamentos (o que já existia) / Pendências (fiado do Caixa) */}
      <div className={cn('inline-flex items-center gap-1 p-1.5 rounded-2xl border w-fit', 'bg-surface-card border-border-subtle')}>
        <button
          onClick={() => setAba('lancamentos')}
          className={cn(
            'px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all',
            aba === 'lancamentos' ? 'bg-accent text-white' : 'text-text-muted'
          )}
        >
          Lançamentos
        </button>
        <button
          onClick={() => setAba('pendencias')}
          className={cn(
            'px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all',
            aba === 'pendencias' ? 'bg-accent text-white' : 'text-text-muted'
          )}
        >
          Pendências
        </button>
      </div>

      {aba === 'pendencias' ? (
        <PendenciasTab userRoles={userRoles} />
      ) : (
        <>
      {/* Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Entradas</span>
            <TrendingUp size={16} className="text-positive" />
          </div>
          <p className={cn('text-2xl font-black', showSensitiveInfo ? 'text-positive' : 'blur-md select-none text-positive')}>
            {formatCurrency(totals.entradas)}
          </p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Saídas</span>
            <TrendingDown size={16} className="text-negative" />
          </div>
          <p className={cn('text-2xl font-black', showSensitiveInfo ? 'text-negative' : 'blur-md select-none text-negative')}>
            {formatCurrency(totals.saidas)}
          </p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Saldo</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setShowSensitiveInfo((v) => !v)} className="size-6 text-text-muted hover:text-text-secondary">
                {showSensitiveInfo ? <Eye size={14} /> : <EyeOff size={14} />}
              </Button>
              <Scale size={16} className={'text-text-muted'} />
            </div>
          </div>
          <p
            className={cn(
              'text-2xl font-black',
              !showSensitiveInfo && 'blur-md select-none',
              totals.saldo >= 0 ? 'text-positive' : 'text-negative'
            )}
          >
            {formatCurrency(totals.saldo)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className={cn('flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border', 'bg-surface-inset border-border-default')}>
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição..."
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
        <CustomDropdown
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
      <div className={cn('rounded-3xl border overflow-hidden', 'bg-surface-card border-border-subtle')}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">Nenhum lançamento encontrado para este filtro.</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filtered.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-raised transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      entry.tipo === 'entrada' ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                    )}
                  >
                    {entry.tipo === 'entrada' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('font-bold text-sm truncate', 'text-text-primary')}>{entry.descricao}</p>
                    <p className="text-xs text-text-muted flex items-center gap-2">
                      {parseLocalDate(entry.data).toLocaleDateString('pt-BR')}
                      {entry.forma_pagamento && <span>· {entry.forma_pagamento.nome}</span>}
                      {entry.venda_id && (
                        <span className="flex items-center gap-1 text-accent">
                          <Link2 size={11} /> venda
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('font-black text-sm', entry.tipo === 'entrada' ? 'text-positive' : 'text-negative')}>
                    {entry.tipo === 'entrada' ? '+' : '-'} {formatCurrency(entry.valor)}
                  </span>
                  {!entry.venda_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEntryToDelete(entry)}
                      className="size-8 rounded-lg text-text-muted hover:text-danger hover:bg-danger-bg"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      <LancamentoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} loading={loading} setLoading={setLoading} />

      {/* Confirmação de exclusão */}
      <Modal
        aberto={!!entryToDelete}
        onFechar={() => setEntryToDelete(null)}
        titulo="Excluir lançamento?"
        icone={Trash2}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setEntryToDelete(null)} className="h-auto flex-1 py-3 rounded-2xl font-bold text-sm">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="h-auto flex-1 py-3 rounded-2xl font-bold text-sm">
              Excluir
            </Button>
          </div>
        }
      >
        {entryToDelete && <p className="text-sm text-text-muted">"{entryToDelete.descricao}" será removido do caixa. Essa ação não pode ser desfeita.</p>}
      </Modal>
    </div>
  );
}

function LancamentoModal({
  isOpen,
  onClose,
  loading,
  setLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const { setCaixa, setCaixaPendencias } = useData();
  const { formasPagamento } = useCatalogos();
  const [modo, setModo] = useState<CaixaTipo | 'pendencia'>('saida');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  const reset = () => {
    setModo('saida');
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
      if (modo === 'pendencia') {
        // "Fiado/Pendência" é sempre um valor a RECEBER no futuro — não
        // lança em `caixa` agora, só quando um recebimento for confirmado
        // na sub-aba Pendências (ver migration_041).
        const result = await caixaPendenciasApi.criar({ descricao: descricao.trim(), valor_total: Number(valor), data });
        if (result.success) {
          setCaixaPendencias((prev) => [result.data, ...prev]);
          handleClose();
        }
      } else {
        const result = await caixaApi.lancar({
          tipo: modo,
          descricao: descricao.trim(),
          valor: Number(valor),
          forma_pagamento_id: formaPagamentoId || null,
          data,
        });
        if (result.success) {
          setCaixa((prev) => [result.data, ...prev]);
          handleClose();
        }
      }
    } catch (err) {
      console.error('Erro ao lançar no caixa:', err);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = cn(
    'w-full border rounded-xl py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50',
    'bg-surface-inset border-border-default text-text-primary'
  );
  const labelClass = cn('text-xs font-bold uppercase tracking-wider mb-1.5 block', 'text-text-muted');

  return (
    <Modal
      aberto={isOpen}
      onFechar={handleClose}
      titulo="Novo Lançamento"
      tamanho="md"
      rodape={
        <Button
          onClick={handleSubmit}
          disabled={loading || !descricao.trim() || !valor}
          className="h-auto w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-accent-shadow"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Lançamento'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setModo('entrada')}
            className={cn(
              'py-3 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all',
              modo === 'entrada' ? 'bg-positive border-positive text-surface-page' : 'border-border-default text-text-muted'
            )}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setModo('saida')}
            className={cn(
              'py-3 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all',
              modo === 'saida' ? 'bg-negative border-negative text-surface-page' : 'border-border-default text-text-muted'
            )}
          >
            Saída
          </button>
          <button
            type="button"
            onClick={() => setModo('pendencia')}
            className={cn(
              'py-3 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all',
              modo === 'pendencia' ? 'bg-warning border-warning text-surface-page' : 'border-border-default text-text-muted'
            )}
          >
            Fiado/Pendência
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

        {modo === 'pendencia' ? (
          <p className={cn('text-xs rounded-xl px-4 py-3', 'bg-surface-card text-text-secondary')}>
            Não lança no saldo do Caixa agora — só quando o recebimento for confirmado na sub-aba "Pendências", com a forma de pagamento real usada na hora.
          </p>
        ) : (
          <div>
            <label className={labelClass}>Forma de pagamento (opcional)</label>
            <CustomDropdown
              variant="form"
              value={formaPagamentoId}
              onChange={setFormaPagamentoId}
              placeholder="Selecione..."
              options={formasPagamento.map((p) => ({ value: p.id, label: p.nome }))}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
