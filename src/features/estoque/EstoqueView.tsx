// Aba Estoque: catálogo de peças com categoria/modelo de moto (tabelas de
// apoio, com criação rápida inline) e condição Original/Paralela.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { Column, ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import {
  Package,
  Bike,
  RefreshCw,
  Plus,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  Download,
  Pencil,
  Network,
  Send,
  Merge,
} from 'lucide-react';
import { cn } from '../../utils';
import { Button } from '../../components/ui/button';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useDebounce } from '../../hooks/useDebounce';
import { MotoCascadeSelect } from '../../components/MotoCascadeSelect';
import { CategoriaCascadeSelect } from '../../components/CategoriaCascadeSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { Switch } from '../../components/ui/switch';
import { estoqueApi, uploadImagemEstoque } from './api';
import { EstoqueFiltrosPopover } from './EstoqueFiltrosPopover';
import { EstoqueBuscaSugestoes } from './EstoqueBuscaSugestoes';
import { EstoqueUploadFotos } from './EstoqueUploadFotos';
import { EstoqueAnunciosMlEditor } from './EstoqueAnunciosMlEditor';
import { EstoquePublicarMlModal } from './EstoquePublicarMlModal';
import { EstoqueAnunciosShopeeLista } from './EstoqueAnunciosShopeeLista';
import { EstoquePublicarShopeeModal } from './EstoquePublicarShopeeModal';
import { Expandable, ExpandableContent, ExpandableTrigger } from '../../components/ui/expandable';
import { EstoqueItemExpandido } from './EstoqueItemExpandido';
import { SPRING_MICRO } from '../../components/ui/motion';
import { AnimatedNumber } from '../../components/ui/animated-number';
import { Tabs, TabsList, TabsTrigger } from '../../components/animate-ui/components/animate/tabs';
import { useRemocaoFundoFotos } from './useRemocaoFundoFotos';
import { encontrarCategoriaPorNome } from './matchCategoria';
import { encontrarModeloPorNome } from './matchModelo';
import { categoriaExigeNota } from './categoriaMotor';
import { comprimirImagem, formatarBytes } from '../../utils/comprimirImagem';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/formatters';
import { CondicaoNotaPicker } from './CondicaoNotaPicker';
import { detectarDuplicatas } from './detectarDuplicata';
import { calcularResumoDoDia } from './resumoDoDia';
import { valorTotalEstoque as somarValorEstoque, valorTotalItem, contarAvarias, temAvaria, contarFichas, isEstoqueBaixo } from './valorEstoque';
import { gerarCsvEstoque } from './planilha';
import { ImportarPlanilhaModal } from './ImportarPlanilhaModal';
import { EstoqueByMoto } from './EstoqueByMoto';
import { CondicaoNotaBadge } from './CondicaoNotaBadge';
import { PromocaoBadge } from '../promocoes/PromocaoBadge';
import { baixarCsv } from '../../utils/csv';
import { aviso } from '../../components/ui/toast';
import { buildTree as buildCategoriaTree, getDescendantIds } from '../categorias/categoriaTree';
import { buildTree as buildMotoTree, getDescendantIds as getDescendantIdsMoto } from '../motos/motoTree';
import { CategoriaOrgChart } from '../categorias/CategoriaOrgChart';
import { MotoOrgChart } from '../motos/MotoOrgChart';
import { sumWithDescendants } from '../../utils/tree';
import type { TreeDropdownNode } from '../../components/TreeDropdown';
import type { CondicaoPeca, Estoque, EstoqueInput } from './types';
import { agruparLinhasTabela, filtrarLinhaTexto, emEstoqueFamilia, faixaPrecoFamilia, type EstoqueLinha } from './familiaEstoque';
import { EstoqueFamiliaModal } from './EstoqueFamiliaModal';
import { EstoqueFundirFamiliasModal } from './EstoqueFundirFamiliasModal';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

// Tipografia dos alternadores de visualização (Tabs animadas). Mantém a caixa
// alta miúda que o alternador manual usava — o default do wrapper animate-ui é
// text-sm/font-medium, que destoaria dos outros chips desta tela.
const TRIGGER_CLASS = 'px-3 text-[11px] font-semibold uppercase tracking-wider';
const SUB_TRIGGER_CLASS = 'px-2.5 text-[10.5px] font-semibold uppercase tracking-wider';

const ITEMS_PER_PAGE = 25;

// Janela pra clicar em "Desfazer" antes da exclusão ir pro banco.
const MS_PARA_DESFAZER = 6000;

const EMPTY_FORM: EstoqueInput = {
  nome: '',
  categoria_id: '',
  modelo_moto_id: '',
  condicao: 'original',
  condicao_nota: null,
  nota_cadastro: null,
  ano: '',
  valor: 0,
  quantidade: 1,
  imagens: [],
  descricao: '',
  ativo: true,
  componentes: null,
  anuncio_fb_url: '',
  modelo_moto_compativel_ids: [],
};

// Badge quadrado de anúncio (ML/FB) — colorido e clicável quando existe pelo
// menos 1 link, esmaecido e inerte quando não existe. Nunca decorativo: a
// cor (positive) sinaliza "publicado", não é escolha estética. ML pode ter
// vários links (migration_025) — o número aparece ao lado do label quando
// há mais de 1, e o clique decide sozinho (abrir direto ou levar pra edição)
// via `onAbrir`, que quem chama define de acordo com a contagem.
function AnuncioBadge({ label, canal, count, onAbrir }: { label: string; canal: string; count: number; onAbrir: () => void }) {
  const ativo = count > 0;
  return (
    <button
      type="button"
      disabled={!ativo}
      onClick={(e) => {
        e.stopPropagation();
        if (ativo) onAbrir();
      }}
      title={ativo ? `Ver anúncio${count > 1 ? `s (${count})` : ''} no ${canal}` : `Sem anúncio no ${canal}`}
      className={cn(
        'h-6 min-w-6 px-1 rounded-badge text-[9px] font-bold flex items-center justify-center gap-0.5 shrink-0 transition-opacity',
        ativo ? 'bg-positive-bg text-positive hover:opacity-80 cursor-pointer' : 'bg-surface-inset text-text-faint cursor-default'
      )}
    >
      {label}
      {count > 1 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

// Cabeçalho clicável reaproveitado pelas colunas Peça/Valor/Qtd — 3 estados
// do próprio TanStack (asc -> desc -> nenhum) em vez do sortKey único-sentido
// de antes.
function SortableHead({ column, label, align }: { column: Column<Estoque, unknown>; label: string; align?: 'right' }) {
  const ordenado = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn('inline-flex items-center gap-1 hover:text-accent-soft-fg transition-colors', align === 'right' && 'flex-row-reverse', ordenado && 'text-accent-soft-fg')}
    >
      {label}
      <ChevronDown size={10} className={cn('transition-transform', ordenado ? 'opacity-100' : 'opacity-0', ordenado === 'asc' && 'rotate-180')} />
    </button>
  );
}

function alinhamentoDaColuna(id: string) {
  if (id === 'valor' || id === 'quantidade') return 'text-right';
  if (id === 'anuncios') return 'text-center';
  return 'text-left';
}

function larguraDaColuna(id: string): string | undefined {
  return id === 'anuncios' ? '5.5rem' : undefined;
}

interface EstoqueViewProps {
  onSelectItem: (item: Estoque) => void;
  onRegisterActions?: (actions: { edit: (item: Estoque) => void; delete: (id: string) => void; focusSearch?: () => void }) => void;
  pendingEditItem?: Estoque | null;
  setPendingEditItem?: (item: Estoque | null) => void;
  // Chega true quando outra tela (ex: AlertBar do Dashboard) navega pra cá
  // pedindo pra já abrir com o filtro de estoque baixo ativo. Consumido uma
  // única vez e resetado, mesmo padrão do pendingEditItem acima.
  filtroEstoqueBaixoInicial?: boolean;
  setFiltroEstoqueBaixoInicial?: (value: boolean) => void;
  // Papel 'estoque_leitura' (Eloisa): só consulta, sem criar/editar/excluir.
  readOnly?: boolean;
}

export function EstoqueView({
  onSelectItem,
  onRegisterActions,
  pendingEditItem,
  setPendingEditItem,
  filtroEstoqueBaixoInicial,
  setFiltroEstoqueBaixoInicial,
  readOnly = false,
}: EstoqueViewProps) {
  const { estoque: items, setEstoque, loading, estoqueError, refreshData } = useData();
  const { categorias, modelos, criarCategoria, criarNoMoto } = useCatalogos();
  // Abertura da linha expandida vira instantânea pra quem pediu menos movimento.
  const reduzirMovimento = useReducedMotion();
  const transicaoExpansao = reduzirMovimento ? { duration: 0 } : SPRING_MICRO;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visualizacao, setVisualizacao] = useState<'lista' | 'por_moto' | 'organograma'>('lista');
  const [orgChartDominio, setOrgChartDominio] = useState<'categorias' | 'motos'>('categorias');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [modeloFiltro, setModeloFiltro] = useState('Todas');
  const [soEstoqueBaixo, setSoEstoqueBaixo] = useState(false);
  // Peça cadastrada às pressas costuma ficar sem preço — este filtro é como
  // se volta nelas depois pra fechar o valor do estoque.
  const [soSemPreco, setSoSemPreco] = useState(false);
  const [soComAvaria, setSoComAvaria] = useState(false);
  const [soSemFoto, setSoSemFoto] = useState(false);
  const [soSemLinkMl, setSoSemLinkMl] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: ITEMS_PER_PAGE });
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggleExpandido = useCallback((id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Estoque | null>(null);
  const [familiaModalLinha, setFamiliaModalLinha] = useState<EstoqueLinha | null>(null);
  const [fundirModalAberto, setFundirModalAberto] = useState(false);
  const [formData, setFormData] = useState<EstoqueInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImagem, setIsUploadingImagem] = useState(false);
  // Enquanto true, a categoria é escolhida automaticamente com base no nome
  // digitado. Vira false assim que o usuário mexe manualmente no dropdown.
  const [categoriaAutoDetectada, setCategoriaAutoDetectada] = useState(true);
  // Mesma lógica, agora pro modelo de moto.
  const [modeloAutoDetectado, setModeloAutoDetectado] = useState(true);
  const [novoComponente, setNovoComponente] = useState('');
  // Controle do bloco "também serve em": enquanto true, mostra o
  // MotoCascadeSelect temporário pra escolher o próximo modelo compatível.
  const [adicionandoCompativel, setAdicionandoCompativel] = useState(false);
  const [compatTempId, setCompatTempId] = useState('');

  const [itemToDelete, setItemToDelete] = useState<Estoque | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  // Progressive disclosure: quem só cola o link de um anúncio já existente
  // (fluxo de sempre) nunca vê o formulário novo de publicação. Estado local
  // só de UI, reseta a cada peça aberta — não é preferência salva.
  const [publicarMlAtivo, setPublicarMlAtivo] = useState(false);
  const [publicarMlAberto, setPublicarMlAberto] = useState(false);
  // Mesmo padrão do Mercado Livre acima, segundo canal — estado local
  // independente (os dois toggles não têm relação entre si).
  const [publicarShopeeAtivo, setPublicarShopeeAtivo] = useState(false);
  const [publicarShopeeAberto, setPublicarShopeeAberto] = useState(false);
  // Instanciado aqui (não dentro do modal) pra que a remoção de fundo comece
  // a processar assim que o toggle acima é ligado — antes do modal
  // "Configurar e publicar" sequer existir. Ver useRemocaoFundoFotos.ts.
  const remocaoFundo = useRemocaoFundoFotos();
  // Quantas peças saíram deste modal sem ele fechar — feedback do
  // "salvar e cadastrar próxima" durante a catalogação em massa.
  const [salvasEmSequencia, setSalvasEmSequencia] = useState(0);
  // Quanto a foto encolheu no celular antes de subir; some no próximo upload.
  const [resumoCompressao, setResumoCompressao] = useState<string | null>(null);
  // Foco volta pro nome a cada peça salva em sequência: é sempre o primeiro
  // campo a preencher e evita ter que buscar o cursor com a mão.
  const inputNomeRef = useRef<HTMLInputElement>(null);

  // Categoria Motor (ou subcategoria dela) exige informar nota fiscal pra cadastro.
  const formExigeNota = useMemo(() => categoriaExigeNota(formData.categoria_id || null, categorias), [formData.categoria_id, categorias]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setCategoriaAutoDetectada(true);
    setModeloAutoDetectado(true);
    setNovoComponente('');
    setAdicionandoCompativel(false);
    setCompatTempId('');
    setResumoCompressao(null);
    setSalvasEmSequencia(0);
    setPublicarMlAtivo(false);
    remocaoFundo.limparTudo();
    setIsModalOpen(true);
  };

  const openEditModal = useCallback((item: Estoque) => {
    setEditingItem(item);
    setCategoriaAutoDetectada(false);
    setModeloAutoDetectado(false);
    setNovoComponente('');
    setAdicionandoCompativel(false);
    setCompatTempId('');
    setResumoCompressao(null);
    setSalvasEmSequencia(0);
    setPublicarMlAtivo(false);
    remocaoFundo.limparTudo();
    setFormData({
      nome: item.nome,
      categoria_id: item.categoria_id || '',
      modelo_moto_id: item.modelo_moto_id || '',
      condicao: item.condicao,
      condicao_nota: item.condicao_nota,
      nota_cadastro: item.nota_cadastro,
      ano: item.ano || '',
      valor: item.valor,
      quantidade: item.quantidade,
      imagens: item.imagens ?? [],
      descricao: item.descricao || '',
      ativo: item.ativo,
      componentes: item.componentes,
      anuncio_fb_url: item.anuncio_fb_url || '',
      modelo_moto_compativel_ids: (item.modelos_compativeis ?? []).map((m) => m.id),
    });
    setIsModalOpen(true);
    // remocaoFundo fora das deps de propósito: o objeto muda de identidade a
    // cada render (nunca é memoizado — ver useRemocaoFundoFotos.ts), então
    // incluí-lo aqui só quebraria a estabilidade do useCallback sem
    // necessidade; a função limparTudo em si é estável (useCallback interno
    // do hook), então chamá-la via closure é seguro mesmo sem declarar dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clique no badge "ML" da tabela: com 1 link só, vai direto pro anúncio;
  // com 2+, não dá pra escolher sozinho qual abrir — leva pra edição, onde
  // os links aparecem todos listados.
  const abrirAnunciosMl = useCallback(
    (item: Estoque) => {
      const links = item.links_ml ?? [];
      if (links.length === 1) window.open(links[0].url, '_blank', 'noopener,noreferrer');
      else openEditModal(item);
    },
    [openEditModal]
  );

  // Mesmo raciocínio de abrirAnunciosMl acima, pro badge "SHOPEE".
  const abrirAnunciosShopee = useCallback(
    (item: Estoque) => {
      const links = item.links_shopee ?? [];
      if (links.length === 1 && links[0].url) window.open(links[0].url, '_blank', 'noopener,noreferrer');
      else openEditModal(item);
    },
    [openEditModal]
  );

  // Ao digitar o nome de uma peça nova, tenta achar a categoria já cadastrada
  // que combina com as palavras digitadas e seleciona sozinho. Só age em
  // itens novos e só enquanto o usuário não escolheu a categoria na mão —
  // e some de novo se o texto for apagado a ponto de não bater com nada mais.
  useEffect(() => {
    if (editingItem || !categoriaAutoDetectada) return;
    const match = encontrarCategoriaPorNome(formData.nome, categorias);
    const novoId = match?.id ?? '';
    if (novoId !== formData.categoria_id) {
      setFormData((prev) => ({ ...prev, categoria_id: novoId }));
    }
  }, [formData.nome, categorias, editingItem, categoriaAutoDetectada]);

  // Mesma auto-detecção, agora pro modelo de moto — espelha o efeito acima.
  useEffect(() => {
    if (editingItem || !modeloAutoDetectado) return;
    const match = encontrarModeloPorNome(formData.nome, modelos);
    const novoId = match?.id ?? '';
    if (novoId !== formData.modelo_moto_id) {
      setFormData((prev) => ({ ...prev, modelo_moto_id: novoId }));
    }
  }, [formData.nome, modelos, editingItem, modeloAutoDetectado]);

  // Envia uma ou várias fotos de uma vez e ACRESCENTA à galeria (não
  // substitui) — mesmo padrão de UnidadesEstoque.tsx `enviarFotos`.
  const handleUploadImagem = async (files: FileList | File[]) => {
    setIsUploadingImagem(true);
    setResumoCompressao(null);
    try {
      const novas: string[] = [];
      let bytesAntesTotal = 0;
      let bytesDepoisTotal = 0;
      let algumaComprimida = false;
      for (const file of Array.from(files)) {
        // Foto de câmera passa fácil dos 5MB aceitos pelo backend — encolher
        // aqui evita erro no meio do cadastro e acelera o envio na loja.
        const { arquivo, comprimido, bytesAntes, bytesDepois } = await comprimirImagem(file);
        const result = await uploadImagemEstoque(arquivo);
        if (!result.success || !result.url) throw new Error(result.error || 'Falha no upload');
        novas.push(result.url);
        if (comprimido) {
          algumaComprimida = true;
          bytesAntesTotal += bytesAntes;
          bytesDepoisTotal += bytesDepois;
        }
      }
      setFormData((prev) => ({ ...prev, imagens: [...prev.imagens, ...novas] }));
      if (algumaComprimida) setResumoCompressao(`Fotos otimizadas: ${formatarBytes(bytesAntesTotal)} → ${formatarBytes(bytesDepoisTotal)}`);
    } catch (err) {
      aviso.falha(err, 'Erro ao enviar imagem');
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
    // Em modo leitura (Eloisa) não registra edit/delete — o DetailModal
    // compartilhado (App.tsx) só mostra os botões de Editar/Excluir quando
    // essas ações existem, então não registrar já cobre o clique vindo da
    // busca global e do dashboard, não só desta tela.
    if (readOnly) return;
    onRegisterActions?.({
      edit: openEditModal,
      delete: (id: string) => {
        const item = items.find((i) => i.id === id);
        if (item) setItemToDelete(item);
      },
    });
  }, [onRegisterActions, openEditModal, items, readOnly]);

  // Dados crus da árvore, no formato genérico que o TreeDropdown espera —
  // ver src/components/TreeDropdown.tsx.
  const categoriaNodes = useMemo<TreeDropdownNode[]>(
    () => categorias.map((c) => ({ id: c.id, nome: c.nome, parent_id: c.parent_id, ordem: c.ordem })),
    [categorias]
  );
  const modeloNodes = useMemo<TreeDropdownNode[]>(
    () => modelos.map((m) => ({ id: m.id, nome: m.nome, parent_id: m.parent_id, ordem: m.ordem, secundario: m.ano })),
    [modelos]
  );

  // Árvores completas pro modo "Organograma" — buildTree/sumWithDescendants
  // já existentes em categoriaTree.ts/motoTree.ts, sem reimplementar nada.
  const categoriaArvore = useMemo(() => buildCategoriaTree(categorias), [categorias]);
  const motoArvoreOrg = useMemo(() => buildMotoTree(modelos), [modelos]);

  const contagemPorCategoriaId = useMemo(() => {
    const mapa = new Map<string, number>();
    items.forEach((item) => {
      if (!item.categoria_id) return;
      mapa.set(item.categoria_id, (mapa.get(item.categoria_id) ?? 0) + 1);
    });
    return mapa;
  }, [items]);

  const contagemPorModeloIdOrg = useMemo(() => {
    const mapa = new Map<string, number>();
    items.forEach((item) => {
      const ids = new Set<string>();
      if (item.modelo_moto_id) ids.add(item.modelo_moto_id);
      item.modelos_compativeis?.forEach((m) => ids.add(m.id));
      ids.forEach((id) => mapa.set(id, (mapa.get(id) ?? 0) + 1));
    });
    return mapa;
  }, [items]);

  const handleSelecionarCategoria = (id: string) => {
    setCategoriaFiltro(id);
    setModeloFiltro('Todas');
    setSearchTerm('');
    setVisualizacao('lista');
  };

  const handleSelecionarModelo = (id: string) => {
    setModeloFiltro(id);
    setCategoriaFiltro('Todas');
    setSearchTerm('');
    setVisualizacao('lista');
  };

  const itensEstoqueBaixo = useMemo(() => items.filter(isEstoqueBaixo).length, [items]);
  // Soma respeitando preço próprio de unidade avariada (ver valorEstoque.ts) —
  // multiplicar preço × quantidade mentiria quando o TBI amassado sai mais barato.
  const valorTotalEstoque = useMemo(() => somarValorEstoque(items), [items]);
  const itensComAvaria = useMemo(() => items.filter(temAvaria).length, [items]);
  const resumoDoDia = useMemo(() => calcularResumoDoDia(items), [items]);

  // Peças já cadastradas parecidas com o nome sendo digitado. Só avisa — quem
  // está cadastrando decide se é a mesma peça ou não.
  const duplicatas = useMemo(() => {
    if (!isModalOpen) return [];
    return detectarDuplicatas(formData.nome, items, { ignorarId: editingItem?.id ?? null, categoriaId: formData.categoria_id });
  }, [isModalOpen, formData.nome, formData.categoria_id, items, editingItem]);

  // Filtros não-textuais aplicados primeiro, antes de agrupar — categoria,
  // modelo, estoque baixo, sem preço, avaria, sem foto, sem link ML.
  const filteredNonSearch = useMemo(() => {
    let result = items.filter((item) => {
      const matchesCategoria =
        categoriaFiltro === 'Todas' || (!!item.categoria_id && getDescendantIds(categoriaFiltro, categorias).includes(item.categoria_id));
      const matchesModelo =
        modeloFiltro === 'Todas' ||
        (!!item.modelo_moto_id && getDescendantIdsMoto(modeloFiltro, modelos).includes(item.modelo_moto_id)) ||
        !!item.modelos_compativeis?.some((m) => getDescendantIdsMoto(modeloFiltro, modelos).includes(m.id));
      const matchesEstoqueBaixo = !soEstoqueBaixo || isEstoqueBaixo(item);
      const matchesSemPreco = !soSemPreco || !(Number(item.valor) > 0);
      const matchesAvaria = !soComAvaria || temAvaria(item);
      const matchesSemFoto = !soSemFoto || (item.imagens?.length ?? 0) === 0;
      const matchesSemLinkMl = !soSemLinkMl || (item.links_ml?.length ?? 0) === 0;
      return matchesCategoria && matchesModelo && matchesEstoqueBaixo && matchesSemPreco && matchesAvaria && matchesSemFoto && matchesSemLinkMl;
    });
    result = [...result].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
    return result;
  }, [items, categoriaFiltro, modeloFiltro, soEstoqueBaixo, soSemPreco, soComAvaria, soSemFoto, soSemLinkMl, categorias, modelos]);

  // `filtered` preserva a lista plana de Estoque[] para CSV, sugestões de
  // busca e métricas do header — sem agrupar por família.
  const filtered = useMemo(() => {
    const terms = debouncedSearch.toLowerCase().split(' ').filter(Boolean);
    if (terms.length === 0) return filteredNonSearch;
    return filteredNonSearch.filter((item) =>
      terms.every(
        (t) =>
          item.nome.toLowerCase().includes(t) ||
          item.codigo?.toLowerCase().includes(t) ||
          item.categoria?.nome?.toLowerCase().includes(t) ||
          item.modelo_moto?.nome?.toLowerCase().includes(t) ||
          item.modelos_compativeis?.some((m) => m.nome.toLowerCase().includes(t))
      )
    );
  }, [filteredNonSearch, debouncedSearch]);

  // Linhas da tabela agrupadas por família. A busca textual filtra pela linha
  // inteira — buscar "Titan 99" acha a família mesmo que só uma ficha-filha
  // contenha esse texto (ver filtrarLinhaTexto em familiaEstoque.ts).
  const filteredLinhas = useMemo(() => {
    const terms = debouncedSearch.toLowerCase().split(' ').filter(Boolean);
    const linhas = agruparLinhasTabela(filteredNonSearch);
    if (terms.length === 0) return linhas;
    return linhas.filter((linha) => filtrarLinhaTexto(linha, terms));
  }, [filteredNonSearch, debouncedSearch]);

  useEffect(
    () => setPagination((p) => ({ ...p, pageIndex: 0 })),
    [debouncedSearch, categoriaFiltro, modeloFiltro, soEstoqueBaixo, soSemPreco, soComAvaria, soSemFoto, soSemLinkMl, sorting]
  );

  const columns = useMemo<ColumnDef<EstoqueLinha>[]>(
    () => [
      {
        id: 'peca',
        accessorFn: (linha) => linha.tipo === 'familia' ? linha.familia.nome : linha.item.nome,
        header: ({ column }) => <SortableHead column={column} label="Peça" />,
        cell: ({ row }) => {
          const linha = row.original;
          if (linha.tipo === 'familia') {
            const { familia, itens } = linha;
            const qtdTotal = itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
            const foto = itens.flatMap((i) => i.imagens).filter(Boolean)[0];
            return (
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
                  {foto ? <img src={foto} alt={familia.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={16} className="text-text-faint" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-[12.5px] font-medium break-words line-clamp-2 min-w-0', qtdTotal === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{familia.nome}</p>
                    <StatusBadge tom="neutral" texto={`${itens.length} ${itens.length === 1 ? 'peça' : 'peças'}`} />
                  </div>
                  <p className="text-[11px] text-text-faint truncate">{itens[0]?.categoria?.nome || '-'}</p>
                </div>
              </div>
            );
          }
          const item = linha.item;
          const aberto = expandidos.has(item.id);
          return (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleExpandido(item.id); }}
                aria-label={aberto ? 'Recolher detalhes' : 'Ver mais detalhes'}
                aria-expanded={aberto}
                className="shrink-0 p-1 rounded-control text-text-faint hover:text-text-secondary hover:bg-surface-raised"
              >
                <ChevronDown size={13} className={cn('transition-transform', aberto ? 'rotate-0' : '-rotate-90')} />
              </button>
              <div className="size-9 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
                {item.imagens[0] ? <img src={item.imagens[0]} alt={item.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={16} className="text-text-faint" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn('text-[12.5px] font-medium break-words line-clamp-2 min-w-0', item.quantidade === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{item.nome}</p>
                  <CondicaoNotaBadge nota={item.condicao_nota} />
                  {contarFichas(item) > 0 && (
                    <span title={`${contarFichas(item)} unidade(s) com ficha própria (nota, avaria, apelido ou preço diferente)`}>
                      <StatusBadge tom="neutral" texto={`${contarFichas(item)} ${contarFichas(item) === 1 ? 'ficha' : 'fichas'}`} />
                    </span>
                  )}
                  {temAvaria(item) && (
                    <span title={`${contarAvarias(item)} unidade(s) com avaria`} className="shrink-0 inline-flex items-center gap-1 rounded-badge bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium leading-none text-warning">
                      <AlertTriangle size={9} />
                      {contarAvarias(item)}
                    </span>
                  )}
                  {(item.unidades_incompletas?.length ?? 0) > 0 && (
                    <span title={`Falta vender: ${item.unidades_incompletas.map((u) => u.faltando.join(', ')).join(' · ')}`} className="shrink-0 inline-flex items-center gap-1 rounded-badge bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium leading-none text-warning">
                      {item.unidades_incompletas.length} incompleta{item.unidades_incompletas.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                {isEstoqueBaixo(item) ? (
                  <p className="text-[11px] text-warning font-medium">Último em estoque</p>
                ) : (
                  <p className="text-[11px] text-text-faint truncate">{item.codigo} · {item.categoria?.nome || '-'}</p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: 'moto',
        header: 'Moto',
        enableSorting: false,
        cell: ({ row }) => {
          const linha = row.original;
          if (linha.tipo === 'familia') {
            const modelosUnicos = new Set(linha.itens.map((i) => i.modelo_moto_id).filter(Boolean));
            const texto =
              modelosUnicos.size === 0 ? 'Universal'
              : modelosUnicos.size === 1 ? (linha.itens[0]?.modelo_moto?.nome ?? 'Universal')
              : `${modelosUnicos.size} modelos`;
            return <StatusBadge tom="neutral" texto={texto} />;
          }
          const item = linha.item;
          return <StatusBadge tom="neutral" texto={item.modelo_moto?.nome ? `${item.modelo_moto.nome}${item.ano ? ` · ${item.ano}` : ''}` : 'Universal'} />;
        },
      },
      {
        id: 'anuncios',
        header: 'Anúncios',
        enableSorting: false,
        cell: ({ row }) => {
          const linha = row.original;
          if (linha.tipo === 'familia') return null;
          const item = linha.item;
          return (
            <div className="flex items-center justify-center gap-1">
              <AnuncioBadge label="ML" canal="Mercado Livre" count={item.links_ml?.length ?? 0} onAbrir={() => abrirAnunciosMl(item)} />
              <AnuncioBadge label="SP" canal="Shopee" count={item.links_shopee?.length ?? 0} onAbrir={() => abrirAnunciosShopee(item)} />
              <AnuncioBadge label="FB" canal="Facebook" count={item.anuncio_fb_url ? 1 : 0} onAbrir={() => window.open(item.anuncio_fb_url!, '_blank', 'noopener,noreferrer')} />
            </div>
          );
        },
      },
      {
        id: 'valor',
        accessorFn: (linha) => linha.tipo === 'familia' ? (faixaPrecoFamilia(linha.itens)?.min ?? 0) : linha.item.valor,
        header: ({ column }) => <SortableHead column={column} label="Valor" align="right" />,
        cell: ({ row }) => {
          const linha = row.original;
          if (linha.tipo === 'familia') {
            const faixa = faixaPrecoFamilia(linha.itens);
            if (!faixa) return null;
            return (
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-text-primary tabular-nums">
                  {faixa.min === faixa.max ? formatCurrency(faixa.min) : `${formatCurrency(faixa.min)} – ${formatCurrency(faixa.max)}`}
                </span>
              </div>
            );
          }
          const item = linha.item;
          return item.valor > 0 ? (
            <div className="flex flex-col items-end">
              {item.promocao_ativa ? (
                <>
                  <span className="text-[11px] text-text-faint line-through tabular-nums">{formatCurrency(item.valor)}</span>
                  <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(item.promocao_ativa.valor_promocional)}</span>
                  <PromocaoBadge promocao={item.promocao_ativa} className="mt-0.5" />
                </>
              ) : (
                <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(item.valor)}</span>
              )}
              {(item.unidades ?? []).some((u) => u.valor !== null && u.valor !== undefined) && (
                <span className="text-[10px] text-accent-soft-fg tabular-nums">total {formatCurrency(valorTotalItem(item))}</span>
              )}
            </div>
          ) : readOnly ? (
            <span className="text-sm font-medium text-danger">{formatCurrency(item.valor)}</span>
          ) : (
            <button type="button" onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="text-sm font-medium text-danger underline underline-offset-2 hover:opacity-80">
              Definir
            </button>
          );
        },
      },
      {
        id: 'quantidade',
        accessorFn: (linha) => linha.tipo === 'familia' ? emEstoqueFamilia(linha.itens) : linha.item.quantidade,
        header: ({ column }) => <SortableHead column={column} label="Qtd" align="right" />,
        cell: ({ row }) => {
          const linha = row.original;
          const qtd = linha.tipo === 'familia' ? emEstoqueFamilia(linha.itens) : linha.item.quantidade;
          const tom = qtd === 0 ? 'text-danger' : qtd <= 2 ? 'text-warning' : 'text-positive';
          const dot = qtd === 0 ? 'bg-danger' : qtd <= 2 ? 'bg-warning' : 'bg-positive';
          return (
            <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium tabular-nums', tom)}>
              <span className={cn('size-1.5 rounded-full shrink-0', dot)} />
              {qtd}
            </span>
          );
        },
      },
    ],
    [readOnly, abrirAnunciosMl, abrirAnunciosShopee, openEditModal, expandidos, toggleExpandido]
  );

  const table = useReactTable<EstoqueLinha>({
    data: loading && items.length === 0 ? [] : filteredLinhas,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: (linha) => linha.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // `continuar` = fluxo "salvar e cadastrar próxima": persiste e já devolve o
  // formulário limpo pro próximo item, sem fechar o modal. Categoria, moto,
  // condição e ano ficam preenchidos porque peça costuma sair em lote da
  // mesma moto — é o que corta mais tempo na catalogação em massa.
  const handleSave = async (continuar = false) => {
    if (!formData.nome.trim()) return aviso.atencao('Preencha o nome da peça');
    if (!formData.categoria_id) return aviso.atencao('Selecione uma categoria');
    if (formExigeNota && !formData.nota_cadastro) {
      return aviso.atencao('Peça de Motor Completo precisa da nota', { descricao: 'Escolha "Com nota" ou "Sem nota pra cadastro".' });
    }

    setIsSaving(true);
    const payload: EstoqueInput = {
      ...formData,
      valor: Number(formData.valor) || 0,
      quantidade: Math.max(0, Number(formData.quantidade) || 0),
      modelo_moto_id: formData.modelo_moto_id || null,
      anuncio_fb_url: formData.anuncio_fb_url?.trim() || null,
      // Proteção redundante à validação de UI: nunca manda o principal
      // também como "compatível" (o backend já dedupe, mas evita o roundtrip).
      modelo_moto_compativel_ids: formData.modelo_moto_compativel_ids.filter((id) => id !== formData.modelo_moto_id),
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
        // Confirmação com o código gerado: é como quem cataloga sabe que a
        // peça entrou, sem precisar fechar o modal pra conferir na lista.
        aviso.sucesso(`${result.data.codigo} cadastrada`, { descricao: result.data.nome, duracao: 2500 });

        if (continuar) {
          setFormData({
            ...EMPTY_FORM,
            categoria_id: formData.categoria_id,
            modelo_moto_id: formData.modelo_moto_id,
            condicao: formData.condicao,
            ano: formData.ano,
            modelo_moto_compativel_ids: formData.modelo_moto_compativel_ids,
          });
          setNovoComponente('');
          setAdicionandoCompativel(false);
          setCompatTempId('');
          setResumoCompressao(null);
          setSalvasEmSequencia((n) => n + 1);
          // Não mexe em categoriaAutoDetectada/modeloAutoDetectado de
          // propósito: se vinham sendo detectados pelo nome, continuam
          // detectando; se foram escolhidos na mão, a escolha permanece valendo.
          setTimeout(() => inputNomeRef.current?.focus(), 0);
          return;
        }
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      aviso.falha(err, 'Erro ao salvar item');
    } finally {
      setIsSaving(false);
    }
  };

  // A peça some da lista na hora, mas a exclusão de verdade só sai depois da
  // janela de desfazer. Apagar peça errada num estoque desse tamanho é caro, e
  // o backend ainda apaga a foto do Storage junto — não dá pra restaurar
  // depois. Se a pessoa fechar o navegador antes dos segundos acabarem, a
  // exclusão simplesmente não acontece: erra pro lado seguro, que é não perder
  // nada.
  const handleDelete = () => {
    if (!itemToDelete) return;
    const item = itemToDelete;
    setItemToDelete(null);
    setEstoque((prev) => prev.filter((i) => i.id !== item.id));

    let desfeito = false;
    const temporizador = setTimeout(async () => {
      if (desfeito) return;
      try {
        const result = await estoqueApi.excluir(item.id);
        if (!result.success) throw new Error(result.error);
      } catch (err) {
        aviso.falha(err, 'Erro ao excluir item');
        refreshData();
      }
    }, MS_PARA_DESFAZER);

    aviso.atencao(`${item.codigo} excluída`, {
      descricao: item.nome,
      duracao: MS_PARA_DESFAZER,
      acao: {
        label: 'Desfazer',
        onClick: () => {
          desfeito = true;
          clearTimeout(temporizador);
          setEstoque((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev]));
          aviso.sucesso('Exclusão desfeita');
        },
      },
    });
  };

  // Backup do estoque em CSV. Exporta o que está filtrado na tela (ou tudo,
  // quando não há filtro) — o mesmo recorte que a pessoa está vendo.
  const exportarCsv = () => {
    const dados = filtered.length > 0 ? filtered : items;
    const carimbo = new Date().toISOString().slice(0, 10);
    baixarCsv(`estoque-rk-${carimbo}.csv`, gerarCsvEstoque(dados, categorias));
  };

  const inputClass = 'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  // Mesmas colunas acima, empilhadas verticalmente — usado pelo fallback
  // mobile, abaixo de `md`, onde a tabela só rolaria horizontalmente.
  function renderMobileCard(item: Estoque) {
    const tomQtd = item.quantidade === 0 ? 'text-danger' : item.quantidade <= 2 ? 'text-warning' : 'text-positive';
    const dotQtd = item.quantidade === 0 ? 'bg-danger' : item.quantidade <= 2 ? 'bg-warning' : 'bg-positive';
    return (
      <div className="flex items-start gap-3">
        <div className="size-11 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
          {item.imagens[0] ? (
            <img src={item.imagens[0]} alt={item.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Package size={18} className="text-text-faint" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn('text-sm font-medium break-words line-clamp-2 min-w-0', item.quantidade === 0 ? 'text-text-faint line-through' : 'text-text-primary')}>{item.nome}</p>
            <CondicaoNotaBadge nota={item.condicao_nota} />
            {contarFichas(item) > 0 && (
              <span title={`${contarFichas(item)} unidade(s) com ficha própria (nota, avaria, apelido ou preço diferente)`}>
                <StatusBadge tom="neutral" texto={`${contarFichas(item)} ${contarFichas(item) === 1 ? 'ficha' : 'fichas'}`} />
              </span>
            )}
            {temAvaria(item) && (
              <span
                title={`${contarAvarias(item)} unidade(s) com avaria`}
                className="shrink-0 inline-flex items-center gap-1 rounded-badge bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium leading-none text-warning"
              >
                <AlertTriangle size={9} />
                {contarAvarias(item)}
              </span>
            )}
            {(item.unidades_incompletas?.length ?? 0) > 0 && (
              <span
                title={`Falta vender: ${item.unidades_incompletas.map((u) => u.faltando.join(', ')).join(' · ')}`}
                className="shrink-0 inline-flex items-center gap-1 rounded-badge bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium leading-none text-warning"
              >
                {item.unidades_incompletas.length} incompleta{item.unidades_incompletas.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {isEstoqueBaixo(item) ? (
            <p className="text-[11px] text-warning font-medium">Último em estoque</p>
          ) : (
            <p className="text-[11px] text-text-faint truncate">
              {item.codigo} · {item.categoria?.nome || '-'}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <StatusBadge tom="neutral" texto={item.modelo_moto?.nome ? `${item.modelo_moto.nome}${item.ano ? ` · ${item.ano}` : ''}` : 'Universal'} />
            <AnuncioBadge label="ML" canal="Mercado Livre" count={item.links_ml?.length ?? 0} onAbrir={() => abrirAnunciosMl(item)} />
            <AnuncioBadge label="SP" canal="Shopee" count={item.links_shopee?.length ?? 0} onAbrir={() => abrirAnunciosShopee(item)} />
            <AnuncioBadge label="FB" canal="Facebook" count={item.anuncio_fb_url ? 1 : 0} onAbrir={() => window.open(item.anuncio_fb_url!, '_blank', 'noopener,noreferrer')} />
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium tabular-nums', tomQtd)}>
              <span className={cn('size-1.5 rounded-full shrink-0', dotQtd)} />
              {item.quantidade} un.
            </span>
            {item.valor > 0 ? (
              item.promocao_ativa ? (
                <div className="flex flex-col items-end">
                  <span className="text-[11px] text-text-faint line-through tabular-nums">{formatCurrency(item.valor)}</span>
                  <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(item.promocao_ativa.valor_promocional)}</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(item.valor)}</span>
              )
            ) : readOnly ? (
              <span className="text-sm font-medium text-danger">{formatCurrency(item.valor)}</span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(item);
                }}
                className="text-sm font-medium text-danger underline underline-offset-2"
              >
                Definir preço
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Estoque</h1>
          <p className="text-sm text-text-faint mt-0.5">
            <AnimatedNumber value={items.length} /> {items.length === 1 ? 'item' : 'itens'} · <AnimatedNumber value={valorTotalEstoque} format={formatCurrency} /> em estoque
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
            title="Sincronizar"
            className="h-11 md:h-10 px-3 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 hover:text-text-primary"
          >
            <RefreshCw size={14} className={cn((loading || isRefreshing) && 'animate-spin')} />
            <span className="hidden lg:inline">Sincronizar</span>
          </button>
          <button
            onClick={exportarCsv}
            disabled={items.length === 0}
            title="Exportar estoque em CSV (backup)"
            className="h-11 md:h-10 px-3 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 hover:text-text-primary"
          >
            <Download size={14} />
            <span className="hidden lg:inline">Exportar</span>
          </button>
          {!readOnly && (
            <>
              <button
                onClick={() => setIsImportOpen(true)}
                title="Importar peças de uma planilha"
                className="h-11 md:h-10 px-3 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 hover:text-text-primary"
              >
                <FileSpreadsheet size={14} />
                <span className="hidden lg:inline">Importar</span>
              </button>
              <button
                onClick={() => setFundirModalAberto(true)}
                title="Sugestões de famílias a partir de peças similares"
                className="h-11 md:h-10 px-3 rounded-control border border-border-default text-text-secondary text-[11px] font-medium flex items-center gap-1.5 hover:bg-surface-raised"
              >
                <Merge size={14} /> Fundir
              </button>
              <button onClick={openCreateModal} className="h-11 md:h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90">
                <Plus size={16} /> Nova peça
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conferência do dia — some quando nada foi cadastrado hoje, pra não
          ocupar espaço fora do dia de catalogação. */}
      {resumoDoDia.itens > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-border-subtle bg-surface-card px-4 py-3">
          <div>
            <p className="text-[20px] font-medium text-text-primary leading-none tabular-nums">
              <AnimatedNumber value={resumoDoDia.itens} />
            </p>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mt-1.5">
              {resumoDoDia.itens === 1 ? 'peça cadastrada hoje' : 'peças cadastradas hoje'}
            </p>
          </div>
          <div className="h-8 w-px bg-border-subtle hidden sm:block" />
          <div>
            <p className="text-[20px] font-medium text-text-primary leading-none tabular-nums">
              <AnimatedNumber value={resumoDoDia.valorTotal} format={formatCurrency} />
            </p>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mt-1.5">somados hoje</p>
          </div>
          {resumoDoDia.semValor > 0 && (
            <button
              onClick={() => setSoSemPreco(true)}
              className="ml-auto flex items-center gap-2 rounded-control bg-warning-bg px-3 py-2 text-warning hover:opacity-80 transition-opacity"
            >
              <AlertTriangle size={14} className="shrink-0" />
              <span className="text-xs font-medium">
                {resumoDoDia.semValor} sem preço — revisar
              </span>
            </button>
          )}
        </div>
      )}

      {/* Alternância Lista / Por Moto / Organograma — Tabs animadas do animate-ui
          (a "pílula" do indicador desliza com spring). O conteúdo continua
          renderizado condicionalmente abaixo: NÃO usamos TabsContents porque os
          painéis são pesados (tabela de centenas de linhas / orgchart) e animar
          a troca travaria na WebView Capacitor.
          As classes abaixo preservam o que o alternador manual já tinha: caixa
          alta de 11px e alvo de toque alto no mobile (h-11 sm:h-9, mesmo padrão
          das outras telas) — o wrapper padrão do animate-ui vem em text-sm/h-9,
          que no celular fica abaixo do alvo mínimo. */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={visualizacao} onValueChange={(v) => setVisualizacao(v as typeof visualizacao)}>
          <TabsList className="h-11 sm:h-9 items-stretch border-border-default">
            <TabsTrigger value="lista" className={TRIGGER_CLASS}>Lista</TabsTrigger>
            <TabsTrigger value="por_moto" className={TRIGGER_CLASS}><Bike className="size-[13px]" /> Por moto</TabsTrigger>
            <TabsTrigger value="organograma" className={TRIGGER_CLASS}><Network className="size-[13px]" /> Organograma</TabsTrigger>
          </TabsList>
        </Tabs>

        {visualizacao === 'organograma' && (
          <Tabs value={orgChartDominio} onValueChange={(v) => setOrgChartDominio(v as typeof orgChartDominio)}>
            <TabsList className="h-10 sm:h-8 items-stretch border-border-default">
              <TabsTrigger value="categorias" className={SUB_TRIGGER_CLASS}>Categorias</TabsTrigger>
              <TabsTrigger value="motos" className={SUB_TRIGGER_CLASS}>Motos</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {visualizacao === 'por_moto' ? (
        <EstoqueByMoto modelos={modelos} items={items} onSelecionarModelo={handleSelecionarModelo} />
      ) : visualizacao === 'organograma' ? (
        <div className="max-h-[34rem] overflow-y-auto pr-1">
          {orgChartDominio === 'categorias' ? (
            <CategoriaOrgChart
              categorias={categorias}
              arvore={categoriaArvore}
              contar={(id) => sumWithDescendants(getDescendantIds(id, categorias), contagemPorCategoriaId)}
              rotuloContagem={(n) => (n === 1 ? 'peça' : 'peças')}
              onSelecionar={handleSelecionarCategoria}
              emptyMessage="Nenhuma categoria cadastrada ainda."
            />
          ) : (
            <MotoOrgChart
              modelos={modelos}
              arvore={motoArvoreOrg}
              contar={(id) => sumWithDescendants(getDescendantIdsMoto(id, modelos), contagemPorModeloIdOrg)}
              rotuloContagem={(n) => (n === 1 ? 'peça' : 'peças')}
              onSelecionar={handleSelecionarModelo}
              emptyMessage="Nenhuma moto cadastrada ainda."
            />
          )}
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="space-y-3">
            <EstoqueBuscaSugestoes
              value={searchTerm}
              onChange={setSearchTerm}
              sugestoes={debouncedSearch.trim() ? filtered.slice(0, 6) : []}
              onSelecionar={onSelectItem}
            />

            <EstoqueFiltrosPopover
              categoriaFiltro={categoriaFiltro}
              onCategoriaChange={setCategoriaFiltro}
              categoriaNodes={categoriaNodes}
              modeloFiltro={modeloFiltro}
              onModeloChange={setModeloFiltro}
              modeloNodes={modeloNodes}
              soEstoqueBaixo={soEstoqueBaixo}
              onToggleEstoqueBaixo={() => setSoEstoqueBaixo((v) => !v)}
              itensEstoqueBaixo={itensEstoqueBaixo}
              soSemPreco={soSemPreco}
              onToggleSemPreco={() => setSoSemPreco((v) => !v)}
              soComAvaria={soComAvaria}
              onToggleComAvaria={() => setSoComAvaria((v) => !v)}
              mostrarFiltroAvaria={itensComAvaria > 0 || soComAvaria}
              itensComAvaria={itensComAvaria}
              soSemFoto={soSemFoto}
              onToggleSemFoto={() => setSoSemFoto((v) => !v)}
              soSemLinkMl={soSemLinkMl}
              onToggleSemLinkMl={() => setSoSemLinkMl((v) => !v)}
            />
          </div>

          {/* Tabela */}
          {(() => {
            const emptyStateNode =
              loading && items.length === 0 ? (
                <div className="py-12 flex items-center justify-center text-text-faint">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : estoqueError && items.length === 0 ? (
                <EmptyState icone={RefreshCw} mensagem="Não foi possível carregar o estoque. Verifique sua conexão." acaoLabel="Tentar novamente" onAcao={refreshData} />
              ) : (
                <EmptyState
                  icone={Package}
                  mensagem={items.length === 0 ? 'Nenhuma peça cadastrada ainda.' : 'Nenhum item corresponde aos filtros aplicados.'}
                  acaoLabel={items.length === 0 && !readOnly ? 'Cadastrar peça' : undefined}
                  onAcao={items.length === 0 && !readOnly ? openCreateModal : undefined}
                />
              );

            return (
              <div className="bg-surface-card border border-border-subtle rounded-card overflow-hidden">
                <div className="overflow-x-auto hidden md:block">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="border-b border-border-default hover:bg-transparent">
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              style={{ width: larguraDaColuna(header.column.id) }}
                              className={cn(
                                'h-auto px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted',
                                alinhamentoDaColuna(header.column.id)
                              )}
                            >
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={columns.length} className="p-0 whitespace-normal">
                            {emptyStateNode}
                          </TableCell>
                        </TableRow>
                      ) : (
                        table.getRowModel().rows.map((row) => {
                          const linha = row.original;
                          const emAlerta = linha.tipo === 'familia'
                            ? emEstoqueFamilia(linha.itens) === 0
                            : isEstoqueBaixo(linha.item);
                          const aberto = linha.tipo === 'avulso' && expandidos.has(linha.item.id);
                          return (
                            <Fragment key={row.id}>
                              <TableRow
                                onClick={() => setFamiliaModalLinha(linha)}
                                className={cn(
                                  'border-b border-border-subtle last:border-b-0 cursor-pointer',
                                  emAlerta ? 'border-l-2 border-l-warning' : 'border-l-2 border-l-transparent'
                                )}
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell key={cell.id} className={cn('px-3 py-2.5 text-text-secondary whitespace-normal', alinhamentoDaColuna(cell.column.id))}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </TableCell>
                                ))}
                              </TableRow>
                              {/* Painel expandido: só para fichas avulsas (famílias abrem o modal) */}
                              <AnimatePresence>
                                {aberto && linha.tipo === 'avulso' && (
                                  <TableRow key={`${row.id}-expandido`} className="hover:bg-transparent border-b border-border-subtle">
                                    <TableCell colSpan={columns.length} className="p-0">
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={transicaoExpansao}
                                        className="overflow-hidden"
                                      >
                                        <EstoqueItemExpandido item={linha.item} categorias={categorias} />
                                      </motion.div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </AnimatePresence>
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden">
                  {table.getRowModel().rows.length === 0 ? (
                    emptyStateNode
                  ) : (
                    <div className="divide-y divide-border-subtle">
                      {table.getRowModel().rows.map((row) => {
                        const linha = row.original;
                        const item = linha.tipo === 'avulso' ? linha.item : null;
                        const emAlerta = linha.tipo === 'familia'
                          ? emEstoqueFamilia(linha.itens) === 0
                          : isEstoqueBaixo(linha.item);
                        return (
                          <Expandable
                            key={row.id}
                            expanded={item ? expandidos.has(item.id) : false}
                            onToggle={item ? () => toggleExpandido(item.id) : undefined}
                            onClick={() => setFamiliaModalLinha(linha)}
                            className={cn('border-l-2 px-3 py-3 cursor-pointer', emAlerta ? 'border-l-warning' : 'border-l-transparent')}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">{item ? renderMobileCard(item) : linha.tipo === 'familia' ? (
                                // Card de família mobile
                                <div className="flex items-start gap-3">
                                  <div className="size-11 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
                                    {linha.itens.flatMap((i) => i.imagens)[0]
                                      ? <img src={linha.itens.flatMap((i) => i.imagens)[0]} alt={linha.familia.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      : <Package size={18} className="text-text-faint" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium break-words line-clamp-2 min-w-0 text-text-primary">{linha.familia.nome}</p>
                                      <StatusBadge tom="neutral" texto={`${linha.itens.length} peças`} />
                                    </div>
                                    <p className="text-[11px] text-text-faint truncate mt-0.5">{linha.itens[0]?.categoria?.nome || '-'}</p>
                                    <div className="mt-1.5">
                                      <StatusBadge tom="neutral" texto={`${emEstoqueFamilia(linha.itens)} em estoque`} />
                                    </div>
                                  </div>
                                </div>
                              ) : null}</div>
                              {item && (
                                <div className="shrink-0 -mr-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <ExpandableTrigger
                                    aria-label={expandidos.has(item.id) ? 'Recolher detalhes' : 'Ver mais detalhes'}
                                    className="p-1 rounded-control text-text-faint hover:text-text-secondary hover:bg-surface-raised"
                                  >
                                    <ChevronDown size={14} className={cn('transition-transform', expandidos.has(item.id) ? 'rotate-0' : '-rotate-90')} />
                                  </ExpandableTrigger>
                                </div>
                              )}
                            </div>
                            {item && (
                            <ExpandableContent keepMounted={false} preset="fade">
                              <div className="mt-3">
                                <EstoqueItemExpandido item={item} categorias={categorias} />
                              </div>
                            </ExpandableContent>
                            )}
                          </Expandable>
                        );
                      })}
                    </div>
                  )}
                </div>

                {table.getPageCount() > 1 && (
                  <div className="flex items-center justify-between px-3 py-2.5 border-t border-border-subtle">
                    <span className="text-xs text-text-faint">
                      Página {pagination.pageIndex + 1} de {table.getPageCount()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="size-7 flex items-center justify-center rounded-control border border-border-default text-text-secondary disabled:opacity-30 hover:bg-surface-raised"
                        aria-label="Página anterior"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="size-7 flex items-center justify-center rounded-control border border-border-default text-text-secondary disabled:opacity-30 hover:bg-surface-raised"
                        aria-label="Próxima página"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Modal criar/editar */}
      <AnimatePresence>
        {isModalOpen && (
          <Modal
            aberto={isModalOpen}
            onFechar={() => setIsModalOpen(false)}
            titulo={editingItem ? 'Editar peça' : 'Nova peça no estoque'}
            subtitulo={
              editingItem
                ? editingItem.codigo
                : salvasEmSequencia > 0
                ? `${salvasEmSequencia} ${salvasEmSequencia === 1 ? 'peça cadastrada' : 'peças cadastradas'} nesta sequência`
                : 'Categoria, moto e condição ficam guardadas pra próxima peça'
            }
            icone={Package}
            tamanho="lg"
            rodape={
              editingItem ? (
                <button
                  onClick={() => handleSave(false)}
                  disabled={isSaving || isUploadingImagem}
                  className="w-full h-12 rounded-control bg-accent text-white font-semibold text-xs uppercase tracking-[0.2em] shadow-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Salvar alterações'}
                </button>
              ) : (
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    onClick={() => handleSave(false)}
                    disabled={isSaving || isUploadingImagem}
                    className="sm:flex-1 h-12 rounded-control border border-border-default text-text-secondary font-semibold text-xs uppercase tracking-wider hover:bg-surface-raised disabled:opacity-50"
                  >
                    Salvar e fechar
                  </button>
                  {/* Ação principal do dia de catalogação: é ela que mantém o
                      ritmo peça a peça, então fica com o único accent da tela. */}
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving || isUploadingImagem}
                    className="sm:flex-[1.4] h-12 rounded-control bg-accent text-white font-semibold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={15} /> Salvar e cadastrar próxima</>}
                  </button>
                </div>
              )
            }
          >
            <>
              <ModalSection titulo="Identificação">
                <div>
                  <label className={labelClass}>Nome da peça *</label>
                  <input
                    ref={inputNomeRef}
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: CDI Titan 150"
                    className={inputClass}
                  />
                  {duplicatas.length > 0 && (
                    <div className="mt-2 rounded-control border border-warning/25 bg-warning-bg/40 p-3 space-y-2">
                      <p className="text-xs font-medium text-warning flex items-center gap-1.5">
                        <AlertTriangle size={13} className="shrink-0" />
                        {duplicatas[0].grau === 'exata' ? 'Essa peça já parece estar cadastrada' : 'Peça parecida já cadastrada'}
                      </p>
                      {duplicatas.map((dup) => (
                        <div key={dup.item.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-text-primary truncate">{dup.item.nome}</p>
                            <p className="text-[11px] text-text-faint">
                              {dup.item.codigo} · {dup.item.quantidade} em estoque
                              {dup.item.categoria?.nome ? ` · ${dup.item.categoria.nome}` : ''}
                            </p>
                          </div>
                          {/* Sem esta ação o aviso seria só ruído: normalmente o
                              certo é somar quantidade na peça que já existe. */}
                          <button
                            type="button"
                            onClick={() => openEditModal(dup.item)}
                            className="shrink-0 flex items-center gap-1.5 rounded-control border border-warning/30 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning hover:bg-warning/10"
                          >
                            <Pencil size={12} /> Abrir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Categoria *</label>
                    <CategoriaCascadeSelect
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
                      modelos={modelos}
                      value={formData.modelo_moto_id || ''}
                      onChange={(id) => {
                        setModeloAutoDetectado(false);
                        setFormData({
                          ...formData,
                          modelo_moto_id: id,
                          modelo_moto_compativel_ids: formData.modelo_moto_compativel_ids.filter((cid) => cid !== id),
                        });
                      }}
                      onCreate={criarNoMoto}
                      allowEmpty
                      emptyLabel="Universal / não se aplica"
                    />
                  </div>
                </div>

                {formData.modelo_moto_id && (
                  <div>
                    <label className={labelClass}>Também serve em (opcional)</label>
                    <p className="text-xs text-text-faint mb-2">
                      Pra peças que servem em mais de um modelo/ano — ex: lanterna que serve tanto na CG 150 quanto na CG 125 Fan.
                    </p>
                    {formData.modelo_moto_compativel_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {formData.modelo_moto_compativel_ids.map((id) => {
                          const m = modelos.find((mm) => mm.id === id);
                          if (!m) return null;
                          return (
                            <span key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-inset text-text-secondary">
                              {m.ano ? `${m.nome} (${m.ano})` : m.nome}
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    modelo_moto_compativel_ids: prev.modelo_moto_compativel_ids.filter((cid) => cid !== id),
                                  }))
                                }
                                className="hover:text-danger"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {adicionandoCompativel ? (
                      <div className="space-y-2">
                        <MotoCascadeSelect modelos={modelos} value={compatTempId} onChange={setCompatTempId} onCreate={criarNoMoto} />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!compatTempId || compatTempId === formData.modelo_moto_id || formData.modelo_moto_compativel_ids.includes(compatTempId)}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                modelo_moto_compativel_ids: [...prev.modelo_moto_compativel_ids, compatTempId],
                              }));
                              setAdicionandoCompativel(false);
                              setCompatTempId('');
                            }}
                            className="flex-1 py-2 rounded-control bg-accent text-white text-xs font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
                          >
                            Adicionar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdicionandoCompativel(false);
                              setCompatTempId('');
                            }}
                            className="px-4 py-2 rounded-control border border-border-default text-text-muted text-xs font-semibold uppercase tracking-wider"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAdicionandoCompativel(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary"
                      >
                        <Plus size={14} /> Adicionar modelo compatível
                      </button>
                    )}
                  </div>
                )}

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

                <CondicaoNotaPicker
                  valor={formData.condicao_nota}
                  onChange={(n) => setFormData({ ...formData, condicao_nota: n })}
                  label="Nota de condição (estado físico)"
                  ajuda="Opcional — 1 é estado ruim, 10 é como nova."
                />

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
              </ModalSection>

              <ModalSection titulo="Preço e estoque">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Valor (R$)</label>
                    {/* Máscara de moeda: dígitos preenchem da direita (estilo
                        "digitar centavos"), evita erro de vírgula/ponto do
                        input number cru. inputMode decimal só ajuda o teclado mobile. */}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatCurrencyInput(String(Math.round((formData.valor || 0) * 100)))}
                      onChange={(e) => setFormData({ ...formData, valor: parseCurrencyInput(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Quantidade</label>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Ano compatível</label>
                    <input
                      value={formData.ano || ''}
                      onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                      placeholder="2020 ou 2004-2008"
                      title="Ano único ou período dentro da variação escolhida acima"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Total já somado: é aqui que um zero a mais no valor salta
                    aos olhos, antes de virar linha no estoque. */}
                {Number(formData.valor) > 0 && Number(formData.quantidade) > 1 && (
                  <p className="text-xs text-text-faint">
                    {formData.quantidade} × {formatCurrency(Number(formData.valor))} ={' '}
                    <span className="text-text-secondary font-medium">{formatCurrency(Number(formData.valor) * Number(formData.quantidade))}</span> nesta linha
                  </p>
                )}
              </ModalSection>

              <ModalSection titulo="Fotos">
                <div className="space-y-3">
                  <p className="text-xs text-text-faint">A primeira foto é a capa mostrada na lista. Pode anexar mais de uma.</p>

                  {/* Câmera ("Tirar foto") e galeria vivem os dois dentro do
                      EstoqueUploadFotos — um único botão de câmera, sem duplicar. */}
                  <EstoqueUploadFotos
                    imagens={formData.imagens}
                    onRemoverImagem={(url) => setFormData((prev) => ({ ...prev, imagens: prev.imagens.filter((u) => u !== url) }))}
                    onArquivosSelecionados={handleUploadImagem}
                    enviando={isUploadingImagem}
                    resumoCompressao={resumoCompressao}
                  />
                </div>
              </ModalSection>

              <ModalSection titulo="Anúncio no Facebook" descricao="Cole o link do anúncio — aparece como badge clicável na coluna “Anúncios” da tabela.">
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
              </ModalSection>

              <ModalSection
                titulo="Anúncios no Mercado Livre"
                descricao="Vincule quantos anúncios forem precisos — cada um sincroniza preço e estoque com o seu próprio anúncio."
              >
                {editingItem ? (
                  <>
                    <div className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface-inset px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">Publicar automaticamente no Mercado Livre</p>
                        <p className="text-[11px] text-text-faint mt-0.5">Cria um anúncio novo direto do catálogo, em vez de só colar o link de um já existente.</p>
                      </div>
                      <Switch
                        checked={publicarMlAtivo}
                        onCheckedChange={(ativo) => {
                          setPublicarMlAtivo(ativo);
                          // Adianta o trabalho pesado: quando o formulário de
                          // publicação abrir, as prévias já estão prontas.
                          if (ativo) remocaoFundo.iniciarTodas(formData.imagens);
                          else remocaoFundo.limparTudo();
                        }}
                      />
                    </div>

                    {publicarMlAtivo && (
                      <div className="flex items-center justify-between gap-3 rounded-control border border-accent/25 bg-accent-soft-bg px-3.5 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-accent-soft-fg truncate">{editingItem.categoria?.nome || 'Sem categoria'} · {formatCurrency(Number(formData.valor) || 0)}</p>
                          <p className="text-[11px] text-text-faint mt-0.5">
                            {formData.imagens.length} {formData.imagens.length === 1 ? 'foto disponível' : 'fotos disponíveis'} pro anúncio
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPublicarMlAberto(true)} className="shrink-0">
                          <Send size={13} /> Configurar e publicar
                        </Button>
                      </div>
                    )}

                    <EstoqueAnunciosMlEditor item={editingItem} onAlterado={(links) => setEditingItem((prev) => (prev ? { ...prev, links_ml: links } : prev))} />
                  </>
                ) : (
                  <p className="text-xs text-text-faint">Salve a peça primeiro pra poder vincular anúncios do Mercado Livre.</p>
                )}
              </ModalSection>

              <ModalSection
                titulo="Publicar na Shopee"
                descricao="Segundo canal de venda, independente do Mercado Livre acima — cada anúncio nasce direto do catálogo."
              >
                {editingItem ? (
                  <>
                    <div className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface-inset px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">Publicar automaticamente na Shopee</p>
                        <p className="text-[11px] text-text-faint mt-0.5">Cria um anúncio novo direto do catálogo, com categoria, frete e atributos próprios da Shopee.</p>
                      </div>
                      <Switch checked={publicarShopeeAtivo} onCheckedChange={setPublicarShopeeAtivo} />
                    </div>

                    {publicarShopeeAtivo && (
                      <div className="flex items-center justify-between gap-3 rounded-control border border-accent/25 bg-accent-soft-bg px-3.5 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-accent-soft-fg truncate">{editingItem.categoria?.nome || 'Sem categoria'} · {formatCurrency(Number(formData.valor) || 0)}</p>
                          <p className="text-[11px] text-text-faint mt-0.5">
                            {formData.imagens.length} {formData.imagens.length === 1 ? 'foto disponível' : 'fotos disponíveis'} pro anúncio
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPublicarShopeeAberto(true)} className="shrink-0">
                          <Send size={13} /> Configurar e publicar
                        </Button>
                      </div>
                    )}

                    <EstoqueAnunciosShopeeLista item={editingItem} onAlterado={(links) => setEditingItem((prev) => (prev ? { ...prev, links_shopee: links } : prev))} />
                  </>
                ) : (
                  <p className="text-xs text-text-faint">Salve a peça primeiro pra poder publicar na Shopee.</p>
                )}
              </ModalSection>

              <ModalSection
                titulo="Venda em partes"
                descricao='Se essa peça pode ser vendida em partes separadas (ex: "Mesa Completa" → Superior / Inferior), cadastre os nomes aqui. Na venda você poderá dar baixa de só uma parte, e o item fica sinalizado como incompleto.'
              >
                <div>
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
                  {/* <form onSubmit> em vez de só onKeyDown('Enter'): em
                      teclados virtuais mobile com IME (Gboard, Samsung
                      Keyboard) a tecla Enter às vezes chega como keyCode 229
                      ("Process") em vez do Enter real, então o onKeyDown
                      nunca disparava. O submit do form funciona nos dois casos. */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const nomeParte = novoComponente.trim();
                      if (nomeParte && !(formData.componentes || []).includes(nomeParte)) {
                        setFormData((prev) => ({ ...prev, componentes: [...(prev.componentes || []), nomeParte] }));
                      }
                      setNovoComponente('');
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={novoComponente}
                      onChange={(e) => setNovoComponente(e.target.value)}
                      placeholder="Ex: Inferior"
                      className={cn(inputClass, 'flex-1')}
                    />
                    <button
                      type="submit"
                      disabled={!novoComponente.trim()}
                      className="shrink-0 px-4 rounded-control bg-surface-inset border border-border-default text-text-secondary text-xs font-semibold uppercase tracking-wider hover:bg-surface-raised disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  </form>
                </div>
              </ModalSection>

              <ModalSection titulo="Descrição">
                <textarea
                  value={formData.descricao || ''}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  placeholder="Estado da peça, detalhes de compatibilidade, observações..."
                  className={cn(inputClass, 'resize-none')}
                />
              </ModalSection>
            </>
          </Modal>
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão */}
      <AnimatePresence>
        {itemToDelete && (
          <Modal
            aberto={!!itemToDelete}
            onFechar={() => setItemToDelete(null)}
            titulo="Excluir peça?"
            subtitulo={itemToDelete.codigo}
            icone={AlertCircle}
            tamanho="sm"
            rodape={
              <div className="flex gap-3">
                <button
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 h-11 rounded-control border border-border-default font-medium text-sm text-text-secondary hover:bg-surface-raised"
                >
                  Cancelar
                </button>
                <button onClick={handleDelete} className="flex-1 h-11 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90">
                  Excluir
                </button>
              </div>
            }
          >
            <p className="text-sm text-text-secondary">
              <span className="text-text-primary font-medium">{itemToDelete.nome}</span> vai sair do estoque junto com a foto. Essa ação não pode ser desfeita.
            </p>
            {itemToDelete.quantidade > 0 && (
              <p className="text-sm text-warning mt-3">
                Ainda {itemToDelete.quantidade === 1 ? 'há 1 unidade' : `há ${itemToDelete.quantidade} unidades`} em estoque
                {Number(itemToDelete.valor) > 0 && <> ({formatCurrency(Number(itemToDelete.valor) * itemToDelete.quantidade)})</>}.
              </p>
            )}
          </Modal>
        )}
      </AnimatePresence>

      <ImportarPlanilhaModal
        aberto={isImportOpen}
        onFechar={() => setIsImportOpen(false)}
        categorias={categorias}
        modelos={modelos}
        criarCategoria={criarCategoria}
        onImportado={refreshData}
      />

      {editingItem && (
        <EstoquePublicarMlModal
          aberto={publicarMlAberto}
          onFechar={() => setPublicarMlAberto(false)}
          item={editingItem}
          modelos={modelos}
          onPublicado={(links) => setEditingItem((prev) => (prev ? { ...prev, links_ml: links } : prev))}
          remocaoFundo={remocaoFundo}
        />
      )}

      {editingItem && (
        <EstoquePublicarShopeeModal
          aberto={publicarShopeeAberto}
          onFechar={() => setPublicarShopeeAberto(false)}
          item={editingItem}
          onPublicado={(links) => setEditingItem((prev) => (prev ? { ...prev, links_shopee: links } : prev))}
        />
      )}

      {familiaModalLinha && (
        <EstoqueFamiliaModal
          linha={familiaModalLinha}
          open={!!familiaModalLinha}
          onClose={() => setFamiliaModalLinha(null)}
          onRefresh={refreshData}
        />
      )}

      {fundirModalAberto && (
        <EstoqueFundirFamiliasModal
          itensAvulsos={items.filter((i) => !i.familia_id && i.ativo)}
          open={fundirModalAberto}
          onClose={() => setFundirModalAberto(false)}
          onRefresh={() => { setFundirModalAberto(false); refreshData(); }}
        />
      )}
    </div>
  );
}
