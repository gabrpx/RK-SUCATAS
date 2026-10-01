import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { CurrencyInput } from '@/src/components/ui/CurrencyInput';
import { Input } from '@/src/components/ui/Input';
import { Select } from '@/src/components/ui/Select';
import { aviso } from '@/src/components/ui/toast';
import { caixaApi } from '@/src/features/caixa/api';
import type { CaixaTipo } from '@/src/features/caixa/types';
import { useCatalogos } from '@/src/hooks/useCatalogos';
import { InventoryDrawer } from '../../estoque-preview/InventoryDrawer';

interface MovementActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialTipo?: CaixaTipo;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export function MovementActionDrawer({ isOpen, onClose, onSaved, initialTipo = 'entrada' }: MovementActionDrawerProps) {
  const { formasPagamento = [] } = useCatalogos();
  const [tipo, setTipo] = useState<CaixaTipo>(initialTipo);
  const [descricao, setDescricao] = useState('');
  const [valorCents, setValorCents] = useState<number | null>(null);
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [data, setData] = useState(hoje);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTipo(initialTipo);
    setDescricao('');
    setValorCents(null);
    setFormaPagamentoId('');
    setData(hoje());
  }, [initialTipo, isOpen]);

  const close = () => { if (!saving) onClose(); };

  async function save() {
    const valor = (valorCents ?? 0) / 100;
    if (!descricao.trim()) return aviso.atencao('Informe a descrição do lançamento');
    if (valor <= 0) return aviso.atencao('Informe um valor maior que zero');
    setSaving(true);
    try {
      const result = await caixaApi.lancar({ tipo, descricao: descricao.trim(), valor, forma_pagamento_id: formaPagamentoId || null, data });
      if (!result.success) throw new Error(result.error || 'Não foi possível salvar o lançamento.');
      aviso.sucesso(tipo === 'saida' ? 'Saída registrada' : 'Entrada registrada');
      onSaved();
      onClose();
    } catch (error) {
      aviso.falha(error, 'Erro ao salvar lançamento');
    } finally {
      setSaving(false);
    }
  }

  return <InventoryDrawer isOpen={isOpen} onClose={close} title={tipo === 'saida' ? 'Nova saída / conta a pagar' : 'Nova entrada'} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" size="mobile" onClick={close}>Cancelar</Button><Button type="button" size="mobile" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar lançamento'}</Button></div>}>
    <div className="space-y-5">
      <fieldset className="space-y-2"><legend className="text-xs font-semibold text-text-secondary">Tipo de lançamento</legend><div className="grid min-w-0 gap-2 sm:grid-cols-2"><button type="button" aria-pressed={tipo === 'entrada'} onClick={() => setTipo('entrada')} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-control border px-3 text-left text-sm font-semibold transition ${tipo === 'entrada' ? 'border-positive/30 bg-positive-bg text-positive' : 'border-border-default text-text-secondary hover:bg-surface-inset'}`}><ArrowDownLeft size={16} />Entrada</button><button type="button" aria-pressed={tipo === 'saida'} onClick={() => setTipo('saida')} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-control border px-3 text-left text-sm font-semibold transition ${tipo === 'saida' ? 'border-negative/30 bg-negative-bg text-negative' : 'border-border-default text-text-secondary hover:bg-surface-inset'}`}><ArrowUpRight size={16} />Saída</button></div></fieldset>
      <Input label="Descrição" size="lg" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder={tipo === 'saida' ? 'Ex.: conta de energia ou fornecedor' : 'Ex.: recebimento avulso'} />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2"><CurrencyInput label="Valor" size="lg" value={valorCents} onChange={setValorCents} /><Input label="Data" type="date" size="lg" value={data} onChange={(event) => setData(event.target.value)} /></div>
      <Select label="Forma de pagamento (opcional)" value={formaPagamentoId} onChange={setFormaPagamentoId} options={formasPagamento.filter((forma) => forma.natureza !== 'fiado').map((forma) => ({ value: forma.id, label: forma.nome }))} placeholder="Selecione…" size="lg" />
      {tipo === 'saida' && <p className="rounded-control border border-warning/20 bg-warning-bg px-3 py-2.5 text-xs leading-5 text-warning">A saída entra no livro-caixa usando a data informada.</p>}
    </div>
  </InventoryDrawer>;
}
