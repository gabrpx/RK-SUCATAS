// Sub-aba "Pendências" do Caixa: lançamentos manuais criados como "Fiado/
// Pendência" (ver LancamentoModal em CaixaView.tsx) que ainda têm saldo em
// aberto. Uma pendência NÃO lança em `caixa` na hora — só lança quando um
// recebimento (parcial ou total) é confirmado aqui, com a forma de
// pagamento real escolhida no momento (mesmo modelo da aba Fiado, mas sem
// cliente/venda associado — ver migration_041). Estrutura espelha
// LinhaVendaFiado em src/features/fiado/FiadoView.tsx, sem agrupamento por
// cliente.
import { useMemo, useState } from 'react';
import { Clock3, Loader2, Check, History, Undo2 } from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { aviso } from '../../components/ui/toast';
import { caixaPendenciasApi } from './api';
import type { CaixaPendencia, CaixaPendenciaRecebimento } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

function LinhaPendencia({
  theme,
  pendencia,
  saldo,
  historico,
  podeReverter,
}: {
  theme: 'light' | 'dark';
  pendencia: CaixaPendencia;
  saldo: number;
  historico: CaixaPendenciaRecebimento[];
  podeReverter: boolean;
}) {
  const { formasPagamento } = useCatalogos();
  const { refreshData } = useData();
  const [valor, setValor] = useState(String(saldo.toFixed(2)));
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recebimentoParaReverter, setRecebimentoParaReverter] = useState<CaixaPendenciaRecebimento | null>(null);
  const [revertendo, setRevertendo] = useState(false);

  // Não faz sentido "confirmar recebimento" numa forma que é ela mesma fiado
  // — o backend recusaria de qualquer jeito, filtra aqui pra não nem oferecer.
  const formasAvista = useMemo(() => formasPagamento.filter((f) => f.natureza !== 'fiado'), [formasPagamento]);

  const confirmar = async () => {
    const numero = Number(valor.replace(',', '.'));
    if (!numero || numero <= 0) return aviso.atencao('Informe um valor válido');
    if (!formaPagamentoId) return aviso.atencao('Escolha a forma de pagamento');

    setEnviando(true);
    try {
      const result = await caixaPendenciasApi.registrarRecebimento(pendencia.id, { valor: numero, forma_pagamento_id: formaPagamentoId });
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
      const result = await caixaPendenciasApi.removerRecebimento(pendencia.id, recebimentoParaReverter.id);
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
    <div className={cn('rounded-2xl border p-4 space-y-3', theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-sm font-bold truncate', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>{pendencia.descricao}</p>
          <p className="text-xs text-zinc-500">{formatarData(pendencia.data)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn('text-sm font-black', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>{formatCurrency(saldo)}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Saldo em aberto</p>
        </div>
      </div>

      {historico.length > 0 && (
        <div className={cn('text-xs space-y-1 border-t pt-2', theme === 'dark' ? 'border-zinc-800/60 text-zinc-500' : 'border-zinc-200 text-zinc-500')}>
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold">
            <History size={11} /> Recebido até agora
          </p>
          {historico.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {new Date(r.recebido_em).toLocaleDateString('pt-BR')} · {r.forma_pagamento?.nome || '—'} · {r.usuario?.nome_exibicao || 'Equipe'}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className={theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}>{formatCurrency(r.valor)}</span>
                {podeReverter && (
                  <button
                    onClick={() => setRecebimentoParaReverter(r)}
                    title="Reverter este recebimento"
                    className="size-5 flex items-center justify-center rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10"
                  >
                    <Undo2 size={11} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {recebimentoParaReverter && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRecebimentoParaReverter(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn('w-full max-w-sm rounded-3xl border p-6 space-y-4', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}
          >
            <h3 className={cn('text-lg font-black', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Reverter recebimento?</h3>
            <p className="text-sm text-zinc-500">
              O recebimento de <span className={theme === 'dark' ? 'text-zinc-200 font-bold' : 'text-zinc-800 font-bold'}>{formatCurrency(recebimentoParaReverter.valor)}</span> via{' '}
              {recebimentoParaReverter.forma_pagamento?.nome || '—'} volta a ficar em aberto nesta pendência, e a entrada correspondente no Caixa é desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRecebimentoParaReverter(null)}
                className={cn('flex-1 py-3 rounded-2xl font-bold text-sm', theme === 'dark' ? 'bg-zinc-900 text-zinc-300' : 'bg-zinc-100 text-zinc-700')}
              >
                Cancelar
              </button>
              <button
                onClick={reverterRecebimento}
                disabled={revertendo}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {revertendo ? <Loader2 size={16} className="animate-spin" /> : 'Reverter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          className={cn(
            'w-24 border rounded-xl py-2 px-2.5 text-xs outline-none focus:ring-2 focus:ring-violet-500/50',
            theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-900'
          )}
          placeholder="0,00"
        />
        <select
          value={formaPagamentoId}
          onChange={(e) => setFormaPagamentoId(e.target.value)}
          className={cn(
            'flex-1 border rounded-xl py-2 px-2.5 text-xs outline-none focus:ring-2 focus:ring-violet-500/50',
            theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-900'
          )}
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
          className="shrink-0 h-8 px-3 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5"
        >
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirmar
        </button>
      </div>
    </div>
  );
}

export function PendenciasTab({ theme, userRoles }: { theme: 'light' | 'dark'; userRoles: string[] }) {
  const { caixaPendencias, caixaPendenciaRecebimentos, loading } = useData();
  const podeReverter = userRoles.includes('admin');

  const abertas = useMemo(
    () => caixaPendencias.filter((p) => p.status === 'aberta').sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()),
    [caixaPendencias]
  );

  const totalEmAberto = useMemo(() => {
    return abertas.reduce((soma, p) => {
      const recebido = caixaPendenciaRecebimentos.filter((r) => r.pendencia_id === p.id).reduce((s, r) => s + Number(r.valor), 0);
      return soma + (Number(p.valor_total) - recebido);
    }, 0);
  }, [abertas, caixaPendenciaRecebimentos]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className={cn('text-xs rounded-xl px-4 py-2.5', theme === 'dark' ? 'bg-zinc-900 text-zinc-400' : 'bg-zinc-100 text-zinc-600')}>
          Pendência não entra no Caixa na hora — só quando um recebimento é confirmado aqui. Pode ser parcial: cada confirmação abate o saldo em aberto.
        </p>
        {abertas.length > 0 && (
          <div className="text-right shrink-0">
            <p className={cn('text-lg font-black', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>{formatCurrency(totalEmAberto)}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Saldo total em aberto</p>
          </div>
        )}
      </div>

      {loading && abertas.length === 0 ? (
        <div className="py-12 flex items-center justify-center text-zinc-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : abertas.length === 0 ? (
        <div className={cn('rounded-3xl border p-12 text-center', theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200')}>
          <Clock3 size={28} className="mx-auto mb-3 text-zinc-500" />
          <p className="text-sm text-zinc-500">Nenhuma pendência em aberto.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {abertas.map((pendencia) => {
            const historico = caixaPendenciaRecebimentos
              .filter((r) => r.pendencia_id === pendencia.id)
              .sort((a, b) => new Date(b.recebido_em).getTime() - new Date(a.recebido_em).getTime());
            const recebido = historico.reduce((s, r) => s + Number(r.valor), 0);
            const saldo = Number(pendencia.valor_total) - recebido;
            return (
              <div key={pendencia.id}>
                <LinhaPendencia theme={theme} pendencia={pendencia} saldo={saldo} historico={historico} podeReverter={podeReverter} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
