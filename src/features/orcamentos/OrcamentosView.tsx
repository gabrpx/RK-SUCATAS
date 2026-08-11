// Aba Orçamentos: monta cotações pra clientes com peças do estoque (preço
// livre, independente de estoque.valor), guarda histórico, e converte em
// venda de verdade (via registrar_venda, mesma RPC da aba Vendas) — inteira
// ou só uma parte complementar de um item composto.
import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  Loader2,
  Calendar,
  Package,
  Edit2,
  AlertCircle,
  Copy,
  Check,
  MessageCircle,
  Tag,
  ShoppingCart,
  Ban,
} from 'lucide-react';
import { cn, parseLocalDate } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { aviso } from '../../components/ui/toast';
import { CustomDropdown } from '../../components/CustomDropdown';
import { Modal } from '../../components/ui/Modal';
import { orcamentosApi } from './api';
import { SeletorCliente } from '../clientes/SeletorCliente';
import { useSincronizacaoMl } from '../mercadolivre/SincronizacaoMlContext';
import type { Orcamento, OrcamentoItem, OrcamentoItemInput, DescontoTipo } from './types';
import type { Estoque } from '../estoque/types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

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

function calcularSubtotal(itens: { quantidade: number; valor_unitario: number }[]) {
  return itens.reduce((sum, i) => sum + Number(i.valor_unitario) * i.quantidade, 0);
}

function calcularDesconto(subtotal: number, tipo: DescontoTipo | null, valor: number) {
  if (tipo === 'percentual') return subtotal * ((Number(valor) || 0) / 100);
  if (tipo === 'fixo') return Number(valor) || 0;
  return 0;
}

function isExpirado(orcamento: Orcamento) {
  if (!orcamento.validade || orcamento.status !== 'aberto') return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return parseLocalDate(orcamento.validade).getTime() < hoje.getTime();
}

// Remove o nome da moto do nome da peça pra não duplicar no texto do
// orçamento (mesma lógica que já existia no antigo BudgetModal).
function nomeLimpo(nome: string, motoNome: string) {
  if (!motoNome) return nome;
  const separators = ['-', '/', '\\|', ':', '—'];
  const sepRegex = new RegExp(`\\s*(${separators.join('|')})?\\s*${motoNome}\\s*(${separators.join('|')})?\\s*`, 'gi');
  return nome
    .replace(sepRegex, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-/|:—]+|[\s\-/|:—]+$/g, '')
    .trim();
}

function montarTextoOrcamento(orcamento: Orcamento, itens: { nome_item: string; componente: string | null; quantidade: number; valor_unitario: number }[]) {
  const linhas = itens
    .map((item) => {
      const total = item.quantidade * item.valor_unitario;
      const precoDisplay = item.quantidade > 1 ? `${item.quantidade}x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(total)}` : formatCurrency(item.valor_unitario);
      const parte = item.componente ? ` (parte: ${item.componente})` : '';
      return `• ${item.nome_item}${parte} - ${precoDisplay}`;
    })
    .join('\n');

  const subtotal = calcularSubtotal(itens);
  const desconto = calcularDesconto(subtotal, orcamento.desconto_tipo, orcamento.desconto_valor);
  const total = Math.max(0, subtotal - desconto);

  const clienteLinha = `Cliente: ${orcamento.cliente_nome}${orcamento.cliente_telefone ? ' - ' + orcamento.cliente_telefone : ''}`;

  return (
    `📋 *ORÇAMENTO ${orcamento.codigo} - RK SUCATAS*\n${clienteLinha}\n\n${linhas}\n\n` +
    `--------------------------\n` +
    `Subtotal: ${formatCurrency(subtotal)}\n` +
    (desconto > 0 ? `Desconto: ${formatCurrency(desconto)}\n` : '') +
    `*TOTAL: ${formatCurrency(total)}*\n\n` +
    `_Preços sujeitos a alteração sem aviso prévio._`
  );
}

export function OrcamentosView() {
  const { orcamentos, refreshData, loading } = useData();
  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [statusFiltro, setStatusFiltro] = useState('Todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<Orcamento | null>(null);

  const filtered = useMemo(() => {
    return orcamentos
      .filter((o) => isDentroDoPeriodo(o.criado_em, periodo))
      .filter((o) => statusFiltro === 'Todos' || o.status === statusFiltro)
      .filter((o) => o.cliente_nome.toLowerCase().includes(search.toLowerCase()) || o.codigo.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => parseLocalDate(b.criado_em).getTime() - parseLocalDate(a.criado_em).getTime());
  }, [orcamentos, periodo, statusFiltro, search]);

  const totalAberto = useMemo(
    () =>
      filtered
        .filter((o) => o.status === 'aberto')
        .reduce((sum, o) => {
          const subtotal = calcularSubtotal(o.itens);
          return sum + Math.max(0, subtotal - calcularDesconto(subtotal, o.desconto_tipo, o.desconto_valor));
        }, 0),
    [filtered]
  );

  const abrirNovo = () => {
    setOrcamentoSelecionado(null);
    setModalAberto(true);
  };

  const abrirExistente = (orcamento: Orcamento) => {
    setOrcamentoSelecionado(orcamento);
    setModalAberto(true);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-2xl">
            <Receipt className="text-accent" size={28} />
          </div>
          <div>
            <h2 className={cn('text-2xl md:text-3xl font-black tracking-tight', 'text-text-primary')}>Orçamentos</h2>
            <p className="text-sm text-text-muted">
              {filtered.length} orçamentos · {formatCurrency(totalAberto)} em aberto
            </p>
          </div>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center justify-center gap-2 bg-accent hover:opacity-90 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-accent-shadow"
        >
          <Plus size={18} /> Novo Orçamento
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className={cn('flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border', 'bg-surface-inset border-border-default')}>
          <Search size={16} className="text-text-muted shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou código..." className="bg-transparent outline-none text-sm w-full" />
        </div>
        <CustomDropdown
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
          value={statusFiltro}
          onChange={setStatusFiltro}
          options={[
            { value: 'Todos', label: 'Todos status' },
            { value: 'aberto', label: 'Aberto' },
            { value: 'convertido', label: 'Convertido' },
            { value: 'cancelado', label: 'Cancelado' },
          ]}
        />
      </div>

      <div className={cn('rounded-3xl border overflow-hidden', 'bg-surface-card border-border-subtle')}>
        {loading && orcamentos.length === 0 ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-accent" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">Nenhum orçamento encontrado para este filtro.</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filtered.map((orcamento) => {
              const subtotal = calcularSubtotal(orcamento.itens);
              const total = Math.max(0, subtotal - calcularDesconto(subtotal, orcamento.desconto_tipo, orcamento.desconto_valor));
              const expirado = isExpirado(orcamento);
              return (
                <div
                  key={orcamento.id}
                  onClick={() => abrirExistente(orcamento)}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-raised transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <Receipt size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn('font-bold text-sm truncate', 'text-text-primary')}>
                        <span className="font-mono text-accent mr-1.5">{orcamento.codigo}</span>
                        {orcamento.cliente_nome}
                      </p>
                      <p className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
                        {parseLocalDate(orcamento.criado_em).toLocaleDateString('pt-BR')}
                        <span>· {orcamento.itens.length} {orcamento.itens.length === 1 ? 'item' : 'itens'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-black text-sm text-text-primary">{formatCurrency(total)}</span>
                    <span
                      className={cn(
                        'text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full',
                        expirado
                          ? 'bg-warning/10 text-warning'
                          : orcamento.status === 'aberto'
                          ? 'bg-accent/10 text-accent'
                          : orcamento.status === 'convertido'
                          ? 'bg-positive/10 text-positive'
                          : 'bg-danger/10 text-danger'
                      )}
                    >
                      {expirado ? 'Expirado' : orcamento.status === 'aberto' ? 'Aberto' : orcamento.status === 'convertido' ? 'Convertido' : 'Cancelado'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalAberto && (
        <OrcamentoFormModal
          orcamento={orcamentoSelecionado}
          onClose={() => setModalAberto(false)}
          onChanged={async () => {
            await refreshData();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Modal de criar/editar orçamento
// =============================================================================

interface RascunhoItem extends OrcamentoItemInput {
  _key: string;
}

function OrcamentoFormModal({ orcamento, onClose, onChanged }: { orcamento: Orcamento | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const { estoque } = useData();
  const [atual, setAtual] = useState<Orcamento | null>(orcamento);
  const isEdicao = !!atual;

  const [clienteNome, setClienteNome] = useState(atual?.cliente_nome || '');
  const [clienteId, setClienteId] = useState<string | null>(atual?.cliente_id || null);
  const [clienteTelefone, setClienteTelefone] = useState(atual?.cliente_telefone || '');
  const [descontoTipo, setDescontoTipo] = useState<DescontoTipo>(atual?.desconto_tipo || 'fixo');
  const [descontoValor, setDescontoValor] = useState(atual?.desconto_valor || 0);
  const [observacoes, setObservacoes] = useState(atual?.observacoes || '');
  const [validade, setValidade] = useState(atual?.validade || '');

  const [rascunho, setRascunho] = useState<RascunhoItem[]>([]);
  const [busca, setBusca] = useState('');
  const [itemPendente, setItemPendente] = useState<Estoque | null>(null);
  const [componentePendente, setComponentePendente] = useState<string | null>(null);
  const [qtdPendente, setQtdPendente] = useState('1');
  const [valorPendente, setValorPendente] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [vendaAlvo, setVendaAlvo] = useState<{ tipo: 'item' | 'tudo'; item?: OrcamentoItem } | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  const itens: OrcamentoItem[] = atual?.itens || [];

  const resultadosBusca = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.toLowerCase();
    return (estoque || [])
      .filter((e) => e.quantidade > 0)
      .filter((e) => e.nome.toLowerCase().includes(termo) || e.codigo?.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [busca, estoque]);

  const selecionarItemPendente = (item: Estoque) => {
    setItemPendente(item);
    setComponentePendente(null);
    setQtdPendente('1');
    setValorPendente(String(item.valor));
    setBusca('');
  };

  const selecionarComponentePendente = (nome: string | null) => {
    setComponentePendente(nome);
    setQtdPendente('1');
    setValorPendente(nome ? '' : String(itemPendente?.valor ?? 0));
  };

  const cancelarPendente = () => {
    setItemPendente(null);
    setComponentePendente(null);
    setQtdPendente('1');
    setValorPendente('');
  };

  const confirmarAdicionarItem = async () => {
    if (!itemPendente) return;
    const qtd = Number(qtdPendente) || 1;
    const valor = Number(valorPendente) || 0;
    const novoItem: OrcamentoItemInput = {
      estoque_id: itemPendente.id,
      nome_item: itemPendente.nome,
      componentes_disponiveis: itemPendente.componentes || null,
      componente: componentePendente,
      quantidade: qtd,
      valor_unitario: valor,
    };

    if (isEdicao && atual) {
      setSalvando(true);
      try {
        const result = await orcamentosApi.adicionarItem(atual.id, novoItem);
        if (!result.success) throw new Error(result.error);
        setAtual(result.data);
      } catch (err: any) {
        aviso.falha(err, 'Erro ao adicionar item');
      } finally {
        setSalvando(false);
      }
    } else {
      setRascunho((prev) => [...prev, { ...novoItem, _key: `${Date.now()}-${Math.random()}` }]);
    }

    cancelarPendente();
  };

  const removerRascunho = (key: string) => setRascunho((prev) => prev.filter((r) => r._key !== key));

  const removerItemPersistido = async (item: OrcamentoItem) => {
    if (!atual) return;
    setSalvando(true);
    try {
      const result = await orcamentosApi.removerItem(atual.id, item.id);
      if (!result.success) throw new Error(result.error);
      setAtual(result.data);
    } catch (err: any) {
      aviso.falha(err, 'Erro ao remover item');
    } finally {
      setSalvando(false);
    }
  };

  const atualizarValorItemPersistido = async (item: OrcamentoItem, valor: number) => {
    if (!atual) return;
    try {
      const result = await orcamentosApi.atualizarItem(atual.id, item.id, { valor_unitario: valor });
      if (!result.success) throw new Error(result.error);
      setAtual(result.data);
    } catch (err: any) {
      aviso.falha(err, 'Erro ao atualizar item');
    }
  };

  const atualizarQtdItemPersistido = async (item: OrcamentoItem, delta: number) => {
    if (!atual) return;
    const nova = Math.max(1, item.quantidade + delta);
    try {
      const result = await orcamentosApi.atualizarItem(atual.id, item.id, { quantidade: nova });
      if (!result.success) throw new Error(result.error);
      setAtual(result.data);
    } catch (err: any) {
      aviso.falha(err, 'Erro ao atualizar item');
    }
  };

  const itensParaTexto = isEdicao ? itens.map((i) => ({ nome_item: i.nome_item, componente: i.componente, quantidade: i.quantidade, valor_unitario: i.valor_unitario })) : rascunho;

  const subtotal = calcularSubtotal(isEdicao ? itens : rascunho);
  const desconto = calcularDesconto(subtotal, descontoTipo, descontoValor);
  const total = Math.max(0, subtotal - desconto);

  const salvarHeader = async () => {
    if (!clienteNome.trim()) return aviso.atencao('Nome do cliente é obrigatório');

    if (isEdicao && atual) {
      setSalvando(true);
      try {
        const result = await orcamentosApi.atualizar(atual.id, {
          cliente_nome: clienteNome,
          cliente_id: clienteId,
          cliente_telefone: clienteTelefone || null,
          desconto_tipo: descontoTipo,
          desconto_valor: Number(descontoValor) || 0,
          observacoes: observacoes || null,
          validade: validade || null,
        });
        if (!result.success) throw new Error(result.error);
        setAtual(result.data);
        await onChanged();
      } catch (err: any) {
        aviso.falha(err, 'Erro ao salvar orçamento');
      } finally {
        setSalvando(false);
      }
    } else {
      if (rascunho.length === 0) return aviso.atencao('Adicione ao menos um item ao orçamento');
      setSalvando(true);
      try {
        const result = await orcamentosApi.criar({
          cliente_nome: clienteNome,
          cliente_id: clienteId,
          cliente_telefone: clienteTelefone || null,
          desconto_tipo: descontoTipo,
          desconto_valor: Number(descontoValor) || 0,
          observacoes: observacoes || null,
          validade: validade || null,
          itens: rascunho.map(({ _key, ...rest }) => rest),
        });
        if (!result.success) throw new Error(result.error);
        setAtual(result.data);
        setRascunho([]);
        await onChanged();
      } catch (err: any) {
        aviso.falha(err, 'Erro ao criar orçamento');
      } finally {
        setSalvando(false);
      }
    }
  };

  const cancelarOrcamento = async () => {
    if (!atual) return;
    setSalvando(true);
    try {
      const result = await orcamentosApi.cancelar(atual.id);
      if (!result.success) throw new Error(result.error);
      setAtual(result.data);
      setConfirmandoCancelamento(false);
      await onChanged();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao cancelar orçamento');
    } finally {
      setSalvando(false);
    }
  };

  const copiarTexto = () => {
    if (!atual) return;
    const texto = montarTextoOrcamento(atual, itensParaTexto);
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const abrirWhatsapp = () => {
    if (!atual || !atual.cliente_telefone) return;
    const texto = montarTextoOrcamento(atual, itensParaTexto);
    const numero = atual.cliente_telefone.replace(/\D/g, '');
    const numeroComPais = numero.startsWith('55') ? numero : `55${numero}`;
    window.open(`https://wa.me/${numeroComPais}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const inputClass = cn(
    'w-full border rounded-xl py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50',
    'bg-surface-inset border-border-default text-text-primary'
  );
  const labelClass = cn('text-xs font-bold uppercase tracking-wider mb-1.5 block', 'text-text-muted');

  const pendenteHaItensAVender = isEdicao && atual!.status === 'aberto' && itens.some((i) => !i.venda_id);
  const expirado = atual ? isExpirado(atual) : false;

  return (
    <>
      <Modal
        aberto={true}
        onFechar={onClose}
        titulo={atual ? atual.codigo : 'Novo Orçamento'}
        icone={Receipt}
        tamanho="lg"
        rodape={
          (!isEdicao || atual!.status === 'aberto') && (
            <button
              onClick={salvarHeader}
              disabled={salvando}
              className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-accent-shadow flex items-center justify-center gap-2"
            >
              {salvando ? <Loader2 size={18} className="animate-spin" /> : isEdicao ? 'Salvar alterações' : 'Criar orçamento'}
            </button>
          )
        }
      >
        <div className="space-y-4">
          {atual && (expirado || atual.status !== 'aberto') && (
            <div className="flex items-center gap-2 -mt-1">
              {expirado ? (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-warning/10 text-warning">Expirado</span>
              ) : (
                <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full', atual.status === 'convertido' ? 'bg-positive/10 text-positive' : 'bg-danger/10 text-danger')}>
                  {atual.status === 'convertido' ? 'Convertido' : 'Cancelado'}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nome do cliente</label>
              <SeletorCliente
                clienteId={clienteId}
                nome={clienteNome}
                onChange={(id, nome) => {
                  setClienteId(id);
                  setClienteNome(nome);
                }}
                disabled={isEdicao && atual!.status !== 'aberto'}
                placeholder="Nome"
              />
            </div>
            <div>
              <label className={labelClass}>Telefone (opcional)</label>
              <input
                value={clienteTelefone || ''}
                onChange={(e) => setClienteTelefone(e.target.value)}
                disabled={isEdicao && atual!.status !== 'aberto'}
                placeholder="(00) 00000-0000"
                className={inputClass}
              />
            </div>
          </div>

          {/* Busca / adicionar item */}
          {(!isEdicao || atual!.status === 'aberto') && (
            <div>
              <label className={labelClass}>Adicionar peça do estoque</label>
              {!itemPendente ? (
                <>
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou código..." className={inputClass} />
                  {resultadosBusca.length > 0 && (
                    <div className={cn('mt-2 rounded-xl border divide-y overflow-hidden', 'border-border-default divide-border-default')}>
                      {resultadosBusca.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selecionarItemPendente(item)}
                          className={cn('w-full text-left px-4 py-3 flex items-center justify-between gap-3 text-sm transition-colors', 'hover:bg-surface-raised')}
                        >
                          <div className="min-w-0">
                            <p className="font-bold truncate">{item.nome}</p>
                            <p className="text-xs text-text-muted">
                              {item.codigo} · {item.quantidade} em estoque
                            </p>
                          </div>
                          <span className="font-bold text-text-primary shrink-0">{formatCurrency(item.valor)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className={cn('rounded-xl border p-4 space-y-3', 'border-accent/30 bg-accent/5')}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{itemPendente.nome}</p>
                      <p className="text-xs text-text-muted">{itemPendente.codigo}</p>
                    </div>
                    <button onClick={cancelarPendente} className="p-1.5 rounded-lg text-text-muted hover:bg-surface-raised shrink-0">
                      <X size={14} />
                    </button>
                  </div>

                  {itemPendente.componentes && itemPendente.componentes.length > 0 && (
                    <div>
                      <p className={labelClass}>Cotar como</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => selecionarComponentePendente(null)}
                          className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', !componentePendente ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
                        >
                          Item completo
                        </button>
                        {itemPendente.componentes.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => selecionarComponentePendente(c)}
                            className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', componentePendente === c ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
                          >
                            Só: {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        disabled={!!componentePendente}
                        value={qtdPendente}
                        onChange={(e) => setQtdPendente(e.target.value)}
                        className={cn(inputClass, componentePendente && 'opacity-50')}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Valor unitário (R$)</label>
                      <input type="number" min="0" step="0.01" value={valorPendente} onChange={(e) => setValorPendente(e.target.value)} className={inputClass} />
                    </div>
                  </div>

                  <button
                    onClick={confirmarAdicionarItem}
                    disabled={salvando}
                    className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl font-black text-xs uppercase tracking-widest"
                  >
                    Adicionar ao orçamento
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lista de itens */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <label className={cn(labelClass, 'mb-0')}>Peças no orçamento</label>
              {(isEdicao ? itens.length : rascunho.length) > 0 && (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-accent/10 text-accent rounded-full">{isEdicao ? itens.length : rascunho.length} itens</span>
              )}
            </div>

            {(isEdicao ? itens.length : rascunho.length) === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-muted border-2 border-dashed border-border-default/30 rounded-2xl">
                <ShoppingCart className="mb-2 opacity-10" size={28} />
                <p className="text-[10px]">Nenhuma peça adicionada</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {!isEdicao &&
                  rascunho.map((item) => (
                    <div key={item._key} className={cn('p-3 rounded-xl border flex items-center justify-between gap-3', 'bg-surface-card/40 border-border-default/60')}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">
                          {item.nome_item}
                          {item.componente && <span className="text-accent-soft-fg"> · Só: {item.componente}</span>}
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {item.quantidade}x {formatCurrency(item.valor_unitario)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-xs text-text-primary">{formatCurrency(item.quantidade * item.valor_unitario)}</span>
                        <button onClick={() => removerRascunho(item._key)} className="p-1.5 text-danger hover:bg-danger-bg rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                {isEdicao &&
                  itens.map((item) => (
                    <Fragment key={item.id}>
                      <ItemPersistidoRow
                        item={item}
                        podeEditar={atual!.status === 'aberto' && !item.venda_id}
                        podeVender={atual!.status === 'aberto' && !item.venda_id}
                        onRemover={() => removerItemPersistido(item)}
                        onAlterarValor={(v) => atualizarValorItemPersistido(item, v)}
                        onAlterarQtd={(d) => atualizarQtdItemPersistido(item, d)}
                        onVender={() => setVendaAlvo({ tipo: 'item', item })}
                      />
                    </Fragment>
                  ))}
              </div>
            )}
          </div>

          {/* Desconto */}
          <div>
            <label className={labelClass}>Desconto</label>
            <div className="flex items-center gap-2">
              <div className={cn('flex p-1 rounded-xl border', 'bg-surface-inset border-border-default')}>
                <button
                  type="button"
                  disabled={isEdicao && atual!.status !== 'aberto'}
                  onClick={() => setDescontoTipo('fixo')}
                  className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black transition-all', descontoTipo === 'fixo' ? 'bg-accent text-white' : 'text-text-muted')}
                >
                  R$
                </button>
                <button
                  type="button"
                  disabled={isEdicao && atual!.status !== 'aberto'}
                  onClick={() => setDescontoTipo('percentual')}
                  className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black transition-all', descontoTipo === 'percentual' ? 'bg-accent text-white' : 'text-text-muted')}
                >
                  %
                </button>
              </div>
              <input
                type="number"
                min="0"
                disabled={isEdicao && atual!.status !== 'aberto'}
                value={descontoValor || ''}
                onChange={(e) => setDescontoValor(Number(e.target.value))}
                placeholder="0.00"
                className={cn(inputClass, 'flex-1')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Validade (opcional)</label>
              <input type="date" disabled={isEdicao && atual!.status !== 'aberto'} value={validade || ''} onChange={(e) => setValidade(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Observações</label>
              <input disabled={isEdicao && atual!.status !== 'aberto'} value={observacoes || ''} onChange={(e) => setObservacoes(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className={cn('flex items-center justify-between p-4 rounded-xl', 'bg-surface-card')}>
            <span className="text-xs font-bold uppercase text-text-muted">Total</span>
            <span className="text-xl font-black text-text-primary">{formatCurrency(total)}</span>
          </div>

          {isEdicao && (
            <>
              {pendenteHaItensAVender && (
                <button
                  onClick={() => setVendaAlvo({ tipo: 'tudo' })}
                  className="w-full bg-accent hover:opacity-90 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-accent-shadow flex items-center justify-center gap-2"
                >
                  <Check size={16} /> Vender tudo
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={copiarTexto}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all',
                    copiado ? 'bg-positive text-white' : 'bg-surface-card text-text-secondary hover:bg-surface-raised'
                  )}
                >
                  {copiado ? <Check size={15} /> : <Copy size={15} />}
                  {copiado ? 'Copiado!' : 'Copiar orçamento'}
                </button>
                <button
                  onClick={abrirWhatsapp}
                  disabled={!atual!.cliente_telefone}
                  title={!atual!.cliente_telefone ? 'Cadastre um telefone pra habilitar' : ''}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40"
                >
                  <MessageCircle size={15} /> Abrir WhatsApp
                </button>
              </div>

              {atual!.status === 'aberto' && (
                <button
                  onClick={() => setConfirmandoCancelamento(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest text-danger hover:bg-danger-bg"
                >
                  <Ban size={14} /> Cancelar orçamento
                </button>
              )}
            </>
          )}
        </div>
      </Modal>

      {vendaAlvo && atual && (
        <VenderModal
          orcamento={atual}
          alvo={vendaAlvo}
          onClose={() => setVendaAlvo(null)}
          onVendido={async (novoOrcamento) => {
            setAtual(novoOrcamento);
            setVendaAlvo(null);
            await onChanged();
          }}
        />
      )}

      <Modal
        aberto={confirmandoCancelamento}
        onFechar={() => setConfirmandoCancelamento(false)}
        titulo="Cancelar este orçamento?"
        icone={AlertCircle}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <button onClick={() => setConfirmandoCancelamento(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-surface-card text-text-secondary">
              Voltar
            </button>
            <button onClick={cancelarOrcamento} disabled={salvando} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-danger text-surface-page hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : 'Cancelar orçamento'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">Itens ainda não vendidos deixam de poder ser convertidos. Vendas já realizadas não são afetadas.</p>
      </Modal>
    </>
  );
}

function ItemPersistidoRow({
  item,
  podeEditar,
  podeVender,
  onRemover,
  onAlterarValor,
  onAlterarQtd,
  onVender,
}: {
  item: OrcamentoItem;
  podeEditar: boolean;
  podeVender: boolean;
  onRemover: () => void;
  onAlterarValor: (valor: number) => void;
  onAlterarQtd: (delta: number) => void;
  onVender: () => void;
}) {
  const [editandoValor, setEditandoValor] = useState(false);
  const [valorDraft, setValorDraft] = useState(String(item.valor_unitario));

  const confirmarValor = () => {
    setEditandoValor(false);
    const novo = Number(valorDraft);
    if (!isNaN(novo) && novo !== item.valor_unitario) onAlterarValor(novo);
  };

  return (
    <div className={cn('p-3 rounded-xl border', 'bg-surface-card/40 border-border-default/60')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold truncate flex items-center gap-2">
            {item.nome_item}
            {item.componente && <span className="text-accent-soft-fg font-normal">· Só: {item.componente}</span>}
            {item.venda_id && <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-positive/10 text-positive">Vendido</span>}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {podeEditar ? (
              <div className={cn('flex items-center gap-1 rounded-lg p-0.5 border', 'bg-surface-inset border-border-default')}>
                <button onClick={() => onAlterarQtd(-1)} className="p-1 rounded-md hover:bg-surface-raised">
                  <Minus size={10} />
                </button>
                <span className="text-[10px] font-black w-4 text-center">{item.quantidade}</span>
                <button onClick={() => onAlterarQtd(1)} className="p-1 rounded-md hover:bg-surface-raised">
                  <Plus size={10} />
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-text-muted">{item.quantidade}x</span>
            )}
            {editandoValor ? (
              <input
                autoFocus
                type="number"
                step="0.01"
                value={valorDraft}
                onChange={(e) => setValorDraft(e.target.value)}
                onBlur={confirmarValor}
                onKeyDown={(e) => e.key === 'Enter' && confirmarValor()}
                className="w-24 text-[11px] px-2 py-1 rounded-md border bg-transparent"
              />
            ) : (
              <button disabled={!podeEditar} onClick={() => podeEditar && setEditandoValor(true)} className="text-[10px] text-text-muted flex items-center gap-1 disabled:cursor-default">
                {formatCurrency(item.valor_unitario)} {podeEditar && <Edit2 size={9} />}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-black text-xs text-text-primary">{formatCurrency(item.quantidade * item.valor_unitario)}</span>
          {podeVender && (
            <button onClick={onVender} className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-accent text-white hover:opacity-90">
              Vender
            </button>
          )}
          {podeEditar && (
            <button onClick={onRemover} className="p-1.5 text-danger hover:bg-danger-bg rounded-lg transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Modal de confirmação de venda (item único ou "vender tudo")
// =============================================================================

function VenderModal({
  orcamento,
  alvo,
  onClose,
  onVendido,
}: {
  orcamento: Orcamento;
  alvo: { tipo: 'item' | 'tudo'; item?: OrcamentoItem };
  onClose: () => void;
  onVendido: (orcamento: Orcamento) => void;
}) {
  const { formasPagamento } = useCatalogos();
  const { estoque } = useData();
  const { abrir: abrirSincronizacao } = useSincronizacaoMl();
  const item = alvo.item;
  // Se a linha já foi cotada como uma parte específica, isso é fixo — só
  // deixa escolher inteiro-vs-parte quando o item tem componentes E ainda
  // não foi decidido na hora de montar o orçamento.
  const podeEscolherComponente = alvo.tipo === 'item' && !!item && !item.componente && !!item.componentes_disponiveis && item.componentes_disponiveis.length > 0;
  const [componenteEscolhido, setComponenteEscolhido] = useState<string | null>(null);
  const [formaPagamentoId, setFormaPagamentoId] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);

  // Avisa quando algum item recém-vendido tem anúncio vinculado — sincronizar
  // é sempre um clique à parte, nunca automático (decisão explícita do dono
  // da loja: nada muda no Mercado Livre sem confirmação manual).
  const avisarSincronizacao = (estoqueIds: string[]) => {
    const idsComAnuncio = estoqueIds.filter((id) => (estoque.find((e) => e.id === id)?.links_ml?.length ?? 0) > 0);
    if (idsComAnuncio.length === 0) return;
    aviso.info(idsComAnuncio.length === 1 ? 'Este item tem anúncio no Mercado Livre' : `${idsComAnuncio.length} itens vendidos têm anúncio no Mercado Livre`, {
      descricao: 'Sincronize pra atualizar preço e quantidade por lá também.',
      acao: { label: 'Sincronizar agora', onClick: () => abrirSincronizacao(idsComAnuncio) },
    });
  };

  const confirmar = async () => {
    if (!formaPagamentoId) return aviso.atencao('Selecione a forma de pagamento');
    setEnviando(true);
    try {
      if (alvo.tipo === 'item' && item) {
        const result = await orcamentosApi.venderItem(orcamento.id, item.id, { forma_pagamento_id: formaPagamentoId, componente: componenteEscolhido, data });
        if (!result.success) throw new Error(result.error);
        onVendido(result.data.orcamento);
        avisarSincronizacao(item.estoque_id ? [item.estoque_id] : []);
      } else {
        const result = await orcamentosApi.venderTudo(orcamento.id, { forma_pagamento_id: formaPagamentoId, data });
        if (!result.success) throw new Error(result.error);
        if (result.data.falhas.length > 0) {
          // Venda parcial: o que passou já entrou, então não é erro puro —
          // avisa o que ficou de fora pra poder resolver item a item.
          aviso.atencao(`${result.data.sucesso.length} venda(s) registrada(s), ${result.data.falhas.length} não`, {
            descricao: result.data.falhas.map((f) => f.error).join(' · '),
            duracao: 10000,
          });
        } else {
          aviso.sucesso(`${result.data.sucesso.length} venda(s) registrada(s)`);
        }
        onVendido(result.data.orcamento);
        const estoqueIdsVendidos = orcamento.itens.filter((i) => result.data.sucesso.includes(i.id) && i.estoque_id).map((i) => i.estoque_id as string);
        avisarSincronizacao(estoqueIdsVendidos);
      }
    } catch (err: any) {
      aviso.falha(err, 'Erro ao registrar venda');
    } finally {
      setEnviando(false);
    }
  };

  const inputClass = cn(
    'w-full border rounded-xl py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50',
    'bg-surface-inset border-border-default text-text-primary'
  );
  const labelClass = cn('text-xs font-bold uppercase tracking-wider mb-1.5 block', 'text-text-muted');

  return (
    <Modal
      aberto={true}
      onFechar={onClose}
      titulo={alvo.tipo === 'tudo' ? 'Vender tudo' : `Vender: ${item?.nome_item}`}
      tamanho="sm"
      rodape={
        <button
          onClick={confirmar}
          disabled={enviando || !formaPagamentoId}
          className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
        >
          {enviando ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar venda'}
        </button>
      }
    >
      <div className="space-y-4">
        {podeEscolherComponente && (
          <div>
            <label className={labelClass}>O que está sendo vendido?</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setComponenteEscolhido(null)}
                className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', !componenteEscolhido ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
              >
                Item completo
              </button>
              {item!.componentes_disponiveis!.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setComponenteEscolhido(c)}
                  className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all', componenteEscolhido === c ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
                >
                  Só: {c}
                </button>
              ))}
            </div>
            {componenteEscolhido && <p className="text-xs text-warning mt-2">Vai vender só "{componenteEscolhido}" — o item fica incompleto no estoque até o resto ser vendido também.</p>}
          </div>
        )}

        <div>
          <label className={labelClass}>Forma de pagamento</label>
          <CustomDropdown variant="form" value={formaPagamentoId} onChange={setFormaPagamentoId} placeholder="Selecione..." options={formasPagamento.map((p) => ({ value: p.id, label: p.nome }))} />
        </div>

        <div>
          <label className={labelClass}>Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
        </div>
      </div>
    </Modal>
  );
}
