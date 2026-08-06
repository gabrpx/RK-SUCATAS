// Aba Fiado: acompanhamento de vendas com forma de pagamento de natureza
// 'fiado' (ver migration_030) que ainda não foram "acertadas". Isso é só
// rastreamento/cobrança — a venda já foi lançada no Caixa no valor cheio na
// hora, então "marcar como quitado" aqui não mexe em Caixa nenhum, só tira a
// venda desta lista (ver src/features/fiado/metricas.ts).
import { useMemo, useState } from 'react';
import { HandCoins, Loader2, Check, Clock } from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { fiadoApi } from './api';
import { resumoFiadoPorCliente } from './metricas';
import type { ResumoFiadoCliente } from './metricas';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

export function FiadoView() {
  const { vendas, fiadoBaixas, loading, refreshData } = useData();
  const [clienteAberto, setClienteAberto] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const resumos = useMemo(() => resumoFiadoPorCliente(vendas, fiadoBaixas), [vendas, fiadoBaixas]);
  const chaveDoResumo = (r: ResumoFiadoCliente) => r.clienteId ?? `nome:${r.clienteNome.toLowerCase()}`;
  const resumoAberto = resumos.find((r) => chaveDoResumo(r) === clienteAberto) || null;

  const totalGeral = useMemo(() => resumos.reduce((soma, r) => soma + r.totalEmAberto, 0), [resumos]);

  const marcarQuitado = async (vendaId: string) => {
    setQuitando(vendaId);
    try {
      const result = await fiadoApi.registrarBaixa({ venda_id: vendaId });
      if (!result.success) throw new Error(result.error);
      await refreshData();
      aviso.sucesso('Marcado como quitado');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao marcar como quitado');
    } finally {
      setQuitando(null);
    }
  };

  const colunas: DataTableColumn<ResumoFiadoCliente>[] = [
    { key: 'cliente', header: 'Cliente', render: (r) => <span className="text-sm font-medium text-text-primary">{r.clienteNome}</span> },
    { key: 'vendas', header: 'Vendas em aberto', render: (r) => `${r.vendas.length}` },
    {
      key: 'dias',
      header: 'Em aberto há',
      render: (r) => (
        <span className={cn('flex items-center gap-1.5', r.diasEmAbertoMax >= 30 ? 'text-danger' : r.diasEmAbertoMax >= 15 ? 'text-warning' : 'text-text-secondary')}>
          <Clock size={12} /> {r.diasEmAbertoMax}d
        </span>
      ),
    },
    { key: 'total', header: 'Total em aberto', align: 'right', render: (r) => <span className="font-medium text-text-primary">{formatCurrency(r.totalEmAberto)}</span> },
  ];

  function renderMobileCard(r: ResumoFiadoCliente) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{r.clienteNome}</p>
          <p className="text-xs text-text-faint">
            {r.vendas.length} venda(s) · {r.diasEmAbertoMax}d em aberto
          </p>
        </div>
        <p className="text-sm font-medium text-text-primary shrink-0">{formatCurrency(r.totalEmAberto)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Fiado</h1>
          <p className="text-sm text-text-faint mt-0.5">Vendas pendentes de acerto, por cliente</p>
        </div>
        {resumos.length > 0 && (
          <div className="text-right">
            <p className="text-lg font-medium text-text-primary tabular-nums">{formatCurrency(totalGeral)}</p>
            <p className="text-[10px] text-text-faint uppercase tracking-wider">Total em aberto</p>
          </div>
        )}
      </div>

      <p className="text-xs text-text-faint bg-surface-inset border border-border-subtle rounded-control px-4 py-2.5">
        Isto é só um acompanhamento de cobrança — a venda já entrou no Caixa no valor cheio na hora. "Marcar como quitado" não gera nem duplica nenhum lançamento de caixa.
      </p>

      <DataTable
        colunas={colunas}
        dados={loading ? [] : resumos}
        getRowKey={(r) => chaveDoResumo(r)}
        onRowClick={(r) => setClienteAberto(chaveDoResumo(r))}
        renderMobileCard={renderMobileCard}
        paginaAtual={1}
        totalPaginas={1}
        onMudarPagina={() => {}}
        emptyState={
          loading ? (
            <div className="py-12 flex items-center justify-center text-text-faint">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <EmptyState icone={HandCoins} mensagem="Nenhuma venda fiado em aberto." />
          )
        }
      />

      {resumoAberto && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center overflow-y-auto" onClick={() => setClienteAberto(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle my-auto"
          >
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-lg font-medium">{resumoAberto.clienteNome}</h2>
              <p className="text-xs text-text-faint mt-0.5">{formatCurrency(resumoAberto.totalEmAberto)} em aberto · {resumoAberto.vendas.length} venda(s)</p>
            </div>
            <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {resumoAberto.vendas.map(({ venda, diasEmAberto }) => (
                <div key={venda.id} className="flex items-center justify-between gap-3 bg-surface-card border border-border-subtle rounded-control p-3">
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary truncate">{venda.nome_item}</p>
                    <p className="text-xs text-text-faint">
                      {formatarData(venda.data)} · <StatusBadge texto={`${diasEmAberto}d`} tom={diasEmAberto >= 30 ? 'danger' : diasEmAberto >= 15 ? 'warning' : 'neutral'} />
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-text-primary">{formatCurrency(venda.valor_total)}</span>
                    <button
                      onClick={() => marcarQuitado(venda.id)}
                      disabled={quitando === venda.id}
                      title="Marcar como quitado"
                      className="size-8 flex items-center justify-center rounded-control text-positive hover:bg-positive-bg disabled:opacity-50"
                    >
                      {quitando === venda.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-6 border-t border-border-subtle">
              <button onClick={() => setClienteAberto(null)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
