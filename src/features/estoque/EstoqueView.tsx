// Aba Estoque: catálogo de peças com categoria/modelo de moto (tabelas de
// apoio, com criação rápida inline) e condição Original/Paralela.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Box,
  Package,
  Search,
  Filter,
  Bike,
  ArrowDownAZ,
  RefreshCw,
  Plus,
  Minus,
  Layers,
  Check,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  LayoutGrid,
  Table as TableIcon,
  Upload,
  ImageOff,
} from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useDebounce } from '../../hooks/useDebounce';
import { CustomDropdown } from '../../components/CustomDropdown';
import { CatalogSelect } from '../../components/CatalogSelect';
import { SkeletonRow } from '../../components/SkeletonRow';
import { estoqueApi, uploadImagemEstoque } from './api';
import { encontrarCategoriaPorNome } from './matchCategoria';
import type { CondicaoPeca, Estoque, EstoqueInput } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const CONDICAO_LABEL: Record<CondicaoPeca, string> = { original: 'Original', paralela: 'Paralela' };

const EMPTY_FORM: EstoqueInput = {
  nome: '',
  categoria_id: '',
  modelo_moto_id: '',
  condicao: 'original',
  ano: '',
  valor: 0,
  quantidade: 1,
  imagem_url: '',
  descricao: '',
  ativo: true,
};

interface EstoqueViewProps {
  theme: 'light' | 'dark';
  onSelectItem: (item: Estoque) => void;
  onRegisterActions?: (actions: { edit: (item: Estoque) => void; delete: (id: string) => void; focusSearch?: () => void }) => void;
  pendingEditItem?: Estoque | null;
  setPendingEditItem?: (item: Estoque | null) => void;
}

export function EstoqueView({ theme, onSelectItem, onRegisterActions, pendingEditItem, setPendingEditItem }: EstoqueViewProps) {
  const { estoque: items, setEstoque, loading, refreshData } = useData();
  const { categorias, modelos, criarCategoria, criarModelo } = useCatalogos();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>(window.innerWidth < 768 ? 'card' : 'table');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [modeloFiltro, setModeloFiltro] = useState('Todas');
  const [condicaoFiltro, setCondicaoFiltro] = useState<'Todas' | CondicaoPeca>('Todas');
  const [sortKey, setSortKey] = useState<'criado_em' | 'valor' | 'nome' | 'quantidade'>('criado_em');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = window.innerWidth < 768 ? 10 : 25;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Estoque | null>(null);
  const [formData, setFormData] = useState<EstoqueInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImagem, setIsUploadingImagem] = useState(false);
  // Enquanto true, a categoria é escolhida automaticamente com base no nome
  // digitado. Vira false assim que o usuário mexe manualmente no dropdown.
  const [categoriaAutoDetectada, setCategoriaAutoDetectada] = useState(true);

  const [itemToDelete, setItemToDelete] = useState<Estoque | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [bulkCategoriaId, setBulkCategoriaId] = useState('');

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setCategoriaAutoDetectada(true);
    setIsModalOpen(true);
  };

  const openEditModal = useCallback((item: Estoque) => {
    setEditingItem(item);
    setCategoriaAutoDetectada(false);
    setFormData({
      nome: item.nome,
      categoria_id: item.categoria_id || '',
      modelo_moto_id: item.modelo_moto_id || '',
      condicao: item.condicao,
      ano: item.ano || '',
      valor: item.valor,
      quantidade: item.quantidade,
      imagem_url: item.imagem_url || '',
      descricao: item.descricao || '',
      ativo: item.ativo,
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

  useEffect(() => {
    if (pendingEditItem && setPendingEditItem) {
      openEditModal(pendingEditItem);
      setPendingEditItem(null);
    }
  }, [pendingEditItem, setPendingEditItem, openEditModal]);

  useEffect(() => {
    onRegisterActions?.({
      edit: openEditModal,
      delete: (id: string) => {
        const item = items.find((i) => i.id === id);
        if (item) setItemToDelete(item);
      },
    });
  }, [onRegisterActions, openEditModal, items]);

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
      const matchesCategoria = categoriaFiltro === 'Todas' || item.categoria_id === categoriaFiltro;
      const matchesModelo = modeloFiltro === 'Todas' || item.modelo_moto_id === modeloFiltro;
      const matchesCondicao = condicaoFiltro === 'Todas' || item.condicao === condicaoFiltro;
      return matchesSearch && matchesCategoria && matchesModelo && matchesCondicao;
    });

    result = [...result].sort((a, b) => {
      if (sortKey === 'nome') return a.nome.localeCompare(b.nome, 'pt');
      if (sortKey === 'valor') return b.valor - a.valor;
      if (sortKey === 'quantidade') return b.quantidade - a.quantidade;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });
    return result;
  }, [items, debouncedSearch, categoriaFiltro, modeloFiltro, condicaoFiltro, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => setCurrentPage(1), [debouncedSearch, categoriaFiltro, modeloFiltro, condicaoFiltro]);

  const toggleSelect = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === paginated.length ? [] : paginated.map((i) => i.id));

  const handleSave = async () => {
    if (!formData.nome.trim()) return alert('Nome da peça é obrigatório');
    if (!formData.categoria_id) return alert('Selecione uma categoria');

    setIsSaving(true);
    const payload: EstoqueInput = {
      ...formData,
      valor: Number(formData.valor) || 0,
      quantidade: Math.max(0, Number(formData.quantidade) || 0),
      modelo_moto_id: formData.modelo_moto_id || null,
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
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    setItemToDelete(null);
    try {
      const result = await estoqueApi.excluir(id);
      if (!result.success) throw new Error(result.error);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir item');
      refreshData();
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    setIsBulkDeleteOpen(false);
    setEstoque((prev) => prev.filter((i) => !ids.includes(i.id)));
    setSelectedIds([]);
    try {
      const result = await estoqueApi.excluirEmLote(ids);
      if (!result.success) throw new Error(result.error);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir itens');
      refreshData();
    }
  };

  const handleBulkQuantidade = async (delta: number) => {
    const ids = [...selectedIds];
    setEstoque((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, quantidade: Math.max(0, i.quantidade + delta) } : i)));
    try {
      const result = await estoqueApi.ajustarQuantidadeEmLote(ids, delta);
      if (!result.success) throw new Error(result.error);
    } catch (err: any) {
      alert(err.message || 'Erro ao ajustar quantidade');
      refreshData();
    }
  };

  const handleBulkCategoria = async () => {
    if (!bulkCategoriaId) return;
    const ids = [...selectedIds];
    setIsBulkCategoryOpen(false);
    const categoria = categorias.find((c) => c.id === bulkCategoriaId);
    setEstoque((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, categoria_id: bulkCategoriaId, categoria } : i)));
    setSelectedIds([]);
    setBulkCategoriaId('');
    try {
      const result = await estoqueApi.atualizarCategoriaEmLote(ids, bulkCategoriaId);
      if (!result.success) throw new Error(result.error);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar categoria');
      refreshData();
    }
  };

  const inputClass = cn(
    'w-full border rounded-xl py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-violet-500/50',
    theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-900'
  );
  const labelClass = cn('text-xs font-bold uppercase tracking-wider mb-1.5 block', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600');

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Filtros */}
      <div className="space-y-3">
        <div className={cn('flex items-center gap-3 rounded-2xl border px-4', theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700' : 'bg-white border-zinc-200')}>
          <Search size={18} className="text-zinc-500 shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar peças por nome, código, categoria ou moto..."
            className="flex-1 py-3.5 bg-transparent outline-none text-sm"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="p-1.5 rounded-full hover:bg-zinc-800/50 text-zinc-500">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CustomDropdown
              theme={theme}
              icon={<Filter size={14} />}
              value={categoriaFiltro}
              onChange={setCategoriaFiltro}
              options={[{ value: 'Todas', label: 'Todas categorias' }, ...categorias.map((c) => ({ value: c.id, label: c.nome }))]}
            />
            <CustomDropdown
              theme={theme}
              icon={<Bike size={14} />}
              value={modeloFiltro}
              onChange={setModeloFiltro}
              options={[{ value: 'Todas', label: 'Todos modelos' }, ...modelos.map((m) => ({ value: m.id, label: m.nome }))]}
            />
            <CustomDropdown
              theme={theme}
              value={condicaoFiltro}
              onChange={(v) => setCondicaoFiltro(v as 'Todas' | CondicaoPeca)}
              options={[
                { value: 'Todas', label: 'Original e Paralela' },
                { value: 'original', label: 'Só Original' },
                { value: 'paralela', label: 'Só Paralela' },
              ]}
            />
            <CustomDropdown
              theme={theme}
              icon={<ArrowDownAZ size={14} />}
              value={sortKey}
              onChange={(v) => setSortKey(v as typeof sortKey)}
              options={[
                { value: 'criado_em', label: 'Mais recentes' },
                { value: 'valor', label: 'Maior preço' },
                { value: 'nome', label: 'Ordem alfabética' },
                { value: 'quantidade', label: 'Mais em estoque' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode((v) => (v === 'table' ? 'card' : 'table'))}
              className={cn('h-10 w-10 rounded-xl border flex items-center justify-center transition-colors', theme === 'dark' ? 'border-zinc-800 text-zinc-400 hover:bg-zinc-800' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100')}
              title="Alternar visualização"
            >
              {viewMode === 'table' ? <LayoutGrid size={16} /> : <TableIcon size={16} />}
            </button>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await refreshData();
                setIsRefreshing(false);
              }}
              disabled={loading || isRefreshing}
              className={cn('h-10 px-4 rounded-xl border text-[11px] font-bold uppercase tracking-wider flex items-center gap-2', theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700 text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-600')}
            >
              <RefreshCw size={14} className={cn((loading || isRefreshing) && 'animate-spin')} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
            <button
              onClick={openCreateModal}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-md flex items-center gap-2"
            >
              <Plus size={16} /> Novo Item
            </button>
          </div>
        </div>
      </div>

      {/* Barra de ações em lote */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn('fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl', theme === 'dark' ? 'bg-zinc-900/90 border-zinc-800 text-white' : 'bg-white/90 border-zinc-200 text-zinc-900')}
          >
            <span className="text-sm font-medium">{selectedIds.length} selecionado(s)</span>
            <div className={cn('flex items-center gap-2 border-l pl-4', theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200')}>
              <button onClick={() => handleBulkQuantidade(1)} className="p-2 rounded-lg text-emerald-400 hover:bg-zinc-800" title="Aumentar quantidade">
                <Plus size={18} />
              </button>
              <button onClick={() => handleBulkQuantidade(-1)} className="p-2 rounded-lg text-rose-400 hover:bg-zinc-800" title="Diminuir quantidade">
                <Minus size={18} />
              </button>
              <button onClick={() => setIsBulkCategoryOpen(true)} className="p-2 rounded-lg text-violet-400 hover:bg-zinc-800" title="Mudar categoria">
                <Layers size={18} />
              </button>
              <button onClick={() => setIsBulkDeleteOpen(true)} className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10" title="Excluir selecionados">
                <Trash2 size={18} />
              </button>
            </div>
            <button onClick={() => setSelectedIds([])} className="text-xs text-zinc-500 hover:text-zinc-300">
              Desmarcar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista */}
      <div className={cn('border rounded-2xl overflow-hidden', theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-white border-zinc-200 shadow-sm')}>
        <div className={cn('p-4 md:p-6 border-b flex items-center justify-between', theme === 'dark' ? 'border-zinc-800/50 bg-zinc-900/10' : 'border-zinc-100 bg-zinc-50/50')}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', theme === 'dark' ? 'bg-zinc-800 text-violet-400' : 'bg-white text-violet-600 border border-zinc-100')}>
              <Box size={20} />
            </div>
            <h3 className={cn('text-lg font-bold tracking-tight', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Estoque de Peças</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{filtered.length} itens</span>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className={cn(theme === 'dark' ? 'bg-zinc-800/30' : 'bg-zinc-50')}>
                  <th className="px-3 py-2 w-10">
                    <div
                      onClick={toggleSelectAll}
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center cursor-pointer',
                        selectedIds.length === paginated.length && paginated.length > 0 ? 'bg-violet-600 border-violet-600' : theme === 'dark' ? 'border-zinc-700' : 'border-zinc-300'
                      )}
                    >
                      {selectedIds.length === paginated.length && paginated.length > 0 && <Check className="text-white" size={10} />}
                    </div>
                  </th>
                  {['Peça', 'Categoria', 'Moto', 'Condição', 'Valor', 'Qtd', 'Ano', 'Código', 'Ações'].map((label) => (
                    <th key={label} className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cn('divide-y', theme === 'dark' ? 'divide-zinc-800/30' : 'divide-zinc-100')}>
                {loading && items.length === 0
                  ? Array(8)
                      .fill(0)
                      .map((_, i) => <SkeletonRow key={i} theme={theme} />)
                  : paginated.map((item) => (
                      <tr key={item.id} onClick={() => onSelectItem(item)} className={cn('cursor-pointer group', selectedIds.includes(item.id) ? (theme === 'dark' ? 'bg-violet-500/10' : 'bg-violet-50') : theme === 'dark' ? 'hover:bg-zinc-800/20' : 'hover:bg-zinc-50')}>
                        <td className="px-3 py-2">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(item.id);
                            }}
                            className={cn('w-4 h-4 rounded border flex items-center justify-center', selectedIds.includes(item.id) ? 'bg-violet-600 border-violet-600' : 'opacity-0 group-hover:opacity-100 border-zinc-700')}
                          >
                            {selectedIds.includes(item.id) && <Check className="text-white" size={10} />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-medium">{item.nome}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={cn('px-2 py-1 rounded-lg text-[10px] font-bold uppercase', theme === 'dark' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-zinc-100 text-zinc-600')}>{item.categoria?.nome || '-'}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={cn('px-2 py-1 rounded-lg text-[10px] font-bold uppercase border', theme === 'dark' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-100 text-zinc-600 border-zinc-200')}>{item.modelo_moto?.nome || 'Universal'}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={cn('px-2 py-1 rounded-lg text-[10px] font-bold uppercase', item.condicao === 'original' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>{CONDICAO_LABEL[item.condicao]}</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-emerald-500">{formatCurrency(item.valor)}</td>
                        <td className={cn('px-3 py-2 text-xs font-bold', item.quantidade === 0 && 'text-rose-500')}>{item.quantidade}</td>
                        <td className="px-3 py-2 text-xs text-zinc-500">{item.ano || '-'}</td>
                        <td className="px-3 py-2 text-[10px] text-zinc-500 font-mono">{item.codigo}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(item);
                              }}
                              className={cn('p-2 rounded-lg', theme === 'dark' ? 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20' : 'text-zinc-400 hover:text-violet-600 hover:bg-violet-50')}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete(item);
                              }}
                              className={cn('p-2 rounded-lg', theme === 'dark' ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'text-zinc-400 hover:text-rose-600 hover:bg-rose-50')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-3 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {paginated.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={cn(
                  'group relative flex flex-col rounded-2xl border cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl',
                  selectedIds.includes(item.id) ? (theme === 'dark' ? 'bg-violet-500/10 border-violet-500/50' : 'bg-violet-50 border-violet-300') : theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-white border-zinc-200'
                )}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(item.id);
                  }}
                  className={cn('absolute top-3 left-3 z-10 w-6 h-6 rounded-md border flex items-center justify-center', selectedIds.includes(item.id) ? 'bg-violet-600 border-violet-600' : 'opacity-0 group-hover:opacity-100 bg-zinc-900/80 border-zinc-600')}
                >
                  {selectedIds.includes(item.id) && <Check className="text-white" size={14} strokeWidth={3} />}
                </div>
                <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(item);
                    }}
                    className="p-2 rounded-xl bg-zinc-900/90 text-violet-400 hover:bg-violet-500 hover:text-white shadow-lg"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(item);
                    }}
                    className="p-2 rounded-xl bg-zinc-900/90 text-rose-400 hover:bg-rose-500 hover:text-white shadow-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className={cn('relative aspect-video w-full overflow-hidden border-b', theme === 'dark' ? 'border-zinc-800/50 bg-zinc-950' : 'border-zinc-100 bg-zinc-50')}>
                  {item.imagem_url ? (
                    <img loading="lazy" src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <Package size={48} />
                    </div>
                  )}
                  <div className="absolute top-3 left-11 flex gap-2">
                    <span className={cn('px-2 py-1 rounded-full text-[9px] font-black uppercase shadow-md', item.quantidade > 0 ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white')}>
                      {item.quantidade > 0 ? `${item.quantidade} UN` : 'ESGOTADO'}
                    </span>
                  </div>
                </div>

                <div className="p-3 md:p-4 flex flex-col flex-1">
                  <h4 className={cn('font-bold text-sm leading-tight line-clamp-2 mb-2', theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900')}>{item.nome}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-400 border-violet-500/20">{item.categoria?.nome || '-'}</span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-zinc-800 text-zinc-400 border-zinc-700">{item.modelo_moto?.nome || 'Universal'}</span>
                    <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full', item.condicao === 'original' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>{CONDICAO_LABEL[item.condicao]}</span>
                  </div>
                  <div className="mt-auto pt-3 border-t border-zinc-800/20 flex items-center justify-between">
                    <span className="font-black text-emerald-500 text-sm">{formatCurrency(item.valor)}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{item.codigo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center gap-3">
            <Box size={48} strokeWidth={1} className="opacity-20" />
            <p className="text-sm font-medium">{items.length === 0 ? 'Nenhuma peça cadastrada ainda.' : 'Nenhum item corresponde aos filtros aplicados.'}</p>
          </div>
        )}

        {/* Paginação */}
        <div className={cn('p-4 border-t flex flex-wrap items-center justify-between gap-4', theme === 'dark' ? 'bg-zinc-900/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200')}>
          <span className="text-sm text-zinc-500">
            {filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border rounded-lg disabled:opacity-30 text-sm border-zinc-800">
              Anterior
            </button>
            <span className="px-3 py-1.5 text-sm text-zinc-400">
              Página {currentPage} de {totalPages}
            </span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 border rounded-lg disabled:opacity-30 text-sm border-zinc-800">
              Próximo
            </button>
          </div>
        </div>
      </div>

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
              className={cn('relative w-full max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] flex flex-col overflow-hidden rounded-t-[2.5rem] md:rounded-[2.5rem]', theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900')}
            >
              <div className="md:hidden flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-zinc-800" />
              </div>
              <div className={cn('flex items-center justify-between p-6 border-b', theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200')}>
                <h2 className="text-xl font-black">{editingItem ? 'Editar Peça' : 'Nova Peça no Estoque'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-zinc-800/50 text-zinc-500">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className={labelClass}>Foto da peça</label>
                  <div className="flex items-center gap-4">
                    <div className={cn('w-24 h-24 rounded-2xl border overflow-hidden shrink-0 flex items-center justify-center relative', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200')}>
                      {isUploadingImagem ? (
                        <Loader2 size={22} className="animate-spin text-violet-500" />
                      ) : formData.imagem_url ? (
                        <img src={formData.imagem_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageOff size={22} className="text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label
                        className={cn(
                          'flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed cursor-pointer text-xs font-bold uppercase tracking-wider transition-colors',
                          theme === 'dark' ? 'border-zinc-800 text-zinc-400 hover:border-violet-500/50 hover:text-violet-400' : 'border-zinc-300 text-zinc-500 hover:border-violet-400 hover:text-violet-600'
                        )}
                      >
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
                        <button type="button" onClick={() => setFormData((prev) => ({ ...prev, imagem_url: '' }))} className="text-xs text-rose-500 hover:underline">
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
                    <CatalogSelect
                      theme={theme}
                      value={formData.categoria_id || ''}
                      onChange={(id) => {
                        setCategoriaAutoDetectada(false);
                        setFormData({ ...formData, categoria_id: id });
                      }}
                      options={categorias}
                      onCreate={criarCategoria}
                      placeholder="Selecione..."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Modelo de Moto</label>
                    <CatalogSelect
                      theme={theme}
                      value={formData.modelo_moto_id || ''}
                      onChange={(id) => setFormData({ ...formData, modelo_moto_id: id })}
                      options={modelos}
                      onCreate={criarModelo}
                      allowEmpty
                      emptyLabel="Universal / não se aplica"
                      placeholder="Selecione..."
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Condição *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, condicao: 'original' })}
                      className={cn('py-3 rounded-xl font-black text-xs uppercase tracking-widest border transition-all', formData.condicao === 'original' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-800 text-zinc-400')}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, condicao: 'paralela' })}
                      className={cn('py-3 rounded-xl font-black text-xs uppercase tracking-widest border transition-all', formData.condicao === 'paralela' ? 'bg-amber-500 border-amber-500 text-white' : 'border-zinc-800 text-zinc-400')}
                    >
                      Paralela
                    </button>
                  </div>
                </div>

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
                  <label className={labelClass}>Descrição</label>
                  <textarea value={formData.descricao || ''} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} className={inputClass} />
                </div>
              </div>

              <div className={cn('p-6 border-t', theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200')}>
                <button
                  onClick={handleSave}
                  disabled={isSaving || isUploadingImagem}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão individual */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn('w-full max-w-sm rounded-3xl border p-6 text-center', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}>
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-4">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-lg font-black mb-2">Excluir "{itemToDelete.nome}"?</h3>
              <p className="text-sm text-zinc-500 mb-6">Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-zinc-900 text-zinc-300">
                  Cancelar
                </button>
                <button onClick={handleDelete} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600">
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão em lote */}
      <AnimatePresence>
        {isBulkDeleteOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn('w-full max-w-sm rounded-3xl border p-6 text-center', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}>
              <h3 className="text-lg font-black mb-2">Excluir {selectedIds.length} itens?</h3>
              <p className="text-sm text-zinc-500 mb-6">Essa ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button onClick={() => setIsBulkDeleteOpen(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-zinc-900 text-zinc-300">
                  Cancelar
                </button>
                <button onClick={handleBulkDelete} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600">
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mudar categoria em lote */}
      <AnimatePresence>
        {isBulkCategoryOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn('w-full max-w-sm rounded-3xl border p-6', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}>
              <h3 className="text-lg font-black mb-4">Mudar categoria de {selectedIds.length} itens</h3>
              <CatalogSelect theme={theme} value={bulkCategoriaId} onChange={setBulkCategoriaId} options={categorias} onCreate={criarCategoria} placeholder="Selecione a categoria..." />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setIsBulkCategoryOpen(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-zinc-900 text-zinc-300">
                  Cancelar
                </button>
                <button onClick={handleBulkCategoria} disabled={!bulkCategoriaId} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                  Aplicar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
