// Aba Fiado: acompanhamento de vendas com forma de pagamento de natureza
// 'fiado' (ver migration_030) que ainda têm saldo em aberto. Venda fiado NÃO
// lança no Caixa na hora (ver registrar_venda, migration_031) — só lança
// quando um recebimento é confirmado aqui, com a forma de pagamento real
// escolhida no momento, podendo ser parcial (ver src/features/fiado/metricas.ts).
import { useMemo, useState } from 'react';
import { HandCoins, Loader2, Check, Clock, History, Undo2 } from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { useCatalogos } from '../../hooks/useCatalogos';
import { fiadoApi } from './api';
import { vendasFiadoEmAberto, resumoFiadoPorCliente } from './metricas';
import type { ResumoFiadoCliente } from './metricas';
import type { Venda } from '../vendas/types';
import type { FiadoRecebimento } from './types';
import type { Role } from '../../constants/roles';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

// Uma venda por vez: valor a receber (default = saldo restante, editável pra
// permitir parcial) + forma de pagamento real + histórico do que já foi
// recebido dela.
function LinhaVendaFiado({ venda, saldo, diasEmAberto, podeReverter }: { venda: Venda; saldo: number; diasEmAberto: number; podeReverter: boolean }) {
  const { fiadoRecebimentos, refreshData } = useData();
  const { formasPagamento } = useCatalogos();
  const [valor, setValor] = useState(String(saldo.toFixed(2)));
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recebimentoParaReverter, setRecebimentoParaReverter] = useState<FiadoRecebimento | null>(null);
  const [revertendo, setRevertendo] = useState(false);

  // Não faz sentido "confirmar recebimento" numa forma que é ela mesma fiado
  // — o backend recusaria de qualquer jeito, filtra aqui pra não nem oferecer.
  const formasAvista = useMemo(() => formasPagamento.filter((f) => f.natureza !== 'fiado'), [formasPagamento]);
  const historico = useMemo(
    () => fiadoRecebimentos.filter((r) => r.venda_id === venda.id).sort((a, b) => new Date(b.recebido_em).getTime() - new Date(a.recebido_em).getTime()),
    [fiadoRecebimentos, venda.id]
  );

  const confirmar = async () => {
    const numero = Number(valor.replace(',', '.'));
    if (!numero || numero <= 0) return aviso.atencao('Informe um valor válido');
    if (!formaPagamentoId) return aviso.atencao('Escolha a forma de pagamento');

    setEnviando(true);
    try {
      const result = await fiadoApi.registrarRecebimento({ venda_id: venda.id, valor: numero, forma_pagamento_id: formaPagamentoId });
      if (!result.success) throw new Error(result.error);
      await refreshData();
      aviso.sucesso('Recebimento confirmado');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao confirmar recebimento');
    } finally {
      setEnviando(false);
    }
  };

  const reverterRecebimento = async () => {
    if (!recebimentoParaReverter) return;
    setRevertendo(true);
    try {
      const result = await fiadoApi.removerRecebimento(recebimentoParaReverter.id);
      if (!result.success) throw new Error(result.error);
      await refreshData();
      setRecebimentoParaReverter(null);
      aviso.sucesso('Recebimento revertido');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao reverter recebimento');
    } finally {
      setRevertendo(false);
    }
  };

  return (
    <div className="bg-surface-card border border-border-subtle rounded-control p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary truncate">{venda.nome_item}</p>
          <p className="text-xs text-text-faint">
            {formatarData(venda.data)} · <StatusBadge texto={`${diasEmAberto}d`} tom={diasEmAberto >= 30 ? 'danger' : diasEmAberto >= 15 ? 'warning' : 'neutral'} />
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-text-primary">{formatCurrency(saldo)}</p>
          <p className="text-[10px] text-text-faint uppercase tracking-wide">Saldo em aberto</p>
        </div>
      </div>

      {historico.length > 0 && (
        <div className="text-xs text-text-faint space-y-1 border-t border-border-subtle/60 pt-2">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-text-muted">
            <History size={11} /> Recebido até agora
          </p>
          {historico.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {new Date(r.recebido_em).toLocaleDateString('pt-BR')} · {r.forma_pagamento?.nome || '—'} · {r.usuario?.nome_exibicao || 'Equipe'}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-text-secondary">{formatCurrency(r.valor)}</span>
                {podeReverter && (
                  <button
                    onClick={() => setRecebimentoParaReverter(r)}
                    title="Reverter este recebimento"
                    className="size-5 flex items-center justify-center rounded-control text-text-faint hover:text-danger hover:bg-surface-raised"
                  >
                    <Undo2 size={11} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal
        aberto={!!recebimentoParaReverter}
        onFechar={() => setRecebimentoParaReverter(null)}
        titulo="Reverter recebimento?"
        icone={Undo2}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <button
              onClick={() => setRecebimentoParaReverter(null)}
              className="flex-1 h-11 rounded-control border border-border-default font-medium text-sm text-text-secondary hover:bg-surface-raised"
            >
              Cancelar
            </button>
            <button
              onClick={reverterRecebimento}
              disabled={revertendo}
              className="flex-1 h-11 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {revertendo ? <Loader2 size={16} className="animate-spin" /> : 'Reverter'}
            </button>
          </div>
        }
      >
        {recebimentoParaReverter && (
          <p className="text-sm text-text-secondary">
            O recebimento de <span className="text-text-primary font-medium">{formatCurrency(recebimentoParaReverter.valor)}</span> via{' '}
            {recebimentoParaReverter.forma_pagamento?.nome || '—'} volta a ficar em aberto nesta venda, e a entrada correspondente no Caixa é desfeita.
          </p>
        )}
      </Modal>

      <div className="flex items-center gap-2 pt-1">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          className="w-24 border rounded-control py-2 px-2.5 text-xs outline-none bg-surface-inset border-border-default text-text-primary focus:ring-2 focus:ring-accent/50"
          placeholder="0,00"
        />
        <select
          value={formaPagamentoId}
          onChange={(e) => setFormaPagamentoId(e.target.value)}
          className="flex-1 border rounded-control py-2 px-2.5 text-xs outline-none bg-surface-inset border-border-default text-text-primary focus:ring-2 focus:ring-accent/50"
        >
          <option value="">Forma de pagamento...</option>
          {formasAvista.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <button
          onClick={confirmar}
          disabled={enviando}
          className="shrink-0 h-8 px-3 rounded-control bg-positive text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
        >
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirmar
        </button>
      </div>
    </div>
  );
}

export function FiadoView({ userRoles = [] }: { userRoles?: Role[] }) {
  const { vendas, fiadoRecebimentos, loading } = useData();
  const podeReverter = userRoles.includes('admin');
  const [clienteAberto, setClienteAberto] = useState<string | null>(null);

  const resumos = useMemo(() => resumoFiadoPorCliente(vendas, fiadoRecebimentos), [vendas, fiadoRecebimentos]);
  const chaveDoResumo = (r: ResumoFiadoCliente) => r.clienteId ?? `nome:${r.clienteNome.toLowerCase()}`;

  // Recalcula a partir de `vendas`/`fiadoRecebimentos` sempre que o modal
  // reabre — assim o saldo reflete o refreshData disparado por cada
  // confirmação sem precisar guardar estado próprio de "resumo aberto".
  const vendasDoClienteAberto = useMemo(() => {
    if (!clienteAberto) return [];
    return vendasFiadoEmAberto(vendas, fiadoRecebimentos).filter((item) => {
      const clienteId = item.venda.cliente_id;
      const clienteNome = item.venda.cliente?.nome || item.venda.cliente_nome || 'Sem nome';
      const chave = clienteId ?? `nome:${clienteNome.toLowerCase()}`;
      return chave === clienteAberto;
    });
  }, [clienteAberto, vendas, fiadoRecebimentos]);

  const nomeClienteAberto = vendasDoClienteAberto[0]?.venda.cliente?.nome || vendasDoClienteAberto[0]?.venda.cliente_nome || 'Sem nome';
  const totalClienteAberto = vendasDoClienteAberto.reduce((soma, v) => soma + v.saldo, 0);

  const totalGeral = useMemo(() => resumos.reduce((soma, r) => soma + r.totalEmAberto, 0), [resumos]);

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
    { key: 'total', header: 'Saldo em aberto', align: 'right', render: (r) => <span className="font-medium text-text-primary">{formatCurrency(r.totalEmAberto)}</span> },
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
          <p className="text-sm text-text-faint mt-0.5">Vendas pendentes de recebimento, por cliente</p>
        </div>
        {resumos.length > 0 && (
          <div className="text-right">
            <p className="text-lg font-medium text-text-primary tabular-nums">{formatCurrency(totalGeral)}</p>
            <p className="text-[10px] text-text-faint uppercase tracking-wider">Saldo total em aberto</p>
          </div>
        )}
      </div>

      <p className="text-xs text-text-faint bg-surface-inset border border-border-subtle rounded-control px-4 py-2.5">
        Venda fiado não entra no Caixa na hora — só quando um recebimento é confirmado aqui, com a forma de pagamento real. Pode ser parcial: cada confirmação abate o saldo em aberto da venda.
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

      <Modal
        aberto={!!clienteAberto}
        onFechar={() => setClienteAberto(null)}
        titulo={nomeClienteAberto}
        subtitulo={`${formatCurrency(totalClienteAberto)} em aberto · ${vendasDoClienteAberto.length} venda(s)`}
        tamanho="lg"
        rodape={
          <button onClick={() => setClienteAberto(null)} className="w-full py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
            Fechar
          </button>
        }
      >
        <div className="space-y-3">
          {vendasDoClienteAberto.length === 0 ? (
            <p className="text-sm text-text-faint text-center py-4">Tudo quitado — feche e volte pra lista.</p>
          ) : (
            vendasDoClienteAberto.map(({ venda, saldo, diasEmAberto }) => (
              <div key={venda.id}>
                <LinhaVendaFiado venda={venda} saldo={saldo} diasEmAberto={diasEmAberto} podeReverter={podeReverter} />
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
