import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FilePenLine, UserRound } from 'lucide-react';
import { clientesApi } from '@/src/features/clientes/api';
import { caixaPendenciasApi } from '@/src/features/caixa/api';
import { vendasApi } from '@/src/features/vendas/api';
import { CurrencyInput } from '@/src/components/ui/CurrencyInput';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { Textarea } from '@/src/components/ui/Textarea';
import { InventoryDrawer } from '../../estoque-preview/InventoryDrawer';
import type { PendenciaDemo } from '../data';

interface ClienteOption { id: string; nome: string }

interface PendingEditDrawerProps {
  pending: PendenciaDemo | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PendingEditDrawer({ pending, canEdit, onClose, onSaved }: PendingEditDrawerProps) {
  const [descricao, setDescricao] = useState('');
  const [totalCents, setTotalCents] = useState<number | null>(null);
  const [data, setData] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    setDescricao(pending.source.kind === 'caixa' ? pending.origem : pending.nome);
    setTotalCents(Math.round(pending.total * 100));
    setData(pending.criadaEm.slice(0, 10));
    setClienteId(pending.clienteId ?? '');
    setObservacoes(pending.observacoes ?? '');
    setError(null);
  }, [pending]);

  useEffect(() => {
    if (!pending || !canEdit) return;
    let active = true;
    clientesApi.listar().then((result) => {
      if (active && result.success) setClientes((result.data ?? []).map((cliente) => ({ id: cliente.id, nome: cliente.nome })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [canEdit, pending]);

  const clienteOptions = useMemo(() => [
    { value: '', label: 'Sem cliente vinculado' },
    ...clientes.map((cliente) => ({ value: cliente.id, label: cliente.nome })),
  ], [clientes]);

  if (!pending) return <InventoryDrawer isOpen={false} onClose={onClose} title="Editar pendência"><span /></InventoryDrawer>;
  const manual = pending.source.kind === 'caixa';
  const total = (totalCents ?? 0) / 100;

  async function save() {
    if (!pending || !canEdit) return;
    setError(null);
    if (manual && !descricao.trim()) return setError('Informe a descrição da pendência.');
    if (manual && total + 0.005 < pending.pago) return setError(`O valor total não pode ser menor que o valor já recebido (${money(pending.pago)}).`);
    if (manual && total <= 0) return setError('O valor total deve ser maior que zero.');

    setSaving(true);
    try {
      const result = manual
        ? await caixaPendenciasApi.atualizar(pending.source.kind === 'caixa' ? pending.source.pendenciaId : '', {
            descricao: descricao.trim(), valor_total: total, data, cliente_id: clienteId || null,
          })
        : await vendasApi.atualizarParcial(pending.source.kind === 'fiado' ? pending.source.vendaId : '', {
            cliente_id: clienteId || null,
            cliente_nome: clienteOptions.find((option) => option.value === clienteId)?.label ?? null,
            observacoes: observacoes.trim() || null,
          });
      if (!result.success) throw new Error(result.error || 'Não foi possível salvar a pendência.');
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a pendência.');
    } finally {
      setSaving(false);
    }
  }

  return <InventoryDrawer isOpen title="Editar pendência" onClose={onClose} footer={canEdit ? <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-control border border-border-default px-4 text-sm font-semibold text-text-secondary hover:bg-surface-inset">Cancelar</button><button type="button" disabled={saving} onClick={() => void save()} className="min-h-11 rounded-control bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar alterações'}</button></div> : undefined}>
    <div className="space-y-5">
      <header className="rounded-card border border-border-default bg-surface-inset p-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">{manual ? 'Pendência manual do Caixa' : 'Venda em fiado'}</p>
        <p className="mt-1 text-base font-semibold text-text-primary">{pending.nome}</p>
        <p className="mt-1 text-xs text-text-muted">Recebido {money(pending.pago)} de {money(pending.total)}</p>
      </header>

      {!canEdit ? <div className="rounded-control border border-border-default bg-surface-inset p-4 text-sm leading-6 text-text-muted">Seu perfil pode consultar esta pendência, mas não alterá-la.</div> : <>
        {manual ? <div className="space-y-4">
          <Input label="Descrição" size="lg" value={descricao} onChange={(event) => setDescricao(event.target.value)} iconLeft={<FilePenLine size={15} />} />
          <CurrencyInput label="Valor total" size="lg" value={totalCents} onChange={setTotalCents} helper={`Recebido até agora: ${money(pending.pago)}`} />
          <Input label="Data da pendência" type="date" size="lg" value={data} onChange={(event) => setData(event.target.value)} iconLeft={<CalendarDays size={15} />} />
        </div> : <div className="rounded-control border border-warning/20 bg-warning-bg p-3 text-xs leading-5 text-warning">Valor e data pertencem à venda original e ficam protegidos. Esta edição altera somente cliente e observações.</div>}

        <Select label="Cliente" value={clienteId} onChange={setClienteId} options={clienteOptions} size="lg" renderOption={(option) => <span className="inline-flex items-center gap-2"><UserRound size={14} />{option.label}</span>} />
        {!manual && <Textarea label="Observações" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} maxLength={500} showCount autoResize />}

        {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      </>}
    </div>
  </InventoryDrawer>;
}
