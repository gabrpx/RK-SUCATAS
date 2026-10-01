import { useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { CurrencyInput } from '@/src/components/ui/CurrencyInput';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { clientesApi } from '@/src/features/clientes/api';
import { caixaPendenciasApi } from '@/src/features/caixa/api';
import { InventoryDrawer } from '../../estoque-preview/InventoryDrawer';

interface ClienteOption { id: string; nome: string }

export function PendingCreateDrawer({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState('');
  const [valorCents, setValorCents] = useState<number | null>(null);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState('');
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDescricao('');
    setValorCents(null);
    setData(new Date().toISOString().slice(0, 10));
    setClienteId('');
    setError(null);
    setLoadingClientes(true);
    clientesApi.listar().then((result) => {
      if (result.success) setClientes((result.data ?? []).filter((cliente) => cliente.ativo !== false && cliente.banido !== true).map((cliente) => ({ id: cliente.id, nome: cliente.nome })));
    }).catch(() => undefined).finally(() => setLoadingClientes(false));
  }, [isOpen]);

  async function save() {
    const valor = (valorCents ?? 0) / 100;
    if (!descricao.trim()) return setError('Informe uma descrição.');
    if (valor <= 0) return setError('Informe um valor maior que zero.');
    if (!data) return setError('Informe a data da pendência.');
    setSaving(true);
    setError(null);
    try {
      const result = await caixaPendenciasApi.criar({ descricao: descricao.trim(), valor_total: valor, data, cliente_id: clienteId || null });
      if (!result.success) throw new Error(result.error || 'Não foi possível criar a pendência.');
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a pendência.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;
  return <InventoryDrawer isOpen onClose={onClose} title="Nova pendência" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" size="mobile" onClick={onClose}>Cancelar</Button><Button type="button" size="mobile" onClick={() => void save()} disabled={saving} className="bg-accent text-white hover:bg-accent-hover">{saving ? 'Salvando…' : 'Criar pendência'}</Button></div>}>
    <div className="space-y-5">
      <Input label="Descrição" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Ex.: peça reservada, serviço…" size="lg" />
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"><CurrencyInput label="Valor total" value={valorCents} onChange={setValorCents} size="lg" /><Input label="Data da pendência" type="date" value={data} onChange={(event) => setData(event.target.value)} size="lg" /></div>
      <Select label="Cliente" value={clienteId} onChange={setClienteId} options={[{ value: '', label: loadingClientes ? 'Carregando clientes…' : 'Sem cliente vinculado' }, ...clientes.map((cliente) => ({ value: cliente.id, label: cliente.nome }))]} size="lg" />
      {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <p className="rounded-control border border-border-default bg-surface-inset p-3 text-xs leading-5 text-text-muted">A pendência fica fora do saldo do Caixa até que um recebimento seja confirmado.</p>
    </div>
  </InventoryDrawer>;
}
