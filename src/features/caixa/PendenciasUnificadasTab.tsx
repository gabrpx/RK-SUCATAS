import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { HandCoins, Clock, Loader2, Check, History, Undo2, Receipt, AlertTriangle, FileText, MessageCircle, Timer, Upload, X, Send } from 'lucide-react';
import { cn } from '../../utils';
import { usePermissao } from '../../hooks/usePermissao';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { MetricCard } from '../../components/ui/MetricCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { aviso } from '../../components/ui/toast';
import { Button } from '@/src/components/ui/button';
import { Select } from '@/src/components/ui/Select';
import { caixaPendenciasApi, cobrancasApi, anexarBoletoCobranca } from './api';
import { fiadoApi } from '../fiado/api';
import { vendasFiadoEmAberto } from '../fiado/metricas';
import { linkWhatsapp } from '../../utils/whatsapp';
import { formatarTamanhoArquivo } from '../comprovantes/types';
import type { CaixaPendencia, Cobranca } from './types';
import type { Venda } from '../vendas/types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

type TipoItem = 'fiado' | 'avulso';

interface ItemPendencia {
  id: string;
  tipo: TipoItem;
  descricao: string;
  clienteNome: string | null;
  clienteTelefone: string | null;
  data: string;
  saldo: number;
  diasEmAberto: number;
  venda?: Venda;
  pendencia?: CaixaPendencia;
  vendaId?: string;
  pendenciaId?: string;
}

function calcularDiasEmAberto(dataStr: string): number {
  return Math.floor((Date.now() - new Date(`${dataStr}T00:00:00`).getTime()) / 86400000);
}

function usePendenciasUnificadas() {
  const { vendas, fiadoRecebimentos, caixaPendencias, caixaPendenciaRecebimentos, loading } = useData();

  const itens = useMemo(() => {
    const resultado: ItemPendencia[] = [];

    const fiadoAberto = vendasFiadoEmAberto(vendas, fiadoRecebimentos);
    for (const { venda, saldo, diasEmAberto } of fiadoAberto) {
      resultado.push({
        id: `fiado-${venda.id}`,
        tipo: 'fiado',
        descricao: venda.nome_item,
        clienteNome: venda.cliente?.nome || venda.cliente_nome || null,
        clienteTelefone: venda.cliente?.telefone || null,
        data: venda.data,
        saldo,
        diasEmAberto,
        venda,
        vendaId: venda.id,
      });
    }

    const abertasManuais = caixaPendencias.filter((p) => p.status === 'aberta');
    for (const p of abertasManuais) {
      const recebido = caixaPendenciaRecebimentos
        .filter((r) => r.pendencia_id === p.id)
        .reduce((s, r) => s + Number(r.valor), 0);
      const saldo = Number(p.valor_total) - recebido;
      if (saldo <= 0.01) continue;
      resultado.push({
        id: `avulso-${p.id}`,
        tipo: 'avulso',
        descricao: p.descricao,
        clienteNome: p.cliente?.nome || null,
        clienteTelefone: p.cliente?.telefone || null,
        data: p.data,
        saldo,
        diasEmAberto: calcularDiasEmAberto(p.data),
        pendencia: p,
        pendenciaId: p.id,
      });
    }

    resultado.sort((a, b) => b.diasEmAberto - a.diasEmAberto);
    return resultado;
  }, [vendas, fiadoRecebimentos, caixaPendencias, caixaPendenciaRecebimentos]);

  const totais = useMemo(() => {
    const total = itens.reduce((s, i) => s + i.saldo, 0);
    const vencidos = itens.filter((i) => i.diasEmAberto >= 30);
    const totalVencido = vencidos.reduce((s, i) => s + i.saldo, 0);
    const fiado = itens.filter((i) => i.tipo === 'fiado');
    const avulso = itens.filter((i) => i.tipo === 'avulso');
    return { total, totalVencido, qtdVencidos: vencidos.length, qtdFiado: fiado.length, qtdAvulso: avulso.length, qtdTotal: itens.length };
  }, [itens]);

  return { itens, totais, loading };
}

function useCobrancas() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const res = await cobrancasApi.listar();
      if (res.success) setCobrancas(res.data);
    } catch { /* silencioso */ } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const porVenda = useMemo(() => {
    const map = new Map<string, Cobranca>();
    for (const c of cobrancas) {
      if (c.venda_id) map.set(c.venda_id, c);
    }
    return map;
  }, [cobrancas]);

  const porPendencia = useMemo(() => {
    const map = new Map<string, Cobranca>();
    for (const c of cobrancas) {
      if (c.pendencia_id) map.set(c.pendencia_id, c);
    }
    return map;
  }, [cobrancas]);

  const cobrancaDoItem = useCallback((item: ItemPendencia): Cobranca | undefined => {
    if (item.vendaId) return porVenda.get(item.vendaId);
    if (item.pendenciaId) return porPendencia.get(item.pendenciaId);
    return undefined;
  }, [porVenda, porPendencia]);

  return { cobrancas, carregando, carregar, cobrancaDoItem };
}

function HistoricoRecebimentos({
  historico,
  podeReverter,
  onReverter,
}: {
  historico: { id: string; valor: number; data: string; formaPagamento: string; usuario: string }[];
  podeReverter: boolean;
  onReverter: (id: string) => void;
}) {
  if (historico.length === 0) return null;
  return (
    <div className="text-xs text-text-faint space-y-1 border-t border-border-subtle/60 pt-2">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-text-muted">
        <History size={11} /> Recebido até agora
      </p>
      {historico.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">
            {new Date(r.data).toLocaleDateString('pt-BR')} · {r.formaPagamento} · {r.usuario}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="text-text-secondary">{formatCurrency(r.valor)}</span>
            {podeReverter && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onReverter(r.id)}
                title="Reverter este recebimento"
                className="size-5 rounded-control text-text-faint hover:text-danger"
              >
                <Undo2 size={11} />
              </Button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function PainelCobranca({ item, cobranca, onAtualizar }: { item: ItemPendencia; cobranca?: Cobranca; onAtualizar: () => void }) {
  const { pode } = usePermissao();
  const podeGerenciar = pode('caixa.gerenciar_pendencias');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [enviandoBoleto, setEnviandoBoleto] = useState(false);
  const [criandoCobranca, setCriandoCobranca] = useState(false);
  const [mostrarTimer, setMostrarTimer] = useState(false);
  const [tipoTimer, setTipoTimer] = useState<'intervalo' | 'fixo'>('intervalo');
  const [intervaloHoras, setIntervaloHoras] = useState('24');
  const [horarioFixo, setHorarioFixo] = useState('');
  const [salvandoTimer, setSalvandoTimer] = useState(false);

  if (!podeGerenciar) return null;

  const handleUploadBoleto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      aviso.atencao('Selecione um arquivo PDF');
      return;
    }

    setEnviandoBoleto(true);
    try {
      const upload = await anexarBoletoCobranca(file);
      if (!upload.success || !upload.storage_path) throw new Error(upload.error || 'Falha no upload');

      const boletoData = {
        boleto_storage_path: upload.storage_path,
        boleto_nome_arquivo: upload.nome_arquivo,
        boleto_tipo_mime: upload.tipo_mime,
        boleto_tamanho_bytes: upload.tamanho_bytes,
      };

      if (cobranca) {
        const res = await cobrancasApi.atualizar(cobranca.id, boletoData);
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await cobrancasApi.criar({
          venda_id: item.vendaId || null,
          pendencia_id: item.pendenciaId || null,
          ...boletoData,
        });
        if (!res.success) throw new Error(res.error);
      }
      onAtualizar();
      aviso.sucesso('Boleto anexado');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao anexar boleto');
    } finally {
      setEnviandoBoleto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoverBoleto = async () => {
    if (!cobranca) return;
    try {
      const res = await cobrancasApi.atualizar(cobranca.id, {
        boleto_storage_path: null,
        boleto_nome_arquivo: null,
        boleto_tipo_mime: null,
        boleto_tamanho_bytes: null,
      });
      if (!res.success) throw new Error(res.error);
      onAtualizar();
      aviso.sucesso('Boleto removido');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao remover boleto');
    }
  };

  const handleSalvarTimer = async () => {
    setSalvandoTimer(true);
    try {
      const intervaloMinutos = tipoTimer === 'intervalo' ? Math.max(5, Number(intervaloHoras) * 60) : null;
      const horarioFixoVal = tipoTimer === 'fixo' && horarioFixo ? new Date(horarioFixo).toISOString() : null;

      if (!intervaloMinutos && !horarioFixoVal) {
        aviso.atencao('Informe o intervalo ou o horário');
        return;
      }

      if (cobranca) {
        const res = await cobrancasApi.atualizar(cobranca.id, {
          intervalo_minutos: intervaloMinutos,
          horario_fixo: horarioFixoVal as any,
        });
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await cobrancasApi.criar({
          venda_id: item.vendaId || null,
          pendencia_id: item.pendenciaId || null,
          intervalo_minutos: intervaloMinutos,
          horario_fixo: horarioFixoVal as any,
        });
        if (!res.success) throw new Error(res.error);
      }
      onAtualizar();
      setMostrarTimer(false);
      aviso.sucesso('Lembrete configurado');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao configurar lembrete');
    } finally {
      setSalvandoTimer(false);
    }
  };

  const handleDesativarTimer = async () => {
    if (!cobranca) return;
    try {
      const res = await cobrancasApi.atualizar(cobranca.id, { timer_ativo: false, intervalo_minutos: null, horario_fixo: null });
      if (!res.success) throw new Error(res.error);
      onAtualizar();
      aviso.sucesso('Lembrete desativado');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao desativar lembrete');
    }
  };

  const handleCobrarWhatsApp = async () => {
    const telefone = item.clienteTelefone;
    const nome = item.clienteNome || 'Cliente';
    const msg = `Olá ${nome}! Passando para lembrar do valor pendente de ${formatCurrency(item.saldo)} referente a "${item.descricao}". Qualquer dúvida estou à disposição.`;
    const url = linkWhatsapp(telefone, msg);

    if (!url) {
      aviso.atencao('Cliente sem telefone cadastrado');
      return;
    }

    window.open(url, '_blank');

    if (!cobranca) {
      setCriandoCobranca(true);
      try {
        const res = await cobrancasApi.criar({
          venda_id: item.vendaId || null,
          pendencia_id: item.pendenciaId || null,
        });
        if (res.success) {
          await cobrancasApi.registrarEnvio(res.data.id);
        }
      } catch { /* melhor esforço */ } finally {
        setCriandoCobranca(false);
      }
    } else {
      try {
        await cobrancasApi.registrarEnvio(cobranca.id);
      } catch { /* melhor esforço */ }
    }
    onAtualizar();
  };

  const temBoleto = !!cobranca?.boleto_storage_path;
  const temTimer = cobranca?.timer_ativo;

  return (
    <div className="border-t border-border-subtle/60 pt-2.5 space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-text-muted">
        <Receipt size={11} /> Cobrança
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {temBoleto ? (
          <div className="flex items-center gap-1.5 bg-surface-inset border border-border-subtle rounded-control px-2.5 py-1.5 text-xs">
            <FileText size={13} className="text-accent shrink-0" />
            <span className="text-text-secondary truncate max-w-[150px]">{cobranca!.boleto_nome_arquivo}</span>
            {cobranca!.boleto_tamanho_bytes && (
              <span className="text-text-faint">({formatarTamanhoArquivo(cobranca!.boleto_tamanho_bytes)})</span>
            )}
            <Button variant="ghost" size="icon" onClick={handleRemoverBoleto} className="size-5 rounded-control text-text-faint hover:text-danger" title="Remover boleto">
              <X size={11} />
            </Button>
          </div>
        ) : (
          <>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleUploadBoleto} className="hidden" />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviandoBoleto}
              className="h-8 px-3 rounded-control text-xs font-medium gap-1.5"
            >
              {enviandoBoleto ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Anexar boleto
            </Button>
          </>
        )}

        {temTimer ? (
          <div className="flex items-center gap-1.5">
            <StatusBadge texto={cobranca!.intervalo_minutos ? `A cada ${Math.round(cobranca!.intervalo_minutos / 60)}h` : 'Horário fixo'} tom="accent" />
            <Button variant="ghost" size="icon" onClick={handleDesativarTimer} className="size-5 rounded-control text-text-faint hover:text-danger" title="Desativar lembrete">
              <X size={11} />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setMostrarTimer(true)}
            className="h-8 px-3 rounded-control text-xs font-medium gap-1.5"
          >
            <Timer size={13} /> Lembrete
          </Button>
        )}

        {item.clienteTelefone && (
          <Button
            variant="outline"
            onClick={handleCobrarWhatsApp}
            disabled={criandoCobranca}
            className="h-8 px-3 rounded-control text-xs font-medium gap-1.5"
          >
            {criandoCobranca ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
            WhatsApp
          </Button>
        )}

        {cobranca?.ultimo_envio_em && (
          <span className="text-[10px] text-text-faint flex items-center gap-1">
            <Send size={10} />
            Enviado {new Date(cobranca.ultimo_envio_em).toLocaleDateString('pt-BR')}
            {cobranca.enviador && ` por ${cobranca.enviador.nome_exibicao}`}
          </span>
        )}
      </div>

      {mostrarTimer && (
        <div className="bg-surface-inset border border-border-subtle rounded-control p-3 space-y-2.5">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="radio"
                name={`timer-${item.id}`}
                checked={tipoTimer === 'intervalo'}
                onChange={() => setTipoTimer('intervalo')}
                className="accent-accent"
              />
              Repetir a cada
            </label>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="radio"
                name={`timer-${item.id}`}
                checked={tipoTimer === 'fixo'}
                onChange={() => setTipoTimer('fixo')}
                className="accent-accent"
              />
              Horário fixo
            </label>
          </div>

          {tipoTimer === 'intervalo' ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={intervaloHoras}
                onChange={(e) => setIntervaloHoras(e.target.value)}
                className="w-20 border rounded-control py-1.5 px-2.5 text-xs outline-none bg-surface-card border-border-default text-text-primary focus:ring-2 focus:ring-accent/50"
              />
              <span className="text-xs text-text-secondary">hora(s)</span>
            </div>
          ) : (
            <input
              type="datetime-local"
              value={horarioFixo}
              onChange={(e) => setHorarioFixo(e.target.value)}
              className="border rounded-control py-1.5 px-2.5 text-xs outline-none bg-surface-card border-border-default text-text-primary focus:ring-2 focus:ring-accent/50"
            />
          )}

          <div className="flex items-center gap-2">
            <Button onClick={handleSalvarTimer} disabled={salvandoTimer} className="h-8 px-3 rounded-control text-xs font-semibold gap-1.5 bg-accent hover:bg-accent/90">
              {salvandoTimer ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
            </Button>
            <Button variant="ghost" onClick={() => setMostrarTimer(false)} className="h-8 px-3 rounded-control text-xs">
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const spring = { type: 'spring' as const, stiffness: 300, damping: 30 };

function statusDePendencia(diasEmAberto: number) {
  if (diasEmAberto >= 30) return { texto: `Atrasado (${diasEmAberto}d)`, tom: 'danger' as const };
  if (diasEmAberto >= 15) return { texto: `Vence em breve (${diasEmAberto}d)`, tom: 'warning' as const };
  return { texto: `Em dia (${diasEmAberto}d)`, tom: 'positive' as const };
}

export function CardPendencia({ item, cobranca, onAtualizarCobranca }: { item: ItemPendencia; cobranca?: Cobranca; onAtualizarCobranca: () => void }) {
  const { fiadoRecebimentos, caixaPendenciaRecebimentos, refreshData } = useData();
  const { formasPagamento } = useCatalogos();
  const { pode } = usePermissao();
  const podeReverterFiado = pode('caixa.receber_fiado');
  const podeReverterAvulso = pode('caixa.gerenciar_pendencias');
  const podeReverter = item.tipo === 'fiado' ? podeReverterFiado : podeReverterAvulso;

  const [valor, setValor] = useState(String(item.saldo.toFixed(2)));
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recebimentoParaReverter, setRecebimentoParaReverter] = useState<string | null>(null);
  const [revertendo, setRevertendo] = useState(false);

  const formasAvista = useMemo(() => formasPagamento.filter((f) => f.natureza !== 'fiado'), [formasPagamento]);

  const historico = useMemo(() => {
    if (item.tipo === 'fiado' && item.venda) {
      return fiadoRecebimentos
        .filter((r) => r.venda_id === item.venda!.id)
        .sort((a, b) => new Date(b.recebido_em).getTime() - new Date(a.recebido_em).getTime())
        .map((r) => ({
          id: r.id,
          valor: Number(r.valor),
          data: r.recebido_em,
          formaPagamento: r.forma_pagamento?.nome || '—',
          usuario: r.usuario?.nome_exibicao || 'Equipe',
        }));
    }
    if (item.tipo === 'avulso' && item.pendencia) {
      return caixaPendenciaRecebimentos
        .filter((r) => r.pendencia_id === item.pendencia!.id)
        .sort((a, b) => new Date(b.recebido_em).getTime() - new Date(a.recebido_em).getTime())
        .map((r) => ({
          id: r.id,
          valor: Number(r.valor),
          data: r.recebido_em,
          formaPagamento: r.forma_pagamento?.nome || '—',
          usuario: r.usuario?.nome_exibicao || 'Equipe',
        }));
    }
    return [];
  }, [item, fiadoRecebimentos, caixaPendenciaRecebimentos]);

  const confirmar = async () => {
    const numero = Number(valor.replace(',', '.'));
    if (!numero || numero <= 0) return aviso.atencao('Informe um valor válido');
    if (!formaPagamentoId) return aviso.atencao('Escolha a forma de pagamento');

    setEnviando(true);
    try {
      if (item.tipo === 'fiado' && item.venda) {
        const result = await fiadoApi.registrarRecebimento({ venda_id: item.venda.id, valor: numero, forma_pagamento_id: formaPagamentoId });
        if (!result.success) throw new Error(result.error);
      } else if (item.tipo === 'avulso' && item.pendencia) {
        const result = await caixaPendenciasApi.registrarRecebimento(item.pendencia.id, { valor: numero, forma_pagamento_id: formaPagamentoId });
        if (!result.success) throw new Error(result.error);
      }
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
      if (item.tipo === 'fiado') {
        const result = await fiadoApi.removerRecebimento(recebimentoParaReverter);
        if (!result.success) throw new Error(result.error);
      } else if (item.pendencia) {
        const result = await caixaPendenciasApi.removerRecebimento(item.pendencia.id, recebimentoParaReverter);
        if (!result.success) throw new Error(result.error);
      }
      await refreshData();
      setRecebimentoParaReverter(null);
      aviso.sucesso('Recebimento revertido');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao reverter recebimento');
    } finally {
      setRevertendo(false);
    }
  };

  const recebimentoObj = historico.find((r) => r.id === recebimentoParaReverter);

  const status = statusDePendencia(item.diasEmAberto);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="bg-surface-card border border-border-subtle rounded-card p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="shrink-0">
          <p data-pendencia-valor className="text-lg font-bold text-text-primary tabular-nums">{formatCurrency(item.saldo)}</p>
          <p className="text-[10px] text-text-faint uppercase tracking-wide mt-0.5">Em aberto</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-sm text-text-secondary truncate">{item.descricao}</p>
          <p className="text-xs text-text-faint mt-0.5">
            {item.clienteNome && <span data-pendencia-cliente className="text-text-muted">{item.clienteNome} · </span>}
            {new Date(`${item.data}T00:00:00`).toLocaleDateString('pt-BR')}
          </p>
          <span data-pendencia-status={status.tom} className="inline-block mt-1">
            <StatusBadge texto={status.texto} tom={status.tom} />
          </span>
        </div>
      </div>

      {item.clienteTelefone && (
        <div className="flex">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            onClick={() => {
              const nome = item.clienteNome || 'Cliente';
              const msg = `Olá ${nome}! Passando para lembrar do valor pendente de ${formatCurrency(item.saldo)} referente a "${item.descricao}". Qualquer dúvida estou à disposição.`;
              const url = linkWhatsapp(item.clienteTelefone, msg);
              if (url) window.open(url, '_blank');
            }}
            className="h-8 px-3 rounded-control text-xs font-medium gap-1.5 border border-positive/30 text-positive hover:bg-positive-bg inline-flex items-center"
          >
            <MessageCircle size={13} /> Cobrar via WhatsApp
          </motion.button>
        </div>
      )}

      <HistoricoRecebimentos
        historico={historico}
        podeReverter={podeReverter}
        onReverter={(id) => setRecebimentoParaReverter(id)}
      />

      <Modal
        aberto={!!recebimentoParaReverter}
        onFechar={() => setRecebimentoParaReverter(null)}
        titulo="Reverter recebimento?"
        icone={Undo2}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setRecebimentoParaReverter(null)} className="h-11 flex-1 rounded-control font-medium text-sm">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={reverterRecebimento} disabled={revertendo} className="h-11 flex-1 rounded-control font-medium text-sm">
              {revertendo ? <Loader2 size={16} className="animate-spin" /> : 'Reverter'}
            </Button>
          </div>
        }
      >
        {recebimentoObj && (
          <p className="text-sm text-text-secondary">
            O recebimento de <span className="text-text-primary font-medium">{formatCurrency(recebimentoObj.valor)}</span> via{' '}
            {recebimentoObj.formaPagamento} volta a ficar em aberto, e a entrada correspondente no Caixa é desfeita.
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
        <Select ariaLabel="Forma de pagamento" className="flex-1" size="sm" value={formaPagamentoId} onChange={setFormaPagamentoId} options={[{ value: '', label: 'Forma de pagamento...' }, ...formasAvista.map((f) => ({ value: f.id, label: f.nome }))]} />
        <Button onClick={confirmar} disabled={enviando} className="shrink-0 h-8 px-3 rounded-control bg-positive text-xs font-semibold hover:bg-positive/90">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirmar
        </Button>
      </div>

      <PainelCobranca item={item} cobranca={cobranca} onAtualizar={onAtualizarCobranca} />
    </motion.div>
  );
}

export function PendenciasUnificadasTab() {
  const { itens, totais, loading } = usePendenciasUnificadas();
  const { cobrancaDoItem, carregar: carregarCobrancas } = useCobrancas();

  return (
    <div className="space-y-5">
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-0.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
        <div className="shrink-0 w-[78%] snap-start sm:w-auto sm:shrink">
          <MetricCard
            icone={Receipt}
            label="Total em aberto"
            valor={totais.total}
            formatarValor={formatCurrency}
            contexto={`${totais.qtdTotal} pendência${totais.qtdTotal === 1 ? '' : 's'}`}
            tom="negative"
          />
        </div>
        <div className="shrink-0 w-[78%] snap-start sm:w-auto sm:shrink">
          <MetricCard
            icone={AlertTriangle}
            label="Vencido (30d+)"
            valor={totais.totalVencido}
            formatarValor={formatCurrency}
            contexto={`${totais.qtdVencidos} item(s) com 30+ dias`}
            tom={totais.qtdVencidos > 0 ? 'negative' : 'positive'}
          />
        </div>
        <div className="shrink-0 w-[78%] snap-start sm:w-auto sm:shrink">
          <MetricCard
            icone={HandCoins}
            label="Ticket médio"
            valor={totais.qtdTotal > 0 ? totais.total / totais.qtdTotal : 0}
            formatarValor={formatCurrency}
            contexto={`${totais.qtdTotal} pendência${totais.qtdTotal === 1 ? '' : 's'}`}
            tom="neutral"
          />
        </div>
      </div>

      <p className="text-xs text-text-faint bg-surface-inset border border-border-subtle rounded-control px-4 py-2.5">
        Pendência não entra no Caixa na hora — só quando um recebimento é confirmado. Pode ser parcial: cada confirmação abate o saldo em aberto.
      </p>

      {loading && itens.length === 0 ? (
        <div className="py-12 flex items-center justify-center text-text-faint">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : itens.length === 0 ? (
        <EmptyState
          icone={Receipt}
          mensagem="Nenhuma pendência em aberto."
        />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <div key={item.id}>
              <CardPendencia item={item} cobranca={cobrancaDoItem(item)} onAtualizarCobranca={carregarCobrancas} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
