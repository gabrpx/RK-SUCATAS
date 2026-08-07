// "Máximo de dados do cliente" dentro dos detalhes de uma venda — antes só
// mostrava o nome puro (venda.cliente_nome). Telefone/documento/tags/
// observações/histórico/fiado vêm direto do DataContext (já carregados em
// memória, sem custo de rede); só motos e os comprovantes de PIX de OUTRAS
// compras do cliente exigem buscar a ficha completa (GET /api/clientes/:id).
import { useEffect, useState } from 'react';
import { Phone, IdCard, Bike, HandCoins, Loader2, PackageSearch } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { clientesApi } from '../clientes/api';
import { calcularHistoricoCliente } from '../clientes/metricas';
import { saldoPorVenda } from '../fiado/metricas';
import { comprovantesApi } from '../comprovantes/api';
import { ComprovanteListItem } from '../comprovantes/ComprovantesPixVenda';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatTelefoneBR, formatDocumentoBR } from '../../utils/formatters';
import type { ComprovantePixComVenda } from '../comprovantes/types';
import type { Cliente } from '../clientes/types';
import type { Venda } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

interface VendaClienteResumoProps {
  clienteId: string;
  venda: Venda;
  podeExcluirComprovante?: boolean;
  onAbrirFiado?: () => void;
}

export function VendaClienteResumo({ clienteId, venda, podeExcluirComprovante = false, onAbrirFiado }: VendaClienteResumoProps) {
  const { clientes, vendas, orcamentos, fiadoRecebimentos } = useData();
  const [detalhado, setDetalhado] = useState<Cliente | null>(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregandoDetalhes(true);
    clientesApi
      .buscar(clienteId)
      .then((resultado) => {
        if (ativo && resultado.success) setDetalhado(resultado.data);
      })
      .finally(() => {
        if (ativo) setCarregandoDetalhes(false);
      });
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const cliente = clientes.find((c) => c.id === clienteId);
  if (!cliente) return null;

  const historico = calcularHistoricoCliente(clienteId, vendas, orcamentos);
  const saldoFiado = venda.forma_pagamento?.natureza === 'fiado' ? saldoPorVenda(venda, fiadoRecebimentos) : 0;
  // Comprovantes de OUTRAS compras do cliente — os desta venda já aparecem
  // em ComprovantesPixVenda, logo em cima; repetir aqui seria redundante.
  const comprovantesOutrasCompras = (detalhado?.comprovantes_pix ?? []).filter((c) => c.venda_id !== venda.id);

  const excluirComprovanteOutraCompra = async (comprovante: ComprovantePixComVenda) => {
    if (!comprovante.venda_id) return;
    const resultado = await comprovantesApi.remover(comprovante.venda_id, comprovante.id);
    if (!resultado.success) return;
    setDetalhado((prev) => (prev ? { ...prev, comprovantes_pix: prev.comprovantes_pix?.filter((c) => c.id !== comprovante.id) } : prev));
  };

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5 space-y-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">Cliente</h4>

      <div className="grid grid-cols-2 gap-3">
        {cliente.telefone && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Phone size={14} className="text-text-faint shrink-0" />
            {formatTelefoneBR(cliente.telefone)}
          </div>
        )}
        {cliente.documento && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <IdCard size={14} className="text-text-faint shrink-0" />
            {formatDocumentoBR(cliente.documento)}
          </div>
        )}
      </div>

      {cliente.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cliente.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-badge bg-surface-inset px-2 py-0.5 text-[11px] font-medium leading-none text-text-muted">
              {tag}
            </span>
          ))}
        </div>
      )}

      {cliente.observacoes && <p className="text-sm text-text-secondary whitespace-pre-line">{cliente.observacoes}</p>}

      <div className="grid grid-cols-3 gap-3 pt-1">
        <div>
          <p className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(historico.totalGasto)}</p>
          <p className="text-[10px] text-text-faint uppercase tracking-wide">Total gasto</p>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(historico.ticketMedio)}</p>
          <p className="text-[10px] text-text-faint uppercase tracking-wide">Ticket médio</p>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary tabular-nums">{historico.diasDesdeUltimaCompra ?? '—'}</p>
          <p className="text-[10px] text-text-faint uppercase tracking-wide">Dias desde a última compra</p>
        </div>
      </div>

      {saldoFiado > 0.01 && (
        <button
          type="button"
          onClick={onAbrirFiado}
          disabled={!onAbrirFiado}
          className="w-full flex items-center justify-between gap-2 rounded-control border border-warning/25 bg-warning-bg/40 px-3 py-2.5 text-left disabled:cursor-default"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <HandCoins size={13} /> Saldo em aberto (fiado) desta venda
          </span>
          <span className="text-sm font-medium text-warning tabular-nums">{formatCurrency(saldoFiado)}</span>
        </button>
      )}

      {carregandoDetalhes ? (
        <p className="text-xs text-text-faint flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Carregando motos e comprovantes...
        </p>
      ) : (
        <>
          {(detalhado?.motos?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-text-faint uppercase tracking-wide flex items-center gap-1.5">
                <Bike size={12} /> Motos do cliente
              </p>
              <ul className="space-y-1">
                {detalhado!.motos!.map((moto) => (
                  <li key={moto.id} className="text-sm text-text-secondary">
                    {moto.modelo_moto?.nome || 'Modelo não informado'}
                    {moto.placa && ` · ${moto.placa}`}
                    {moto.cor && ` · ${moto.cor}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comprovantesOutrasCompras.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-text-faint uppercase tracking-wide">Comprovantes de outras compras deste cliente</p>
              <div className="space-y-2">
                {comprovantesOutrasCompras.map((c) => (
                  <div key={c.id}>
                    <ComprovanteListItem
                      comprovante={c}
                      legenda={c.venda?.nome_item}
                      podeExcluir={podeExcluirComprovante && !!c.venda_id}
                      onExcluir={() => excluirComprovanteOutraCompra(c)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
