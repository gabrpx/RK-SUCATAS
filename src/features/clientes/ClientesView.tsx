// Aba Clientes: cadastro, histórico de compras (via vendas/orçamentos
// vinculados por cliente_id), segmentação RFM, timeline de notas de
// atendimento, tarefas/visitas vinculadas e desativação (soft delete — nunca
// some do histórico de quem já comprou).
import { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Search, Loader2, RotateCcw, Ban, Trash2, UserX, PackageSearch, X, MessageCircle, ShieldAlert } from 'lucide-react';
import { cn } from '../../utils';
import { usePermissao } from '../../hooks/usePermissao';
import { formatTelefoneBR, formatDocumentoBR, onlyDigits } from '../../utils/formatters';
import { linkWhatsapp } from '../../utils/whatsapp';
import { useData } from '../../context/DataContext';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AlertBar } from '../../components/ui/AlertBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '@/src/components/ui/button';
import { useCatalogos } from '../../hooks/useCatalogos';
import { getAncestorChain as getAncestorChainMoto } from '../motos/motoTree';
import { getAncestorChain as getAncestorChainCategoria } from '../categorias/categoriaTree';
import { clientesApi } from './api';
import { ClienteFormModal, type ClienteFormData } from './ClienteFormModal';
import { ClienteDetalheModal } from './ClienteDetalheModal';
import {
  calcularHistoricoCliente,
  calcularSegmento,
  rankingTopClientes,
  SEGMENTO_LABELS,
  SEGMENTO_TONS,
  badgesMotoProcurada,
  motosDistintasProcuradas,
  type SegmentoCliente,
} from './metricas';
import { preferenciasClientes, type OrdenacaoClientes } from './preferencias';
import { gerarCsvHistoricoCliente, baixarCsv } from './exportarHistoricoCsv';
import { useTarefas } from '../tarefas/useTarefas';
import { comprovantesApi } from '../comprovantes/api';
import type { Cliente, ClienteInput, ClienteOrigem, PreferenciaContato, PecaProcuradaStatus } from './types';
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



const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

const EMPTY_FORM: ClienteFormData = {
  nome: '',
  telefone: '',
  documento: '',
  data_nascimento: '',
  origem: null,
  preferencia_contato: null,
  tags: [],
  observacoes: '',
  cidade: '',
  estado: '',
  cep: '',
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
}: {
  pendingClienteId?: string | null;
  setPendingClienteId?: (id: string | null) => void;
  pendingFiltroSumidos?: boolean;
  setPendingFiltroSumidos?: (v: boolean) => void;
}) {
  const { pode } = usePermissao();
  const podeExcluirComprovante = pode('vendas.excluir_comprovante');
  const { clientes, vendas, orcamentos, pecasProcuradas, setPecasProcuradas, refreshData, loading } = useData();
  const { tarefas } = useTarefas();
  const { modelos, categorias } = useCatalogos();
  const [busca, setBusca] = useState('');
  const [tagFiltro, setTagFiltro] = useState<string | null>(null);
  const [motoProcuradaFiltro, setMotoProcuradaFiltro] = useState<string | null>(null);
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

  const idCampeao = useMemo(() => {
    const top = rankingTopClientes(clientes, vendas, orcamentos, { limite: 1 });
    return top[0]?.cliente.id ?? null;
  }, [clientes, vendas, orcamentos]);

  const segmentoParaExibicao = (segmento: SegmentoCliente, clienteId: string): SegmentoCliente => {
    if (segmento === 'campeao' && clienteId !== idCampeao) return 'ativo';
    return segmento;
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteFormData>(EMPTY_FORM);
  const [tagsTexto, setTagsTexto] = useState('');
  // Motos que o cliente busca peças, informadas já na criação/edição. Cada uma
  // vira uma peça procurada (com modelo_moto) ao salvar. Só dígitos aqui: id +
  // nome do modelo pra montar o chip; o select abaixo alimenta a adição.
  const [motosBuscaForm, setMotosBuscaForm] = useState<{ id: string; nome: string }[]>([]);
  const [motoBuscaSel, setMotoBuscaSel] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [clienteAberto, setClienteAberto] = useState<Cliente | null>(null);

  const todasTags = useMemo(() => Array.from(new Set(clientes.flatMap((c) => c.tags))).sort(), [clientes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const resultado = clientes.filter((c) => {
      if (statusFiltro === 'ativos' && !c.ativo) return false;
      if (statusFiltro === 'inativos' && c.ativo) return false;
      if (segmentoFiltro && calcularSegmento(historicoPorCliente.get(c.id)!, c.criado_em) !== segmentoFiltro) return false;
      if (tagFiltro && !c.tags.includes(tagFiltro)) return false;
      if (motoProcuradaFiltro && !(badgesPorCliente.get(c.id) || []).some((b) => b.modeloMotoId === motoProcuradaFiltro)) return false;
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
  }, [clientes, busca, tagFiltro, motoProcuradaFiltro, segmentoFiltro, statusFiltro, ordenacao, historicoPorCliente, badgesPorCliente]);

  const filtrosAtivos = !!(busca.trim() || tagFiltro || motoProcuradaFiltro || segmentoFiltro || statusFiltro !== 'ativos');
  const limparFiltros = () => {
    setBusca('');
    setTagFiltro(null);
    setMotoProcuradaFiltro(null);
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
    setMotosBuscaForm([]);
    setMotoBuscaSel('');
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
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      cep: '',
    });
    setTagsTexto(tagsParaTexto(cliente.tags));
    setMotosBuscaForm([]);
    setMotoBuscaSel('');
    setErroForm(null);
    setIsFormOpen(true);
  };

  const adicionarMotoBusca = () => {
    if (!motoBuscaSel) return;
    if (motosBuscaForm.some((m) => m.id === motoBuscaSel)) return setMotoBuscaSel('');
    const opcao = opcoesModelo.find((o) => o.id === motoBuscaSel);
    if (!opcao) return;
    setMotosBuscaForm((prev) => [...prev, { id: opcao.id, nome: opcao.label }]);
    setMotoBuscaSel('');
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
      cidade: form.cidade?.trim() || null,
      estado: form.estado?.trim() || null,
    };
    try {
      const result = editando ? await clientesApi.atualizar(editando.id, payload) : await clientesApi.criar(payload);
      if (!result.success) throw new Error(result.error);
      const clienteId = result.data.id;

      // Registra cada moto buscada como peça procurada (com modelo_moto), sem
      // duplicar as que o cliente já tem ativas — é isso que alimenta a badge de
      // "busca peças de" no card e na lista.
      if (motosBuscaForm.length > 0) {
        const jaAtivas = new Set(
          pecasProcuradas
            .filter((p) => p.cliente_id === clienteId && p.status !== 'cancelada' && p.modelo_moto_id)
            .map((p) => p.modelo_moto_id as string)
        );
        for (const moto of motosBuscaForm) {
          if (jaAtivas.has(moto.id)) continue;
          const nomeCurto = moto.nome.split('›').pop()?.trim() || moto.nome;
          const pecaResult = await clientesApi.criarPecaProcurada(clienteId, {
            descricao: `Peças para ${nomeCurto}`,
            modelo_moto_id: moto.id,
          });
          if (pecaResult.success) {
            setPecasProcuradas((prev) => [
              { id: pecaResult.data.id, cliente_id: clienteId, status: pecaResult.data.status, modelo_moto_id: pecaResult.data.modelo_moto_id, modelo_moto: pecaResult.data.modelo_moto },
              ...prev,
            ]);
          }
        }
      }

      setIsFormOpen(false);
      await refreshData();
      if (clienteAberto && editando && clienteId === clienteAberto.id) setClienteAberto(result.data);
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

  const alternarBanido = async (cliente: Cliente) => {
    try {
      const result = cliente.banido ? await clientesApi.desbanir(cliente.id) : await clientesApi.banir(cliente.id);
      if (!result.success) throw new Error(result.error);
      await refreshData();
      if (clienteAberto?.id === cliente.id) setClienteAberto(result.data);
      aviso.sucesso(cliente.banido ? 'Banimento removido' : 'Cliente banido');
    } catch (err: any) {
      aviso.falha(err, cliente.banido ? 'Erro ao remover banimento' : 'Erro ao banir cliente');
    }
  };

  const [confirmarBanir, setConfirmarBanir] = useState<Cliente | null>(null);

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
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {(badgesPorCliente.get(c.id) || []).length > 0 && (
                <span className="inline-flex items-center text-text-muted" title="Tem pedido de peça">
                  <PackageSearch size={13} />
                </span>
              )}
              {(badgesPorCliente.get(c.id) || []).map((b) => (
                <span key={b.modeloMotoId} title="Moto que busca peças">
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
    { key: 'cidade', header: 'Cidade', render: (c) => c.cidade || '—' },
    {
      key: 'segmento',
      header: 'Segmento',
      render: (c) => {
        const segmento = segmentoParaExibicao(calcularSegmento(historicoPorCliente.get(c.id)!, c.criado_em), c.id);
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
          <Button type="button" variant="ghost" size="icon" onClick={() => abrirEditar(c)} title="Editar" className="size-7 rounded-control text-text-muted">
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => alternarAtivo(c)}
            title={c.ativo ? 'Desativar' : 'Reativar'}
            className={cn('size-7 rounded-control', c.ativo ? 'text-danger hover:text-danger' : 'text-positive hover:text-positive')}
          >
            {c.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
          </Button>
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
            <p className="text-xs text-text-faint">{c.telefone ? formatTelefoneBR(c.telefone) : '—'}{c.cidade ? ` · ${c.cidade}` : ''}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {linkWhatsapp(c.telefone) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const url = linkWhatsapp(c.telefone);
                  if (url) window.open(url, '_blank');
                }}
                title="Enviar mensagem no WhatsApp"
                className="size-7 rounded-control text-positive hover:text-positive"
              >
                <MessageCircle size={14} />
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon" onClick={() => abrirEditar(c)} title="Editar" className="size-7 rounded-control text-text-muted">
              <Pencil size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => alternarAtivo(c)}
              title={c.ativo ? 'Desativar' : 'Reativar'}
              className={cn('size-7 rounded-control', c.ativo ? 'text-danger hover:text-danger' : 'text-positive hover:text-positive')}
            >
              {c.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {c.banido && <StatusBadge texto="Banido" tom="danger" />}
          {(() => {
            const segmento = segmentoParaExibicao(calcularSegmento(historicoPorCliente.get(c.id)!, c.criado_em), c.id);
            return <StatusBadge texto={SEGMENTO_LABELS[segmento]} tom={SEGMENTO_TONS[segmento]} />;
          })()}
          {(badgesPorCliente.get(c.id) || []).length > 0 && (
            <span className="inline-flex items-center text-text-muted" title="Tem pedido de peça">
              <PackageSearch size={13} />
            </span>
          )}
          {(badgesPorCliente.get(c.id) || []).map((b) => (
            <span key={b.modeloMotoId} title="Moto que busca peças">
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
        <Button onClick={abrirCriar} className="h-10 px-5 rounded-control text-[11px] font-semibold uppercase tracking-wider shadow-sm self-start md:self-auto">
          <Plus size={16} /> Novo cliente
        </Button>
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
            <Button variant="ghost" onClick={limparFiltros} className="h-9 px-3 rounded-control text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg hover:text-accent-soft-fg">
              <X size={12} /> Limpar filtros
            </Button>
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

      <ClienteFormModal
        aberto={isFormOpen}
        onFechar={() => setIsFormOpen(false)}
        onSalvar={salvar}
        salvando={salvando}
        form={form}
        onFormChange={setForm}
        editando={!!editando}
        erroForm={erroForm}
        opcoesModelo={opcoesModelo}
        motosBuscaForm={motosBuscaForm}
        onAdicionarMoto={adicionarMotoBusca}
        onRemoverMoto={(id) => setMotosBuscaForm((prev) => prev.filter((x) => x.id !== id))}
        motoBuscaSel={motoBuscaSel}
        onMotoBuscaSelChange={setMotoBuscaSel}
        tagsTexto={tagsTexto}
        onTagsTextoChange={setTagsTexto}
      />

      {clienteAberto && (() => {
        const hist = historicoPorCliente.get(clienteAberto.id) || null;
        const segmentoRaw = hist ? calcularSegmento(hist, clienteAberto.criado_em) : null;
        const segmento = segmentoRaw ? segmentoParaExibicao(segmentoRaw, clienteAberto.id) : null;
        const tarefasDoCliente = tarefas.filter((t) => t.cliente_id === clienteAberto.id);
        return (
          <ClienteDetalheModal
            aberto
            onFechar={() => setClienteAberto(null)}
            onEditar={() => {
              const cliente = clienteAberto;
              setClienteAberto(null);
              abrirEditar(cliente);
            }}
            onAlternarAtivo={() => alternarAtivo(clienteAberto)}
            onAlternarBanido={() => clienteAberto.banido ? alternarBanido(clienteAberto) : setConfirmarBanir(clienteAberto)}
            cliente={clienteAberto}
            historico={hist}
            segmentoLabel={segmento ? SEGMENTO_LABELS[segmento] : undefined}
            segmentoTom={segmento ? SEGMENTO_TONS[segmento] : 'neutral'}
            badges={badgesPorCliente.get(clienteAberto.id) || []}
            tarefas={tarefasDoCliente}
            onExportarCsv={hist && hist.vendas.length > 0 ? () => baixarCsv(`historico-${clienteAberto.nome.replace(/\s+/g, '-').toLowerCase()}.csv`, gerarCsvHistoricoCliente(clienteAberto, hist)) : undefined}
            onEnviarNota={async (texto) => {
              const result = await clientesApi.adicionarNota(clienteAberto.id, texto);
              if (!result.success) throw new Error(result.error);
              setClienteAberto((prev) => (prev ? { ...prev, notas: [result.data, ...(prev.notas || [])] } : prev));
            }}
            onExcluirNota={excluirNota}
            onEnviarPeca={async (desc, catId, motoId) => {
              const result = await clientesApi.criarPecaProcurada(clienteAberto.id, { descricao: desc, categoria_id: catId, modelo_moto_id: motoId });
              if (!result.success) throw new Error(result.error);
              setClienteAberto((prev) => (prev ? { ...prev, pecas_procuradas: [result.data, ...(prev.pecas_procuradas || [])] } : prev));
              setPecasProcuradas((prev) => [{ id: result.data.id, cliente_id: clienteAberto.id, status: result.data.status, modelo_moto_id: result.data.modelo_moto_id, modelo_moto: result.data.modelo_moto }, ...prev]);
            }}
            onAtualizarStatusPeca={atualizarStatusPeca}
            onRemoverPeca={removerPeca}
            onRemoverComprovante={removerComprovante}
            carregandoFicha={carregandoFicha}
            podeExcluirComprovante={podeExcluirComprovante}
            opcoesCategoria={opcoesCategoria}
            opcoesModelo={opcoesModelo}
            formatTelefoneBR={formatTelefoneBR}
            formatDocumentoBR={formatDocumentoBR}
            linkWhatsapp={linkWhatsapp}
          />
        );
      })()}

      <Modal
        aberto={!!confirmarBanir}
        onFechar={() => setConfirmarBanir(null)}
        titulo="Banir cliente?"
        icone={ShieldAlert}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setConfirmarBanir(null)} className="h-11 flex-1 rounded-control font-medium text-sm">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmarBanir) alternarBanido(confirmarBanir);
                setConfirmarBanir(null);
              }}
              className="h-11 flex-1 rounded-control font-medium text-sm"
            >
              Banir
            </Button>
          </div>
        }
      >
        {confirmarBanir && (
          <p className="text-sm text-text-secondary">
            <span className="text-text-primary font-medium">{confirmarBanir.nome}</span> não poderá receber novas vendas nem orçamentos enquanto estiver banido. Essa ação pode ser revertida a qualquer momento.
          </p>
        )}
      </Modal>
    </div>
  );
}


