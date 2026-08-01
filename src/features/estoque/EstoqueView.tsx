// Aba Estoque: catálogo de peças com categoria/modelo de moto (tabelas de
// apoio, com criação rápida inline) e condição Original/Paralela.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Search,
  Filter,
  Bike,
  RefreshCw,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Upload,
  ImageOff,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useDebounce } from '../../hooks/useDebounce';
import { CustomDropdown } from '../../components/CustomDropdown';
import { MotoCascadeSelect } from '../../components/MotoCascadeSelect';
import { CategoriaCascadeSelect } from '../../components/CategoriaCascadeSelect';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { estoqueApi, uploadImagemEstoque } from './api';
import { encontrarCategoriaPorNome } from './matchCategoria';
import { categoriaExigeNota } from './categoriaMotor';
import { getDescendantIds, buildTree } from '../categorias/categoriaTree';
import { getDescendantIds as getDescendantIdsMoto, buildTree as buildTreeMoto } from '../motos/motoTree';
import type { CondicaoPeca, Estoque, EstoqueInput } from './types';
import type { DataTableColumn } from '../../components/ui/DataTable';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const ITEMS_PER_PAGE = 25;

// Mesmo critério usado no card de estoque baixo do Dashboard: item ainda tem
// unidade (não é "esgotado"), mas está no fim.
const isEstoqueBaixo = (item: Estoque) => item.quantidade > 0 && item.quantidade <= 2;

const EMPTY_FORM: EstoqueInput = {
  nome: '',
  categoria_id: '',
  modelo_moto_id: '',
  condicao: 'original',
  nota_cadastro: null,
  ano: '',
  valor: 0,
  quantidade: 1,
  imagem_url: '',
  descricao: '',
  ativo: true,
  componentes: null,
  anuncio_ml_url: '',
  anuncio_fb_url: '',
};

// Badge quadrado de anúncio (ML/FB) — colorido e clicável quando o link
// existe, esmaecido e inerte quando não existe. Nunca decorativo: a cor
// (positive) sinaliza "publicado", não é escolha estética.
function AnuncioBadge({ label, canal, url }: { label: string; canal: string; url: string | null | undefined }) {
  const ativo = !!url;
  return (
    <button
      type="button"
      disabled={!ativo}
      onClick={(e) => {
        e.stopPropagation();
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }}
      title={ativo ? `Ver anúncio no ${canal}` : `Sem anúncio no ${canal}`}
      className={cn(
        'size-6 rounded-badge text-[9px] font-bold flex items-center justify-center shrink-0 transition-opacity',
        ativo ? 'bg-positive-bg text-positive hover:opacity-80 cursor-pointer' : 'bg-surface-inset text-text-faint cursor-default'
      )}
    >
      {label}
    </button>
  );
}

interface EstoqueViewProps {
  theme: 'light' | 'dark';
  onSelectItem: (item: Estoque) => void;
  onRegisterActions?: (actions: { edit: (item: Estoque) => void; delete: (id: string) => void; focusSearch?: () => void }) => void;
  pendingEditItem?: Estoque | null;
  setPendingEditItem?: (item: Estoque | null) => void;
  // Chega true quando outra tela (ex: AlertBar do Dashboard) navega pra cá
  // pedindo pra já abrir com o filtro de estoque baixo ativo. Consumido uma
  // única vez e resetado, mesmo padrão do pendingEditItem acima.
  filtroEstoqueBaixoInicial?: boolean;
  setFiltroEstoqueBaixoInicial?: (value: boolean) => void;
}

export function EstoqueView({ onSelectItem, onRegisterActions, pendingEditItem, setPendingEditItem, filtroEstoqueBaixoInicial, setFiltroEstoqueBaixoInicial }: EstoqueViewProps) {
  const { estoque: items, setEstoque, loading, refreshData } = useData();
  const { categorias, modelos, criarCategoria, criarNoMoto } = useCatalogos();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [modeloFiltro, setModeloFiltro] = useState('Todas');
  const [sortKey, setSortKey] = useState<'criado_em' | 'valor' | 'quantidade'>('criado_em');
  const [soEstoqueBaixo, setSoEstoqueBaixo] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Estoque | null>(null);
  const [formData, setFormData] = useState<EstoqueInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImagem, setIsUploadingImagem] = useState(false);
  // Enquanto true, a categoria é escolhida automaticamente com base no nome
  // digitado. Vira false assim que o usuário mexe manualmente no dropdown.
  const [categoriaAutoDetectada, setCategoriaAutoDetectada] = useState(true);
  const [novoComponente, setNovoComponente] = useState('');

  const [itemToDelete, setItemToDelete] = useState<Estoque | null>(null);

  // Categoria Motor (ou subcategoria dela) exige informar nota fiscal pra cadastro.
  const formExigeNota = useMemo(() => categoriaExigeNota(formData.categoria_id || null, categorias), [formData.categoria_id, categorias]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setCategoriaAutoDetectada(true);
    setNovoComponente('');
    setIsModalOpen(true);
  };

  const openEditModal = useCallback((item: Estoque) => {
    setEditingItem(item);
    setCategoriaAutoDetectada(false);
    setNovoComponente('');
    setFormData({
      nome: item.nome,
      categoria_id: item.categoria_id || '',
      modelo_moto_id: item.modelo_moto_id || '',
      condicao: item.condicao,
      nota_cadastro: item.nota_cadastro,
      ano: item.ano || '',
      valor: item.valor,
      quantidade: item.quantidade,
      imagem_url: item.imagem_url || '',
      descricao: item.descricao || '',
      ativo: item.ativo,
      componentes: item.componentes,
      anuncio_ml_url: item.anuncio_ml_url || '',
      anuncio_fb_url: item.anuncio_fb_url || '',
    });
    setIsModalOpen(true);
  }, []);

  // Ao digitar o nome de uma peça nova, tenta achar a categoria já cadastrada
  // que combina com as palavras digitadas e seleciona sozinho. Só age em
  // itens novos e só enquanto o usuário não escolheu a categoria na mão.
  useEffect(() => {
    if (editingItem || !categoriaAutoDetectada) return;
    const match = encontrarCategoriaPorNome(formData.nome, categorias);
    if (match && match.id !== formData.categoria_id) {
      setFormData((prev) => ({ ...prev, categoria_id: match.id }));
    }
  }, [formData.nome, categorias, editingItem, categoriaAutoDetectada]);

  const handleUploadImagem = async (file: File) => {
    setIsUploadingImagem(true);
    try {
      const result = await uploadImagemEstoque(file);
      if (!result.success || !result.url) throw new Error(result.error || 'Falha no upload');
      setFormData((prev) => ({ ...prev, imagem_url: result.url! }));
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar imagem');
    } finally {
      setIsUploadingImagem(false);
    }
  };

  // Se a categoria deixa de ser Motor (troca manual ou volta ao padrão), o
  // campo de nota deixa de fazer sentido — limpa pra não salvar valor obsoleto.
  useEffect(() => {
    if (!formExigeNota && formData.nota_cadastro) {
      setFormData((prev) => ({ ...prev, nota_cadastro: null }));
    }
  }, [formExigeNota, formData.nota_cadastro]);

  useEffect(() => {
    if (pendingEditItem && setPendingEditItem) {
      openEditModal(pendingEditItem);
      setPendingEditItem(null);
    }
  }, [pendingEditItem, setPendingEditItem, openEditModal]);

  useEffect(() => {
    if (filtroEstoqueBaixoInicial) {
      setSoEstoqueBaixo(true);
      setFiltroEstoqueBaixoInicial?.(false);
    }
  }, [filtroEstoqueBaixoInicial, setFiltroEstoqueBaixoInicial]);

  useEffect(() => {
    onRegisterActions?.({
      edit: openEditModal,
      delete: (id: string) => {
        const item = items.find((i) => i.id === id);
        if (item) setItemToDelete(item);
      },
    });
  }, [onRegisterActions, openEditModal, items]);

  // Lista achatada em ordem de árvore (pai sempre logo antes dos filhos), pra
  // indentar visualmente no dropdown de filtro sem espalhar irmãos por ordem alfabética.
  const categoriasIndentadas = useMemo(() => {
    const resultado: { id: string; nome: string; depth: number }[] = [];
    const percorrer = (nodes: ReturnType<typeof buildTree>, depth: number) => {
      nodes.forEach((n) => {
        resultado.push({ id: n.id, nome: n.nome, depth });
        percorrer(n.children, depth + 1);
      });
    };
    percorrer(buildTree(categorias), 0);
    return resultado;
  }, [categorias]);

  const modelosIndentados = useMemo(() => {
    const resultado: { id: string; nome: string; depth: number }[] = [];
    const percorrer = (nodes: ReturnType<typeof buildTreeMoto>, depth: number) => {
      nodes.forEach((n) => {
        resultado.push({ id: n.id, nome: n.ano ? `${n.nome} (${n.ano})` : n.nome, depth });
        percorrer(n.children, depth + 1);
      });
    };
    percorrer(buildTreeMoto(modelos), 0);
    return resultado;
  }, [modelos]);

  const itensEstoqueBaixo = useMemo(() => items.filter(isEstoqueBaixo).length, [items]);
  const valorTotalEstoque = useMemo(() => items.reduce((sum, item) => sum + Number(item.valor) * Number(item.quantidade), 0), [items]);

  const filtered = useMemo(() => {
    const terms = debouncedSearch.toLowerCase().split(' ').filter(Boolean);
    let result = items.filter((item) => {
      const matchesSearch =
        terms.length === 0 ||
        terms.every(
          (t) =>
            item.nome.toLowerCase().includes(t) ||
            item.codigo?.toLowerCase().includes(t) ||
            item.categoria?.nome?.toLowerCase().includes(t) ||
            item.modelo_moto?.nome?.toLowerCase().includes(t)
        );
      const matchesCategoria =
        categoriaFiltro === 'Todas' || (!!item.categoria_id && getDescendantIds(categoriaFiltro, categorias).includes(item.categoria_id));
      const matchesModelo =
        modeloFiltro === 'Todas' || (!!item.modelo_moto_id && getDescendantIdsMoto(modeloFiltro, modelos).includes(item.modelo_moto_id));
      const matchesEstoqueBaixo = !soEstoqueBaixo || isEstoqueBaixo(item);
      return matchesSearch && matchesCategoria && matchesModelo && matchesEstoqueBaixo;
    });

    result = [...result].sort((a, b) => {
      if (sortKey === 'valor') return b.valor - a.valor;
      if (sortKey === 'quantidade') return b.quantidade - a.quantidade;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });
    return result;
  }, [items, debouncedSearch, categoriaFiltro, modeloFiltro, soEstoqueBaixo, sortKey, categorias, modelos]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [debouncedSearch, categoriaFiltro, modeloFiltro, soEstoqueBaixo, sortKey]);

  const handleSave = async () => {
    if (!formData.nome.trim()) return alert('Nome da peça é obrigatório');
    if (!formData.categoria_id) return alert('Selecione uma categoria');
    if (formExigeNota && !formData.nota_cadastro) return alert('Para peças de Motor, selecione "Com nota pra cadastro" ou "Sem nota pra cadastro"');

    setIsSaving(true);
    const payload: EstoqueInput = {
      ...formData,
      valor: Number(formData.valor) || 0,
      quantidade: Math.max(0, Number(formData.quantidade) || 0),
      modelo_moto_id: formData.modelo_moto_id || null,
      anuncio_ml_url: formData.anuncio_ml_url?.trim() || null,
      anuncio_fb_url: formData.anuncio_fb_url?.trim() || null,
    };

    try {
      if (editingItem) {
        const result = await estoqueApi.atualizar(editingItem.id, payload);
        if (!result.success) throw new Error(result.error);
        setEstoque((prev) => prev.map((i) => (i.id === editingItem.id ? result.data : i)));
      } else {
        const result = await estoqueApi.criar(payload);
        if (!result.success) throw new Error(result.error);
        setEstoque((prev) => [result.data, ...prev]);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id;
    setEstoque((prev) => prev.filter((i) => i.id !== id));
    setItemToDelete(null);
    try {
      const result = await estoqueApi.excluir(id);
      if (!result.success) throw new Error(result.error);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir item');
      refreshData();
    }
  };

  const inputClass = 'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  // Cabeçalho clicável reaproveitado pelas colunas Valor/Qtd — mesmo state de
  // ordenação da barra de filtros, só que acionável direto na tabela.
  function SortableHeader({ label, ownKey, align }: { label: string; ownKey: typeof sortKey; align?: 'right' }) {
    const ativo = sortKey === ownKey;
    return (
      <button
        type="button"
        onClick={() => setSortKey(ownKey)}
        className={cn('inline-flex items-center gap-1 hover:text-accent-soft-fg transition-colors', align === 'right' && 'flex-row-reverse', ativo && 'text-accent-soft-fg')}
      >
        {label}
        <ChevronDown size={10} className={ativo ? 'opacity-100' : 'opacity-0'} />
      </button>
    );
  }

  const colunas: DataTableColumn<Estoque>[] = [
    {
      key: 'peca',
      header: 'Peça',
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
            {item.imagem_url ? (
              <img loading="lazy" src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Package size={16} className="text-text-faint" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-text-primary truncate max-w-[240px]">{item.nome}</p>
            {isEstoqueBaixo(item) ? (
              <p className="text-[11px] text-warning font-medium">Último em estoque</p>
            ) : (
              <p className="text-[11px] text-text-faint truncate">
                {item.codigo} · {item.categoria?.nome || '-'}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'moto',
      header: 'Moto',
      render: (item) => <StatusBadge tom="neutral" texto={item.modelo_moto?.nome ? `${item.modelo_moto.nome}${item.ano ? ` · ${item.ano}` : ''}` : 'Universal'} />,
    },
    {
      key: 'anuncios',
      header: 'Anúncios',
      align: 'center',
      width: '5.5rem',
      render: (item) => (
        <div className="flex items-center justify-center gap-1">
          <AnuncioBadge label="ML" canal="Mercado Livre" url={item.anuncio_ml_url} />
          <AnuncioBadge label="FB" canal="Facebook" url={item.anuncio_fb_url} />
        </div>
      ),
    },
    {
      key: 'valor',
      header: <SortableHeader label="Valor" ownKey="valor" align="right" />,
      align: 'right',
      render: (item) =>
        item.valor > 0 ? (
          <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(item.valor)}</span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
            className="text-sm font-medium text-danger underline underline-offset-2 hover:opacity-80"
          >
            Definir
          </button>
        ),
    },
    {
      key: 'quantidade',
      header: <SortableHeader label="Qtd" ownKey="quantidade" align="right" />,
      align: 'right',
      render: (item) => {
        const tom = item.quantidade === 0 ? 'text-danger' : item.quantidade <= 2 ? 'text-warning' : 'text-positive';
        const dot = item.quantidade === 0 ? 'bg-danger' : item.quantidade <= 2 ? 'bg-warning' : 'bg-positive';
        return (
          <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium tabular-nums', tom)}>
            <span className={cn('size-1.5 rounded-full shrink-0', dot)} />
            {item.quantidade}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Estoque</h1>
          <p className="text-sm text-text-faint mt-0.5">
            {items.length} {items.length === 1 ? 'item' : 'itens'} · {formatCurrency(valorTotalEstoque)} em estoque
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await refreshData();
              setIsRefreshing(false);
            }}
            disabled={loading || isRefreshing}
            className="h-10 px-4 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn((loading || isRefreshing) && 'animate-spin')} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
          <button onClick={openCreateModal} className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90">
            <Plus size={16} /> Nova peça
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-control border border-border-default bg-surface-inset px-4">
          <Search size={16} className="text-text-faint shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar peças por nome, código, categoria ou moto..."
            className="flex-1 py-3.5 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="p-1.5 rounded-full hover:bg-surface-raised text-text-faint">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomDropdown
            theme="dark"
            icon={<Filter size={14} />}
            value={categoriaFiltro}
            onChange={setCategoriaFiltro}
            options={[
              { value: 'Todas', label: 'Todas categorias' },
              ...categoriasIndentadas.map((c) => ({ value: c.id, label: `${'　'.repeat(c.depth)}${c.depth > 0 ? '└ ' : ''}${c.nome}` })),
            ]}
          />
          <CustomDropdown
            theme="dark"
            icon={<Bike size={14} />}
            value={modeloFiltro}
            onChange={setModeloFiltro}
            options={[
              { value: 'Todas', label: 'Todos modelos' },
              ...modelosIndentados.map((m) => ({ value: m.id, label: `${'　'.repeat(m.depth)}${m.depth > 0 ? '└ ' : ''}${m.nome}` })),
            ]}
          />
          <CustomDropdown
            theme="dark"
            value={sortKey}
            onChange={(v) => setSortKey(v as typeof sortKey)}
            options={[
              { value: 'criado_em', label: 'Mais recentes' },
              { value: 'valor', label: 'Maior preço' },
              { value: 'quantidade', label: 'Mais em estoque' },
            ]}
          />
          <button
            onClick={() => setSoEstoqueBaixo((v) => !v)}
            className={cn(
              'h-10 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors',
              soEstoqueBaixo ? 'bg-warning-bg border-warning/30 text-warning' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
            )}
          >
            Estoque baixo
            <span className={cn('px-1.5 py-0.5 rounded-badge text-[10px]', soEstoqueBaixo ? 'bg-warning/20' : 'bg-surface-raised')}>{itensEstoqueBaixo}</span>
            {soEstoqueBaixo && <X size={12} />}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <DataTable
        colunas={colunas}
        dados={loading && items.length === 0 ? [] : paginated}
        getRowKey={(item) => item.id}
        destaqueLinha={isEstoqueBaixo}
        onRowClick={onSelectItem}
        paginaAtual={currentPage}
        totalPaginas={totalPaginas}
        onMudarPagina={setCurrentPage}
        emptyState={
          loading && items.length === 0 ? (
            <div className="py-12 flex items-center justify-center text-text-faint">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <EmptyState
              icone={Package}
              mensagem={items.length === 0 ? 'Nenhuma peça cadastrada ainda.' : 'Nenhum item corresponde aos filtros aplicados.'}
              acaoLabel={items.length === 0 ? 'Cadastrar peça' : undefined}
              onAcao={items.length === 0 ? openCreateModal : undefined}
            />
          )
        }
      />

      {/* Modal criar/editar */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={() => setIsModalOpen(false)}>
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle"
            >
              <div className="md:hidden flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-border-default" />
              </div>
              <div className="flex items-center justify-between p-6 border-b border-border-subtle">
                <h2 className="text-xl font-medium">{editingItem ? 'Editar peça' : 'Nova peça no estoque'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-surface-raised text-text-faint">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className={labelClass}>Foto da peça</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-card border overflow-hidden shrink-0 flex items-center justify-center relative bg-surface-inset border-border-default">
                      {isUploadingImagem ? (
                        <Loader2 size={22} className="animate-spin text-accent" />
                      ) : formData.imagem_url ? (
                        <img src={formData.imagem_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageOff size={22} className="text-text-faint" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider transition-colors border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg">
                        <Upload size={14} />
                        {formData.imagem_url ? 'Trocar foto' : 'Anexar foto'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadImagem(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {formData.imagem_url && (
                        <button type="button" onClick={() => setFormData((prev) => ({ ...prev, imagem_url: '' }))} className="text-xs text-danger hover:underline">
                          Remover foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Nome da peça *</label>
                  <input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: CDI Titan 150" className={inputClass} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Categoria *</label>
                    <CategoriaCascadeSelect
                      theme="dark"
                      categorias={categorias}
                      value={formData.categoria_id || ''}
                      onChange={(id) => {
                        setCategoriaAutoDetectada(false);
                        setFormData({ ...formData, categoria_id: id });
                      }}
                      onCreate={criarCategoria}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Modelo de Moto</label>
                    <MotoCascadeSelect
                      theme="dark"
                      modelos={modelos}
                      value={formData.modelo_moto_id || ''}
                      onChange={(id) => setFormData({ ...formData, modelo_moto_id: id })}
                      onCreate={criarNoMoto}
                      allowEmpty
                      emptyLabel="Universal / não se aplica"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Condição *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, condicao: 'original' })}
                      className={cn(
                        'py-3 rounded-control font-semibold text-xs uppercase tracking-widest border transition-all',
                        formData.condicao === 'original' ? 'bg-positive border-positive text-surface-page' : 'border-border-default text-text-muted'
                      )}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, condicao: 'paralela' })}
                      className={cn(
                        'py-3 rounded-control font-semibold text-xs uppercase tracking-widest border transition-all',
                        formData.condicao === 'paralela' ? 'bg-warning border-warning text-surface-page' : 'border-border-default text-text-muted'
                      )}
                    >
                      Paralela
                    </button>
                  </div>
                </div>

                {formExigeNota && (
                  <div>
                    <label className={labelClass}>Nota fiscal pra cadastro *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, nota_cadastro: 'com_nota' })}
                        className={cn(
                          'py-3 rounded-control font-semibold text-xs uppercase tracking-widest border transition-all',
                          formData.nota_cadastro === 'com_nota' ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted'
                        )}
                      >
                        Com nota pra cadastro
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, nota_cadastro: 'sem_nota' })}
                        className={cn(
                          'py-3 rounded-control font-semibold text-xs uppercase tracking-widest border transition-all',
                          formData.nota_cadastro === 'sem_nota' ? 'bg-danger border-danger text-surface-page' : 'border-border-default text-text-muted'
                        )}
                      >
                        Sem nota pra cadastro
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Valor (R$)</label>
                    <input type="number" min="0" step="0.01" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Quantidade</label>
                    <input type="number" min="0" value={formData.quantidade} onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Ano</label>
                    <input value={formData.ano || ''} onChange={(e) => setFormData({ ...formData, ano: e.target.value })} placeholder="2020" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Anúncios publicados (opcional)</label>
                  <p className="text-xs text-text-faint mb-2">Cole o link do anúncio em cada canal — aparece como badge clicável na coluna "Anúncios" da tabela.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <input
                        value={formData.anuncio_ml_url || ''}
                        onChange={(e) => setFormData({ ...formData, anuncio_ml_url: e.target.value })}
                        placeholder="Link no Mercado Livre"
                        className={cn(inputClass, 'pr-9')}
                      />
                      {formData.anuncio_ml_url && (
                        <a href={formData.anuncio_ml_url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-accent-soft-fg">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        value={formData.anuncio_fb_url || ''}
                        onChange={(e) => setFormData({ ...formData, anuncio_fb_url: e.target.value })}
                        placeholder="Link no Facebook"
                        className={cn(inputClass, 'pr-9')}
                      />
                      {formData.anuncio_fb_url && (
                        <a href={formData.anuncio_fb_url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-accent-soft-fg">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Componentes (opcional)</label>
                  <p className="text-xs text-text-faint mb-2">
                    Se essa peça pode ser vendida em partes separadas (ex: "Mesa Completa" → Superior / Inferior), cadastre os nomes aqui. Na venda você poderá dar baixa de só uma parte, e o item fica sinalizado como incompleto.
                  </p>
                  {(formData.componentes || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(formData.componentes || []).map((c, i) => (
                        <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-inset text-text-secondary">
                          {c}
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, componentes: (prev.componentes || []).filter((_, idx) => idx !== i) }))}
                            className="hover:text-danger"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    value={novoComponente}
                    onChange={(e) => setNovoComponente(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const nomeParte = novoComponente.trim();
                        if (nomeParte && !(formData.componentes || []).includes(nomeParte)) {
                          setFormData((prev) => ({ ...prev, componentes: [...(prev.componentes || []), nomeParte] }));
                        }
                        setNovoComponente('');
                      }
                    }}
                    placeholder="Ex: Inferior — Enter pra adicionar"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Descrição</label>
                  <textarea value={formData.descricao || ''} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} className={inputClass} />
                </div>
              </div>

              <div className="p-6 border-t border-border-subtle">
                <button
                  onClick={handleSave}
                  disabled={isSaving || isUploadingImagem}
                  className="w-full bg-accent disabled:opacity-50 text-white py-4 rounded-control font-semibold text-xs uppercase tracking-[0.2em] shadow-sm flex items-center justify-center gap-2 hover:opacity-90"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm rounded-card border p-6 text-center bg-surface-page border-border-subtle">
              <div className="w-16 h-16 rounded-full bg-danger-bg flex items-center justify-center text-danger mx-auto mb-4">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-lg font-medium mb-2">Excluir "{itemToDelete.nome}"?</h3>
              <p className="text-sm text-text-faint mb-6">Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 rounded-control font-medium text-sm bg-surface-inset text-text-secondary">
                  Cancelar
                </button>
                <button onClick={handleDelete} className="flex-1 py-3 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90">
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
