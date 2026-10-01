import { useEffect, useMemo, useState } from 'react';
import { History, Undo2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { CurrencyInput } from '@/src/components/ui/CurrencyInput';
import { Select } from '@/src/components/ui/Select';
import { aviso } from '@/src/components/ui/toast';
import { useCatalogos } from '@/src/hooks/useCatalogos';
import { caixaPendenciasApi } from '@/src/features/caixa/api';
import { fiadoApi } from '@/src/features/fiado/api';
import type { PendenciaDemo } from '../data';
import { InventoryDrawer } from '../../estoque-preview/InventoryDrawer';

interface PendingReceivableDrawerProps {
  pending: PendenciaDemo | null;
  canReceive: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PendingReceivableDrawer({ pending, canReceive, onClose, onSaved }: PendingReceivableDrawerProps) {
  const { formasPagamento } = useCatalogos();
  const [valorCents, setValorCents] = useState<number | null>(null);
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [saving, setSaving] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmRevertId, setConfirmRevertId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formasAvista = useMemo(() => formasPagamento.filter((forma) => forma.natureza !== 'fiado').map((forma) => ({ value: forma.id, label: forma.nome })), [formasPagamento]);
  const saldo = pending ? Math.max(0, pending.total - pending.pago) : 0;

  useEffect(() => {
    setValorCents(pending ? Math.round(saldo * 100) : null);
    setFormaPagamentoId(formasAvista[0]?.value ?? '');
    setError(null);
  }, [formasAvista, pending, saldo]);

  if (!pending) return <InventoryDrawer isOpen={false} onClose={onClose} title="Recebimento"><span /></InventoryDrawer>;

  async function registrar() {
    const valor = (valorCents ?? 0) / 100;
    if (valor <= 0) return setError('Informe um valor maior que zero.');
    if (valor > saldo + 0.005) return setError(`O recebimento não pode ultrapassar o saldo de ${money(saldo)}.`);
    if (!formaPagamentoId) return setError('Escolha a forma de pagamento.');
    setSaving(true);
    setError(null);
    try {
      const result = pending.source.kind === 'fiado'
        ? await fiadoApi.registrarRecebimento({ venda_id: pending.source.vendaId, valor, forma_pagamento_id: formaPagamentoId })
        : await caixaPendenciasApi.registrarRecebimento(pending.source.pendenciaId, { valor, forma_pagamento_id: formaPagamentoId });
      if (!result.success) throw new Error(result.error || 'Não foi possível registrar o recebimento.');
      aviso.sucesso('Recebimento confirmado');
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o recebimento.');
      aviso.falha(cause, 'Erro ao registrar recebimento');
    } finally {
      setSaving(false);
    }
  }

  async function reverter(recebimentoId: string) {
    setRevertingId(recebimentoId);
    setError(null);
    try {
      const result = pending.source.kind === 'fiado'
        ? await fiadoApi.removerRecebimento(recebimentoId)
        : await caixaPendenciasApi.removerRecebimento(pending.source.pendenciaId, recebimentoId);
      if (!result.success) throw new Error(result.error || 'Não foi possível reverter o recebimento.');
      aviso.sucesso('Recebimento revertido');
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível reverter o recebimento.');
      aviso.falha(cause, 'Erro ao reverter recebimento');
    } finally {
      setRevertingId(null);
    }
  }

  return <InventoryDrawer isOpen title="Registrar recebimento" onClose={onClose} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" size="mobile" onClick={onClose}>Fechar</Button>{canReceive && <Button type="button" size="mobile" disabled={saving} onClick={() => void registrar()}>{saving ? 'Salvando…' : 'Confirmar recebimento'}</Button>}</div>}>
    <div className="space-y-5">
      <div className="rounded-card border border-border-default bg-surface-inset p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-faint">{pending.nome}</p><p className="mt-1 text-sm font-semibold">{pending.origem}</p><p className="mt-2 text-xs text-text-muted">Recebido {money(pending.pago)} de {money(pending.total)} · saldo {money(saldo)}</p></div>
      {!canReceive && <p className="rounded-control border border-border-default bg-surface-inset p-3 text-sm leading-6 text-text-muted">Seu perfil pode consultar este recebível, mas não registrar ou reverter recebimentos.</p>}
      {canReceive && <div className="grid min-w-0 gap-4 sm:grid-cols-2"><CurrencyInput label="Valor do recebimento" value={valorCents} onChange={setValorCents} size="lg" /><Select label="Forma de pagamento" value={formaPagamentoId} onChange={setFormaPagamentoId} options={formasAvista} placeholder="Selecione…" size="lg" /></div>}
      {pending.pagamentos?.length ? <div className="space-y-2"><p className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary"><History size={14} />Histórico de recebimentos</p><ul className="divide-y divide-border-subtle rounded-control border border-border-default bg-surface-card px-3">{pending.pagamentos.map((pagamento) => pagamento.id ? <li key={pagamento.id} className="flex min-w-0 items-center gap-2 py-2 text-xs"><span className="min-w-0 flex-1 truncate text-text-secondary">{pagamento.meio} · {new Date(pagamento.ocorridoEm).toLocaleDateString('pt-BR')}</span><strong className="shrink-0 tabular-nums">{money(pagamento.valor)}</strong>{canReceive && <button type="button" aria-label={`Reverter recebimento ${pagamento.id}`} onClick={() => setConfirmRevertId(pagamento.id!)} disabled={Boolean(revertingId)} className="grid size-9 shrink-0 place-items-center rounded-control text-text-muted hover:bg-danger-bg hover:text-danger"><Undo2 size={14} /></button>}</li> : null)}</ul></div> : null}
      {confirmRevertId && <div role="alertdialog" className="rounded-control border border-danger/20 bg-danger-bg p-3"><p className="text-sm font-semibold text-danger">Reverter este recebimento?</p><p className="mt-1 text-xs leading-5 text-danger/80">A entrada correspondente no Caixa também será desfeita.</p><div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" size="mobile" onClick={() => setConfirmRevertId(null)}>Cancelar</Button><Button type="button" size="mobile" className="bg-danger text-white hover:bg-danger/90" onClick={() => { const id = confirmRevertId; setConfirmRevertId(null); void reverter(id); }}>Confirmar reversão</Button></div></div>}
      {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-bg p-3 text-sm text-danger">{error}</p>}
    </div>
  </InventoryDrawer>;
}
