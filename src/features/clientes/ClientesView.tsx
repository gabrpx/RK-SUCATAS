// Aba Clientes: cadastro, histórico de compras (via vendas/orçamentos
// vinculados por cliente_id), segmentação RFM, timeline de notas de
// atendimento, tarefas/visitas vinculadas e desativação (soft delete — nunca
// some do histórico de quem já comprou).
import { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Search, Loader2, RotateCcw, Ban, StickyNote, Trash2, Send, ShoppingBag, Receipt, ClipboardList, Download, MapPin, Clock, UserX, Bike, PackageSearch, X } from 'lucide-react';
import { cn } from '../../utils';
import { formatTelefoneBR, formatDocumentoBR, onlyDigits } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AlertBar } from '../../components/ui/AlertBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { useCatalogos } from '../../hooks/useCatalogos';
import { getAncestorChain as getAncestorChainMoto } from '../motos/motoTree';
import { getAncestorChain as getAncestorChainCategoria } from '../categorias/categoriaTree';
import { clientesApi } from './api';
import {
  calcularHistoricoCliente,
  calcularSegmento,
  SEGMENTO_LABELS,
  SEGMENTO_TONS,
  badgesMotoProcurada,
  motosDistintasProcuradas,
  motosDistintasDeClientes,
  type SegmentoCliente,
} from './metricas';
import { preferenciasClientes, type OrdenacaoClientes } from './preferencias';
import { gerarCsvHistoricoCliente, baixarCsv } from './exportarHistoricoCsv';
import { useTarefas } from '../tarefas/useTarefas';
import { comprovantesApi } from '../comprovantes/api';
import { ComprovanteListItem } from '../comprovantes/ComprovantesPixVenda';
import type { Cliente, ClienteInput, ClienteNota, ClienteOrigem, PreferenciaContato, ClienteMotoInput, PecaProcuradaInput, PecaProcuradaStatus } from './types';
import type { Role } from '../../constants/roles';

const ORDENACAO_LABELS: Record<OrdenacaoClientes, string> = {
  recentes: 'Mais recentes',
  nome: 'Nome (A-Z)',
  maior_gasto: 'Quem mais gastou',
  mais_compras: 'Mais compras',
  ultima_compra: 'Última compra recente',
};

const STATUS_FILTRO_LABELS: Record<'ativos' | 'inativos' | 'todos', string> = {
  ativos: 'Ativos',
  inativos: 'Inativos',
  todos: 'Todos',
};

const PECA_STATUS_LABELS: Record<PecaProcuradaStatus, string> = { aguardando: 'Aguardando', atendida: 'Atendida', cancelada: 'Cancelada' };
const PECA_STATUS_TONS: Record<PecaProcuradaStatus, 'warning' | 'positive' | 'neutral'> = { aguardando: 'warning', atendida: 'positive', cancelada: 'neutral' };

const EMPTY_MOTO: ClienteMotoInput = { modelo_moto_id: null, placa: '', chassi: '', ano: '', cor: '', observacoes: '' };
const EMPTY_PECA: PecaProcuradaInput = { descricao: '', categoria_id: null, modelo_moto_id: null };

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

const EMPTY_FORM: ClienteInput = {
  nome: '',
  telefone: '',
  documento: '',
  data_nascimento: '',
  origem: null,
  preferencia_contato: null,
  tags: [],
  observacoes: '',
};

const ORIGEM_LABELS: Record<ClienteOrigem, string> = {
  balcao: 'Passou na loja',
  indicacao: 'Indicação',
  mercado_livre: 'Mercado Livre',
  redes_sociais: 'Redes sociais',
  outro: 'Outro',
};

const CONTATO_LABELS: Record<PreferenciaContato, string> = {
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  sms: 'SMS',
  nenhuma: 'Nenhuma',
};

function tagsParaTexto(tags: string[]) {
  return tags.join(', ');
}

function textoParaTags(texto: string): string[] {
  return Array.from(new Set(texto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)));
}

export function ClientesView({
  pendingClienteId,
  setPendingClienteId,
  pendingFiltroSumidos,
  setPendingFiltroSumidos,
  userRoles = [],
}: {
  pendingClienteId?: string | null;
  setPendingClienteId?: (id: string | null) => void;
  pendingFiltroSumidos?: boolean;
  setPendingFiltroSumidos?: (v: boolean) => void;
  userRoles?: Role[];
}) {
  const podeExcluirComprovante = userRoles.includes('admin');
  const { clientes, vendas, orcamentos, pecasProcuradas, setPecasProcuradas, motosClientes, refreshData, loading } = useData();
  const { tarefas } = useTarefas();
  const { modelos, categorias } = useCatalogos();
  const [busca, setBusca] = useState('');
  const [tagFiltro, setTagFiltro] = useState<string | null>(null);
  const [motoProcuradaFiltro, setMotoProcuradaFiltro] = useState<string | null>(null);
  const [motoClienteFiltro, setMotoClienteFiltro] = useState<string | null>(null);
  const [segmentoFiltro, setSegmentoFiltro] = useState<SegmentoCliente | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<'ativos' | 'inativos' | 'todos'>('ativos');
  const [ordenacao, setOrdenacaoState] = useState<OrdenacaoClientes>(() => preferenciasClientes.lerOrdenacaoPadrao());

  // Salva automaticamente como padrão a cada troca — não tem botão "definir
  // como padrão" separado, ver src/features/clientes/preferencias.ts.
  const setOrdenacao = (valor: OrdenacaoClientes) => {
    setOrdenacaoState(valor);
    preferenciasClientes.salvarOrdenacaoPadrao(valor);
  };

  const motosProcuradasOpcoes = useMemo(() => motosDistintasProcuradas(pecasProcuradas), [pecasProcuradas]);
  const motosClientesOpcoes = useMemo(() => motosDistintasDeClientes(motosClientes), [motosClientes]);
  const motoIdsPorCliente = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const m of motosClientes) {
      if (!m.modelo_moto_id) continue;
      if (!mapa.has(m.cliente_id)) mapa.set(m.cliente_id, new Set());
      mapa.get(m.cliente_id)!.add(m.modelo_moto_id);
    }
    return mapa;
  }, [motosClientes]);
  const badgesPorCliente = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof badgesMotoProcurada>>();
    for (const c of clientes) mapa.set(c.id, badgesMotoProcurada(c.id, pecasProcuradas));
    return mapa;
  }, [clientes, pecasProcuradas]);

  // Um cálculo por cliente visível — o histórico nunca é persistido, é
  // sempre derivado de vendas/orçamentos já carregados (ver metricas.ts).
  const historicoPorCliente = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof calcularHistoricoCliente>>();
    for (const c of clientes) mapa.set(c.id, calcularHistoricoCliente(c.id, vendas, orcamentos));
    return mapa;
  }, [clientes, vendas, orcamentos]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteInput>(EMPTY_FORM);
  const [tagsTexto, setTagsTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [clienteAberto, setClienteAberto] = useState<Cliente | null>(null);
  const [novaNota, setNovaNota] = useState('');
  const [enviandoNota, setEnviandoNota] = useState(false);

  const todasTags = useMemo(() => Array.from(new Set(clientes.flatMap((c) => c.tags))).sort(), [clientes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const resultado = clientes.filter((c) => {
      if (statusFiltro === 'ativos' && !c.ativo) return false;
      if (statusFiltro === 'inativos' && c.ativo) return false;
      if (segmentoFiltro && calcularSegmento(historicoPorCliente.get(c.id)!) !== segmentoFiltro) return false;
      if (tagFiltro && !c.tags.includes(tagFiltro)) return false;
      if (motoProcuradaFiltro && !(badgesPorCliente.get(c.id) || []).some((b) => b.modeloMotoId === motoProcuradaFiltro)) return false;
      if (motoClienteFiltro && !(motoIdsPorCliente.get(c.id) || new Set()).has(motoClienteFiltro)) return false;
      if (!termo) return true;
      const digitosTermo = onlyDigits(termo);
      const matchDigitos = digitosTermo.length > 0 && (onlyDigits(c.telefone || '').includes(digitosTermo) || onlyDigits(c.documento || '').includes(digitosTermo));
      return c.nome.toLowerCase().includes(termo) || matchDigitos;
    });

    const historicoDe = (id: string) => historicoPorCliente.get(id)!;
    resultado.sort((a, b) => {
      switch (ordenacao) {
        case 'nome':
          return a.nome.localeCompare(b.nome, 'pt');
        case 'maior_gasto':
          return historicoDe(b.id).totalGasto - historicoDe(a.id).totalGasto;
        case 'mais_compras':
          return historicoDe(b.id).quantidadeCompras - historicoDe(a.id).quantidadeCompras;
        case 'ultima_compra': {
          const diasA = historicoDe(a.id).diasDesdeUltimaCompra;
          const diasB = historicoDe(b.id).diasDesdeUltimaCompra;
          if (diasA === null && diasB === null) return 0;
          if (diasA === null) return 1;
          if (diasB === null) return -1;
          return diasA - diasB;
        }
        case 'recentes':
        default:
          return b.criado_em.localeCompare(a.criado_em);
      }
    });
    return resultado;
  }, [clientes, busca, tagFiltro, motoProcuradaFiltro, motoClienteFiltro, segmentoFiltro, statusFiltro, ordenacao, historicoPorCliente, badgesPorCliente, motoIdsPorCliente]);

  const filtrosAtivos = !!(busca.trim() || tagFiltro || motoProcuradaFiltro || motoClienteFiltro || segmentoFiltro || statusFiltro !== 'ativos');
  const limparFiltros = () => {
    setBusca('');
    setTagFiltro(null);
    setMotoProcuradaFiltro(null);
    setMotoClienteFiltro(null);
    setSegmentoFiltro(null);
    setStatusFiltro('ativos');
  };

  // Deep-link vindo do alerta de "cliente sumido" no dashboard.
  useEffect(() => {
    if (!pendingFiltroSumidos) return;
    setSegmentoFiltro('sumido');
    setPendingFiltroSumidos?.(false);
  }, [pendingFiltroSumidos, setPendingFiltroSumidos]);

  // Deep-link vindo de outra aba (ex: dashboard) — abre a ficha direto.
  useEffect(() => {
    if (!pendingClienteId) return;
    const cliente = clientes.find((c) => c.id === pendingClienteId);
    if (cliente) abrirFicha(cliente);
    setPendingClienteId?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClienteId, clientes]);

  const abrirCriar = () => {
    setEditando(null);
    setForm(EMPTY_FORM);
    setTagsTexto('');
    setErroForm(null);
    setIsFormOpen(true);
  };

  const abrirEditar = (cliente: Cliente) => {
    setEditando(cliente);
    setForm({
      nome: cliente.nome,
      telefone: formatTelefoneBR(cliente.telefone || ''),
      documento: formatDocumentoBR(cliente.documento || ''),
      data_nascimento: cliente.data_nascimento || '',
      origem: cliente.origem,
      preferencia_contato: cliente.preferencia_contato,
      tags: cliente.tags,
      observacoes: cliente.observacoes || '',
    });
    setTagsTexto(tagsParaTexto(cliente.tags));
    setErroForm(null);
    setIsFormOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) return setErroForm('Nome é obrigatório');

    setSalvando(true);
    setErroForm(null);
    const payload: ClienteInput = {
      nome: form.nome.trim(),
      telefone: onlyDigits(form.telefone || '') || null,
      documento: onlyDigits(form.documento || '') || null,
      data_nascimento: form.data_nascimento || null,
      origem: form.origem || null,
      preferencia_contato: form.preferencia_contato || null,
      tags: textoParaTags(tagsTexto),
      observacoes: form.observacoes?.trim() || null,
    };
    try {
      const result = editando ? await clientesApi.atualizar(editando.id, payload) : await clientesApi.criar(payload);
      if (!result.success) throw new Error(result.error);
      setIsFormOpen(false);
      await refreshData();
      if (clienteAberto && editando && result.data.id === clienteAberto.id) setClienteAberto(result.data);
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao salvar cliente');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (cliente: Cliente) => {
    try {
      const result = cliente.ativo ? await clientesApi.desativar(cliente.id) : await clientesApi.reativar(cliente.id);
      if (!result.success) throw new Error(result.error);
      await refreshData();
      if (clienteAberto?.id === cliente.id) setClienteAberto(result.data);
    } catch (err: any) {
      aviso.falha(err, cliente.ativo ? 'Erro ao desativar cliente' : 'Erro ao reativar cliente');
    }
  };

  const [carregandoFicha, setCarregandoFicha] = useState(false);

  const abrirFicha = async (cliente: Cliente) => {
    setClienteAberto(cliente);
    setCarregandoFicha(true);
    try {
      const result = await clientesApi.buscar(cliente.id);
      if (result.success) setClienteAberto(result.data);
    } catch (err: any) {
      aviso.falha(err, 'Erro ao carregar ficha do cliente');
    } finally {
      setCarregandoFicha(false);
    }
  };

  const enviarNota = async () => {
    if (!clienteAberto || !novaNota.trim()) return;
    setEnviandoNota(true);
    try {
      const result = await clientesApi.adicionarNota(clienteAberto.id, novaNota.trim());
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, notas: [result.data, ...(prev.notas || [])] } : prev));
      setNovaNota('');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao adicionar nota');
    } finally {
      setEnviandoNota(false);
    }
  };

  const excluirNota = async (notaId: string) => {
    if (!clienteAberto) return;
    try {
      const result = await clientesApi.removerNota(clienteAberto.id, notaId);
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, notas: (prev.notas || []).filter((n) => n.id !== notaId) } : prev));
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir nota');
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  // Opções em lista plana (caminho completo como label) em vez do seletor em
  // cascata usado em Estoque/Configurações — mantém a mesma linguagem visual
  // (tokens de design) do resto desta tela, que não usa o estilo zinc legado.
  const opcoesModelo = useMemo(
    () => modelos.map((m) => ({ id: m.id, label: getAncestorChainMoto(m.id, modelos).map((n) => n.nome).join(' › ') })).sort((a, b) => a.label.localeCompare(b.label, 'pt')),
    [modelos]
  );
  const opcoesCategoria = useMemo(
    () => categorias.map((c) => ({ id: c.id, label: getAncestorChainCategoria(c.id, categorias).map((n) => n.nome).join(' › ') })).sort((a, b) => a.label.localeCompare(b.label, 'pt')),
    [categorias]
  );

  const [novaMoto, setNovaMoto] = useState<ClienteMotoInput>(EMPTY_MOTO);
  const [enviandoMoto, setEnviandoMoto] = useState(false);

  const enviarMoto = async () => {
    if (!clienteAberto) return;
    setEnviandoMoto(true);
    try {
      const payload: ClienteMotoInput = {
        modelo_moto_id: novaMoto.modelo_moto_id || null,
        placa: novaMoto.placa?.trim() || null,
        chassi: novaMoto.chassi?.trim() || null,
        ano: novaMoto.ano?.trim() || null,
        cor: novaMoto.cor?.trim() || null,
        observacoes: novaMoto.observacoes?.trim() || null,
      };
      const result = await clientesApi.criarMoto(clienteAberto.id, payload);
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, motos: [...(prev.motos || []), result.data] } : prev));
      setNovaMoto(EMPTY_MOTO);
    } catch (err: any) {
      aviso.falha(err, 'Erro ao cadastrar moto');
    } finally {
      setEnviandoMoto(false);
    }
  };

  const removerMoto = async (motoId: string) => {
    if (!clienteAberto) return;
    try {
      const result = await clientesApi.removerMoto(clienteAberto.id, motoId);
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, motos: (prev.motos || []).filter((m) => m.id !== motoId) } : prev));
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir moto');
    }
  };

  const [novaPeca, setNovaPeca] = useState<PecaProcuradaInput>(EMPTY_PECA);
  const [enviandoPeca, setEnviandoPeca] = useState(false);

  const enviarPeca = async () => {
    if (!clienteAberto || !novaPeca.descricao.trim()) return;
    setEnviandoPeca(true);
    try {
      const payload: PecaProcuradaInput = {
        descricao: novaPeca.descricao.trim(),
        categoria_id: novaPeca.categoria_id || null,
        modelo_moto_id: novaPeca.modelo_moto_id || null,
      };
      const result = await clientesApi.criarPecaProcurada(clienteAberto.id, payload);
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, pecas_procuradas: [result.data, ...(prev.pecas_procuradas || [])] } : prev));
      setPecasProcuradas((prev) => [{ id: result.data.id, cliente_id: clienteAberto.id, status: result.data.status, modelo_moto_id: result.data.modelo_moto_id, modelo_moto: result.data.modelo_moto }, ...prev]);
      setNovaPeca(EMPTY_PECA);
    } catch (err: any) {
      aviso.falha(err, 'Erro ao cadastrar peça procurada');
    } finally {
      setEnviandoPeca(false);
    }
  };

  const atualizarStatusPeca = async (pedidoId: string, status: PecaProcuradaStatus) => {
    if (!clienteAberto) return;
    try {
      const result = await clientesApi.atualizarStatusPecaProcurada(clienteAberto.id, pedidoId, status);
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, pecas_procuradas: (prev.pecas_procuradas || []).map((p) => (p.id === pedidoId ? result.data : p)) } : prev));
      setPecasProcuradas((prev) => prev.map((p) => (p.id === pedidoId ? { ...p, status: result.data.status } : p)));
    } catch (err: any) {
      aviso.falha(err, 'Erro ao atualizar status');
    }
  };

  const removerPeca = async (pedidoId: string) => {
    if (!clienteAberto) return;
    try {
      const result = await clientesApi.removerPecaProcurada(clienteAberto.id, pedidoId);
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, pecas_procuradas: (prev.pecas_procuradas || []).filter((p) => p.id !== pedidoId) } : prev));
      setPecasProcuradas((prev) => prev.filter((p) => p.id !== pedidoId));
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir peça procurada');
    }
  };

  // Soft-delete, só admin — o backend nunca apaga o arquivo do Storage (ver
  // migration_036). Comprovante sem venda_id (venda cancelada) não tem como
  // ser removido por aqui — a rota de exclusão vive em /api/vendas/:id/comprovantes.
  const removerComprovante = async (comprovanteId: string, vendaId: string | null) => {
    if (!clienteAberto || !vendaId) return;
    try {
      const result = await comprovantesApi.remover(vendaId, comprovanteId);
      if (!result.success) throw new Error(result.error);
      setClienteAberto((prev) => (prev ? { ...prev, comprovantes_pix: (prev.comprovantes_pix || []).filter((c) => c.id !== comprovanteId) } : prev));
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir comprovante');
    }
  };

  const colunas: DataTableColumn<Cliente>[] = [
    {
      key: 'nome',
      header: 'Cliente',
      render: (c) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{c.nome}</span>
          {(c.tags.length > 0 || (badgesPorCliente.get(c.id) || []).length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(badgesPorCliente.get(c.id) || []).map((b) => (
                <span key={b.modeloMotoId} title="Moto procurada">
                  <StatusBadge texto={b.nome} tom={b.tom} />
                </span>
              ))}
              {c.tags.map((t) => (
                <span key={t}>
                  <StatusBadge texto={t} tom="accent" />
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    { key: 'telefone', header: 'Telefone', render: (c) => (c.telefone ? formatTelefoneBR(c.telefone) : '—') },
    {
      key: 'segmento',
      header: 'Segmento',
      render: (c) => {
        const segmento = calcularSegmento(historicoPorCliente.get(c.id)!);
        return <StatusBadge texto={SEGMENTO_LABELS[segmento]} tom={SEGMENTO_TONS[segmento]} />;
      },
    },
    {
      key: 'ultimaCompra',
      header: 'Última compra',
      render: (c) => {
        const h = historicoPorCliente.get(c.id)!;
        return h.ultimaCompraEm ? `${formatarData(h.ultimaCompraEm)} (${h.diasDesdeUltimaCompra}d)` : '—';
      },
    },
    {
      key: 'totalGasto',
      header: 'Total gasto',
      align: 'right',
      render: (c) => formatCurrency(historicoPorCliente.get(c.id)!.totalGasto),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (c.ativo ? <StatusBadge texto="Ativo" tom="positive" /> : <StatusBadge texto="Inativo" tom="neutral" ativo={false} />),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => abrirEditar(c)} title="Editar" className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary">
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => alternarAtivo(c)}
            title={c.ativo ? 'Desativar' : 'Reativar'}
            className={cn('size-7 flex items-center justify-center rounded-control hover:bg-surface-raised', c.ativo ? 'text-danger' : 'text-positive')}
          >
            {c.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
          </button>
        </div>
      ),
    },
  ];

  function renderMobileCard(c: Cliente) {
    return (
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{c.nome}</p>
            <p className="text-xs text-text-faint">{c.telefone ? formatTelefoneBR(c.telefone) : '—'}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => abrirEditar(c)} title="Editar" className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary">
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => alternarAtivo(c)}
              title={c.ativo ? 'Desativar' : 'Reativar'}
              className={cn('size-7 flex items-center justify-center rounded-control hover:bg-surface-raised', c.ativo ? 'text-danger' : 'text-positive')}
            >
              {c.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {(() => {
            const segmento = calcularSegmento(historicoPorCliente.get(c.id)!);
            return <StatusBadge texto={SEGMENTO_LABELS[segmento]} tom={SEGMENTO_TONS[segmento]} />;
          })()}
          {(badgesPorCliente.get(c.id) || []).map((b) => (
            <span key={b.modeloMotoId} title="Moto procurada">
              <StatusBadge texto={b.nome} tom={b.tom} />
            </span>
          ))}
          {c.tags.map((t) => (
            <span key={t}>
              <StatusBadge texto={t} tom="accent" />
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Clientes</h1>
          <p className="text-sm text-text-faint mt-0.5">Cadastro, histórico e atendimento</p>
        </div>
        <button
          onClick={abrirCriar}
          className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90 self-start md:self-auto"
        >
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {segmentoFiltro === 'sumido' && (
        <AlertBar
          tom="warning"
          icone={UserX}
          mensagem="Filtrando: clientes sumidos (90+ dias sem comprar)"
          acaoLabel="Limpar filtro"
          onAcao={() => setSegmentoFiltro(null)}
        />
      )}

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou documento" className={cn(inputClass, 'pl-9')} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as OrdenacaoClientes)} className={cn(inputClass, 'w-auto')} title="Ordenar por">
            {(Object.keys(ORDENACAO_LABELS) as OrdenacaoClientes[]).map((k) => (
              <option key={k} value={k}>
                Ordenar: {ORDENACAO_LABELS[k]}
              </option>
            ))}
          </select>

          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as typeof statusFiltro)} className={cn(inputClass, 'w-auto')} title="Filtrar por status">
            {(Object.keys(STATUS_FILTRO_LABELS) as (keyof typeof STATUS_FILTRO_LABELS)[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_FILTRO_LABELS[k]}
              </option>
            ))}
          </select>

          <select value={segmentoFiltro || ''} onChange={(e) => setSegmentoFiltro((e.target.value || null) as SegmentoCliente | null)} className={cn(inputClass, 'w-auto')} title="Filtrar por segmento">
            <option value="">Todos os segmentos</option>
            {(Object.keys(SEGMENTO_LABELS) as SegmentoCliente[]).map((k) => (
              <option key={k} value={k}>
                {SEGMENTO_LABELS[k]}
              </option>
            ))}
          </select>

          {motosClientesOpcoes.length > 0 && (
            <select
              value={motoClienteFiltro || ''}
              onChange={(e) => setMotoClienteFiltro(e.target.value || null)}
              className={cn(inputClass, 'w-auto')}
              title="Filtrar por moto que o cliente tem"
            >
              <option value="">Moto que tem: todas</option>
              {motosClientesOpcoes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          )}

          {motosProcuradasOpcoes.length > 0 && (
            <select
              value={motoProcuradaFiltro || ''}
              onChange={(e) => setMotoProcuradaFiltro(e.target.value || null)}
              className={cn(inputClass, 'w-auto')}
              title="Filtrar por moto procurada (peça pendente)"
            >
              <option value="">Peça procurada: todas</option>
              {motosProcuradasOpcoes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          )}

          {filtrosAtivos && (
            <button onClick={limparFiltros} className="h-9 px-3 rounded-control text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg hover:opacity-80 flex items-center gap-1">
              <X size={12} /> Limpar filtros
            </button>
          )}
        </div>

        {todasTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTagFiltro(null)}
              className={cn(
                'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
                !tagFiltro ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
              )}
            >
              Todas
            </button>
            {todasTags.map((t) => (
              <button
                key={t}
                onClick={() => setTagFiltro(t)}
                className={cn(
                  'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  tagFiltro === t ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <DataTable
        colunas={colunas}
        dados={loading ? [] : filtrados}
        getRowKey={(c) => c.id}
        onRowClick={abrirFicha}
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
            <EmptyState icone={Users} mensagem="Nenhum cliente cadastrado ainda." acaoLabel="Cadastrar o primeiro" onAcao={abrirCriar} />
          )
        }
      />

      <Modal
        aberto={isFormOpen}
        onFechar={() => setIsFormOpen(false)}
        titulo={editando ? 'Editar cliente' : 'Novo cliente'}
        tamanho="md"
        rodape={
          <div className="flex gap-3">
            <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} className="flex-1 py-3 rounded-control font-medium text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {erroForm && <p className="text-sm text-danger">{erroForm}</p>}
          <div>
            <label className={labelClass}>Nome</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} className={inputClass} placeholder="Nome do cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Telefone</label>
              <input
                value={form.telefone || ''}
                onChange={(e) => setForm((f) => ({ ...f, telefone: formatTelefoneBR(e.target.value) }))}
                inputMode="numeric"
                maxLength={15}
                className={inputClass}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className={labelClass}>CPF/CNPJ</label>
              <input
                value={form.documento || ''}
                onChange={(e) => setForm((f) => ({ ...f, documento: formatDocumentoBR(e.target.value) }))}
                inputMode="numeric"
                maxLength={18}
                className={inputClass}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Aniversário</label>
              <input type="date" value={form.data_nascimento || ''} onChange={(e) => setForm((f) => ({ ...f, data_nascimento: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Preferência de contato</label>
              <select
                value={form.preferencia_contato || ''}
                onChange={(e) => setForm((f) => ({ ...f, preferencia_contato: (e.target.value || null) as PreferenciaContato | null }))}
                className={inputClass}
              >
                <option value="">—</option>
                {(Object.keys(CONTATO_LABELS) as PreferenciaContato[]).map((k) => (
                  <option key={k} value={k}>
                    {CONTATO_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Como conheceu a loja</label>
            <select value={form.origem || ''} onChange={(e) => setForm((f) => ({ ...f, origem: (e.target.value || null) as ClienteOrigem | null }))} className={inputClass}>
              <option value="">—</option>
              {(Object.keys(ORIGEM_LABELS) as ClienteOrigem[]).map((k) => (
                <option key={k} value={k}>
                  {ORIGEM_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tags (separadas por vírgula)</label>
            <input value={tagsTexto} onChange={(e) => setTagsTexto(e.target.value)} className={inputClass} placeholder="ex: revendedor, atacado" />
          </div>
          <div>
            <label className={labelClass}>Observações</label>
            <textarea
              value={form.observacoes || ''}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              className={cn(inputClass, 'min-h-20 resize-none')}
              placeholder='Nota fixa, ex: "só liga depois das 18h"'
            />
          </div>
        </div>
      </Modal>

      <Modal
        aberto={!!clienteAberto}
        onFechar={() => setClienteAberto(null)}
        titulo={clienteAberto?.nome || ''}
        subtitulo={clienteAberto?.telefone ? formatTelefoneBR(clienteAberto.telefone) : 'Sem telefone cadastrado'}
        tamanho="lg"
        rodape={
          clienteAberto && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const cliente = clienteAberto;
                  setClienteAberto(null);
                  abrirEditar(cliente);
                }}
                className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised flex items-center justify-center gap-2"
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                onClick={() => alternarAtivo(clienteAberto)}
                className={cn(
                  'flex-1 py-3 rounded-control font-medium text-sm border flex items-center justify-center gap-2',
                  clienteAberto.ativo ? 'border-danger/30 text-danger hover:bg-danger-bg' : 'border-positive/30 text-positive hover:bg-positive-bg'
                )}
              >
                {clienteAberto.ativo ? (
                  <>
                    <Ban size={14} /> Desativar
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} /> Reativar
                  </>
                )}
              </button>
            </div>
          )
        }
      >
        {clienteAberto && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const historico = historicoPorCliente.get(clienteAberto.id);
                if (!historico) return null;
                const segmento = calcularSegmento(historico);
                return <StatusBadge texto={SEGMENTO_LABELS[segmento]} tom={SEGMENTO_TONS[segmento]} />;
              })()}
              {!clienteAberto.ativo && <StatusBadge texto="Inativo" tom="neutral" ativo={false} />}
            </div>
            {(badgesPorCliente.get(clienteAberto.id) || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(badgesPorCliente.get(clienteAberto.id) || []).map((b) => (
                    <span key={b.modeloMotoId} title="Moto procurada">
                      <StatusBadge texto={b.nome} tom={b.tom} />
                    </span>
                  ))}
                </div>
              )}
              {clienteAberto.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {clienteAberto.tags.map((t) => (
                    <span key={t}>
                      <StatusBadge texto={t} tom="accent" />
                    </span>
                  ))}
                </div>
              )}
              {clienteAberto.observacoes && <p className="text-sm text-text-secondary italic">"{clienteAberto.observacoes}"</p>}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-text-faint uppercase tracking-wide">Documento</p>
                  <p className="text-text-primary">{clienteAberto.documento ? formatDocumentoBR(clienteAberto.documento) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase tracking-wide">Aniversário</p>
                  <p className="text-text-primary">{clienteAberto.data_nascimento ? new Date(clienteAberto.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase tracking-wide">Origem</p>
                  <p className="text-text-primary">{clienteAberto.origem ? ORIGEM_LABELS[clienteAberto.origem] : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase tracking-wide">Contato preferido</p>
                  <p className="text-text-primary">{clienteAberto.preferencia_contato ? CONTATO_LABELS[clienteAberto.preferencia_contato] : '—'}</p>
                </div>
              </div>

              {(() => {
                const historico = historicoPorCliente.get(clienteAberto.id);
                if (!historico) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                        <ShoppingBag size={12} /> Histórico de compras
                      </p>
                      {historico.vendas.length > 0 && (
                        <button
                          onClick={() => baixarCsv(`historico-${clienteAberto.nome.replace(/\s+/g, '-').toLowerCase()}.csv`, gerarCsvHistoricoCliente(clienteAberto, historico))}
                          className="text-[11px] font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80 flex items-center gap-1"
                        >
                          <Download size={12} /> Exportar CSV
                        </button>
                      )}
                    </div>
                    {historico.vendas.length === 0 ? (
                      <p className="text-xs text-text-faint">Nenhuma venda vinculada a este cliente ainda.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                          <div className="bg-surface-inset rounded-control py-2">
                            <p className="text-sm font-medium text-text-primary">{formatCurrency(historico.totalGasto)}</p>
                            <p className="text-[10px] text-text-faint uppercase">Total gasto</p>
                          </div>
                          <div className="bg-surface-inset rounded-control py-2">
                            <p className="text-sm font-medium text-text-primary">{formatCurrency(historico.ticketMedio)}</p>
                            <p className="text-[10px] text-text-faint uppercase">Ticket médio</p>
                          </div>
                          <div className="bg-surface-inset rounded-control py-2">
                            <p className="text-sm font-medium text-text-primary">{historico.diasDesdeUltimaCompra}d</p>
                            <p className="text-[10px] text-text-faint uppercase">Última compra</p>
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {historico.vendas.map((v) => (
                            <div key={v.id} className="flex items-center justify-between text-xs">
                              <span className="text-text-secondary truncate">
                                {formatarData(v.data)} · {v.nome_item}
                              </span>
                              <span className="text-text-primary font-medium shrink-0 ml-2">{formatCurrency(v.valor_total)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {historico.orcamentosAbertos.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1.5">
                          <Receipt size={12} /> Orçamentos em aberto
                        </p>
                        <div className="space-y-1.5">
                          {historico.orcamentosAbertos.map((o) => (
                            <div key={o.id} className="flex items-center justify-between text-xs">
                              <span className="text-text-secondary">{o.codigo}</span>
                              <span className="text-text-faint">{formatarData(o.criado_em.slice(0, 10))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const tarefasDoCliente = tarefas.filter((t) => t.cliente_id === clienteAberto.id);
                if (tarefasDoCliente.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                      <ClipboardList size={12} /> Tarefas e visitas
                    </p>
                    <div className="space-y-1.5">
                      {tarefasDoCliente.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-text-secondary flex items-center gap-1.5 min-w-0">
                            {t.tipo === 'visita' && <MapPin size={11} className="text-accent shrink-0" />}
                            <span className="truncate">{t.titulo}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {t.prazo && (
                              <span className="text-text-faint flex items-center gap-1">
                                <Clock size={10} /> {new Date(t.prazo).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {t.status === 'concluida' ? <StatusBadge texto="Concluída" tom="positive" /> : <StatusBadge texto="Pendente" tom="warning" />}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                  <Bike size={12} /> Motos
                </p>
                <div className="space-y-1.5 mb-3">
                  {(clienteAberto.motos || []).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 bg-surface-card border border-border-subtle rounded-control p-2.5">
                      <div className="min-w-0 text-xs">
                        <p className="text-text-primary font-medium truncate">
                          {m.modelo_moto?.nome || 'Sem modelo'} {m.ano ? `· ${m.ano}` : ''}
                        </p>
                        <p className="text-text-faint truncate">{[m.placa, m.chassi, m.cor].filter(Boolean).join(' · ') || 'Sem detalhes'}</p>
                      </div>
                      <button onClick={() => removerMoto(m.id)} className="shrink-0 size-6 flex items-center justify-center rounded-control text-text-faint hover:text-danger hover:bg-surface-raised">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {(clienteAberto.motos || []).length === 0 && <p className="text-xs text-text-faint">Nenhuma moto cadastrada.</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={novaMoto.modelo_moto_id || ''} onChange={(e) => setNovaMoto((m) => ({ ...m, modelo_moto_id: e.target.value || null }))} className={cn(inputClass, 'col-span-2 text-xs py-2')}>
                    <option value="">Modelo (opcional)</option>
                    {opcoesModelo.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input value={novaMoto.placa || ''} onChange={(e) => setNovaMoto((m) => ({ ...m, placa: e.target.value }))} placeholder="Placa" className={cn(inputClass, 'text-xs py-2')} />
                  <input value={novaMoto.ano || ''} onChange={(e) => setNovaMoto((m) => ({ ...m, ano: e.target.value }))} placeholder="Ano" className={cn(inputClass, 'text-xs py-2')} />
                  <input value={novaMoto.chassi || ''} onChange={(e) => setNovaMoto((m) => ({ ...m, chassi: e.target.value }))} placeholder="Chassi" className={cn(inputClass, 'text-xs py-2')} />
                  <input value={novaMoto.cor || ''} onChange={(e) => setNovaMoto((m) => ({ ...m, cor: e.target.value }))} placeholder="Cor" className={cn(inputClass, 'text-xs py-2')} />
                  <button
                    onClick={enviarMoto}
                    disabled={enviandoMoto}
                    className="col-span-2 h-9 rounded-control bg-surface-inset border border-border-default text-text-secondary text-xs font-medium hover:bg-surface-raised disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {enviandoMoto ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Cadastrar moto
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                  <PackageSearch size={12} /> Peças procuradas
                </p>
                <div className="space-y-1.5 mb-3">
                  {(clienteAberto.pecas_procuradas || []).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-surface-card border border-border-subtle rounded-control p-2.5">
                      <div className="min-w-0 text-xs flex-1">
                        <p className="text-text-primary truncate">{p.descricao}</p>
                        <p className="text-text-faint truncate">{[p.categoria?.nome, p.modelo_moto?.nome].filter(Boolean).join(' · ') || 'Sem filtro'}</p>
                      </div>
                      <StatusBadge texto={PECA_STATUS_LABELS[p.status]} tom={PECA_STATUS_TONS[p.status]} />
                      {p.status === 'aguardando' && (
                        <button onClick={() => atualizarStatusPeca(p.id, 'cancelada')} title="Cancelar pedido" className="shrink-0 size-6 flex items-center justify-center rounded-control text-text-faint hover:text-danger hover:bg-surface-raised">
                          <X size={12} />
                        </button>
                      )}
                      <button onClick={() => removerPeca(p.id)} title="Excluir" className="shrink-0 size-6 flex items-center justify-center rounded-control text-text-faint hover:text-danger hover:bg-surface-raised">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {(clienteAberto.pecas_procuradas || []).length === 0 && <p className="text-xs text-text-faint">Nenhum pedido em aberto.</p>}
                </div>
                <div className="space-y-2">
                  <input
                    value={novaPeca.descricao}
                    onChange={(e) => setNovaPeca((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="O que o cliente está procurando?"
                    className={cn(inputClass, 'text-xs py-2')}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={novaPeca.categoria_id || ''} onChange={(e) => setNovaPeca((p) => ({ ...p, categoria_id: e.target.value || null }))} className={cn(inputClass, 'text-xs py-2')}>
                      <option value="">Categoria (opcional)</option>
                      {opcoesCategoria.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select value={novaPeca.modelo_moto_id || ''} onChange={(e) => setNovaPeca((p) => ({ ...p, modelo_moto_id: e.target.value || null }))} className={cn(inputClass, 'text-xs py-2')}>
                      <option value="">Modelo (opcional)</option>
                      {opcoesModelo.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={enviarPeca}
                    disabled={enviandoPeca || !novaPeca.descricao.trim()}
                    className="w-full h-9 rounded-control bg-surface-inset border border-border-default text-text-secondary text-xs font-medium hover:bg-surface-raised disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {enviandoPeca ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Registrar pedido
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                  <StickyNote size={12} /> Anotações de atendimento
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviarNota()}
                    className={inputClass}
                    placeholder="Registrar uma anotação..."
                  />
                  <button
                    onClick={enviarNota}
                    disabled={enviandoNota || !novaNota.trim()}
                    className="shrink-0 size-10 rounded-control bg-accent text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50"
                  >
                    {enviandoNota ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                {carregandoFicha ? (
                  <div className="py-4 flex items-center justify-center text-text-faint">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : clienteAberto.notas && clienteAberto.notas.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {clienteAberto.notas.map((nota: ClienteNota) => (
                      <div key={nota.id} className="bg-surface-card border border-border-subtle rounded-control p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-text-secondary">{nota.texto}</p>
                          <p className="text-[11px] text-text-faint mt-1">
                            {nota.autor?.nome_exibicao || 'Equipe'} · {new Date(nota.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button onClick={() => excluirNota(nota.id)} className="shrink-0 size-6 flex items-center justify-center rounded-control text-text-faint hover:text-danger hover:bg-surface-raised">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-faint">Nenhuma anotação registrada ainda.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                  <Receipt size={12} /> Comprovantes de PIX
                </p>
                {carregandoFicha ? (
                  <div className="py-4 flex items-center justify-center text-text-faint">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : (clienteAberto.comprovantes_pix || []).length === 0 ? (
                  <p className="text-xs text-text-faint">Nenhum comprovante anexado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {clienteAberto.comprovantes_pix!.map((c) => (
                      <div key={c.id}>
                        <ComprovanteListItem
                          comprovante={c}
                          legenda={c.venda?.nome_item}
                          podeExcluir={podeExcluirComprovante && !!c.venda_id}
                          onExcluir={(comp) => removerComprovante(comp.id, comp.venda_id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        )}
      </Modal>
    </div>
  );
}


