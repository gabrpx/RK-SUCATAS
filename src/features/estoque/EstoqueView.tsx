// Aba Estoque: catálogo de peças com categoria/modelo de moto (tabelas de
// apoio, com criação rápida inline) e condição Original/Paralela.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
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
  AlertTriangle,
  Upload,
  Camera,
  ChevronDown,
  ExternalLink,
  FileSpreadsheet,
  Download,
  Pencil,
  Network,
  Send,
} from 'lucide-react';
import { cn } from '../../utils';
import { Button } from '../../components/ui/button';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useDebounce } from '../../hooks/useDebounce';
import { CustomDropdown } from '../../components/CustomDropdown';
import { MotoCascadeSelect } from '../../components/MotoCascadeSelect';
import { CategoriaCascadeSelect } from '../../components/CategoriaCascadeSelect';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { Switch } from '../../components/ui/switch';
import { estoqueApi, uploadImagemEstoque } from './api';
import { EstoqueAnunciosMlEditor } from './EstoqueAnunciosMlEditor';
import { EstoquePublicarMlModal } from './EstoquePublicarMlModal';
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
import { TreeDropdown, type TreeDropdownNode } from '../../components/TreeDropdown';
import type { CondicaoPeca, Estoque, EstoqueInput } from './types';
import type { DataTableColumn } from '../../components/ui/DataTable';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

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

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visualizacao, setVisualizacao] = useState<'lista' | 'por_moto' | 'organograma'>('lista');
  const [orgChartDominio, setOrgChartDominio] = useState<'categorias' | 'motos'>('categorias');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [modeloFiltro, setModeloFiltro] = useState('Todas');
  const [sortKey, setSortKey] = useState<'criado_em' | 'valor' | 'quantidade'>('criado_em');
  const [soEstoqueBaixo, setSoEstoqueBaixo] = useState(false);
  // Peça cadastrada às pressas costuma ficar sem preço — este filtro é como
  // se volta nelas depois pra fechar o valor do estoque.
  const [soSemPreco, setSoSemPreco] = useState(false);
  const [soComAvaria, setSoComAvaria] = useState(false);
  const [soSemFoto, setSoSemFoto] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Estoque | null>(null);
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
  // Quantas peças saíram deste modal sem ele fechar — feedback do
  // "salvar e cadastrar próxima" durante a catalogação em massa.
  const [salvasEmSequencia, setSalvasEmSequencia] = useState(0);
  // Quanto a foto encolheu no celular antes de subir; some no próximo upload.
  const [resumoCompressao, setResumoCompressao] = useState<string | null>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
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
  const handleUploadImagem = async (files: FileList) => {
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
            item.modelo_moto?.nome?.toLowerCase().includes(t) ||
            item.modelos_compativeis?.some((m) => m.nome.toLowerCase().includes(t))
        );
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
      return matchesSearch && matchesCategoria && matchesModelo && matchesEstoqueBaixo && matchesSemPreco && matchesAvaria && matchesSemFoto;
    });

    result = [...result].sort((a, b) => {
      if (sortKey === 'valor') return b.valor - a.valor;
      if (sortKey === 'quantidade') return b.quantidade - a.quantidade;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });
    return result;
  }, [items, debouncedSearch, categoriaFiltro, modeloFiltro, soEstoqueBaixo, soSemPreco, soComAvaria, soSemFoto, sortKey, categorias, modelos]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [debouncedSearch, categoriaFiltro, modeloFiltro, soEstoqueBaixo, soSemPreco, soComAvaria, soSemFoto, sortKey]);

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
            {item.imagens[0] ? (
              <img src={item.imagens[0]} alt={item.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Package size={16} className="text-text-faint" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[12.5px] font-medium text-text-primary truncate max-w-[240px]">{item.nome}</p>
              <CondicaoNotaBadge nota={item.condicao_nota} />
              {/* Contagem de fichas é informativa (nem toda ficha é avaria) —
                  o aviso de avaria fica separado, no badge seguinte. */}
              {contarFichas(item) > 0 && (
                <span title={`${contarFichas(item)} unidade(s) com ficha própria (nota, avaria, apelido ou preço diferente)`}>
                  <StatusBadge tom="neutral" texto={`${contarFichas(item)} ${contarFichas(item) === 1 ? 'ficha' : 'fichas'}`} />
                </span>
              )}
              {/* Unidade avariada não vira linha separada — o aviso vive aqui,
                  e o detalhe mostra qual unidade é. */}
              {temAvaria(item) && (
                <span
                  title={`${contarAvarias(item)} unidade(s) com avaria`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-badge bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium leading-none text-warning"
                >
                  <AlertTriangle size={9} />
                  {contarAvarias(item)}
                </span>
              )}
              {/* Persistente — antes só existia um aviso pontual no momento da
                  venda, sem jeito de saber disso navegando a lista. */}
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
          <AnuncioBadge label="ML" canal="Mercado Livre" count={item.links_ml?.length ?? 0} onAbrir={() => abrirAnunciosMl(item)} />
          <AnuncioBadge label="FB" canal="Facebook" count={item.anuncio_fb_url ? 1 : 0} onAbrir={() => window.open(item.anuncio_fb_url!, '_blank', 'noopener,noreferrer')} />
        </div>
      ),
    },
    {
      key: 'valor',
      header: <SortableHeader label="Valor" ownKey="valor" align="right" />,
      align: 'right',
      render: (item) =>
        item.valor > 0 ? (
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
            {/* Alguma unidade tem preço próprio: mostra o total real da linha,
                senão o valor daria a entender preço × quantidade. */}
            {(item.unidades ?? []).some((u) => u.valor !== null && u.valor !== undefined) && (
              <span className="text-[10px] text-accent-soft-fg tabular-nums">total {formatCurrency(valorTotalItem(item))}</span>
            )}
          </div>
        ) : readOnly ? (
          <span className="text-sm font-medium text-danger">{formatCurrency(item.valor)}</span>
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

  // Mesmas colunas acima, empilhadas verticalmente — usado pelo DataTable
  // abaixo de `md`, onde a tabela só rolaria horizontalmente.
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
            <p className="text-sm font-medium text-text-primary truncate">{item.nome}</p>
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
            title="Sincronizar"
            className="h-10 px-3 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 hover:text-text-primary"
          >
            <RefreshCw size={14} className={cn((loading || isRefreshing) && 'animate-spin')} />
            <span className="hidden lg:inline">Sincronizar</span>
          </button>
          <button
            onClick={exportarCsv}
            disabled={items.length === 0}
            title="Exportar estoque em CSV (backup)"
            className="h-10 px-3 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 hover:text-text-primary"
          >
            <Download size={14} />
            <span className="hidden lg:inline">Exportar</span>
          </button>
          {!readOnly && (
            <>
              <button
                onClick={() => setIsImportOpen(true)}
                title="Importar peças de uma planilha"
                className="h-10 px-3 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 hover:text-text-primary"
              >
                <FileSpreadsheet size={14} />
                <span className="hidden lg:inline">Importar</span>
              </button>
              <button onClick={openCreateModal} className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90">
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
            <p className="text-[20px] font-medium text-text-primary leading-none tabular-nums">{resumoDoDia.itens}</p>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mt-1.5">
              {resumoDoDia.itens === 1 ? 'peça cadastrada hoje' : 'peças cadastradas hoje'}
            </p>
          </div>
          <div className="h-8 w-px bg-border-subtle hidden sm:block" />
          <div>
            <p className="text-[20px] font-medium text-text-primary leading-none tabular-nums">{formatCurrency(resumoDoDia.valorTotal)}</p>
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

      {/* Alternância Lista / Por Moto / Organograma */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-control bg-surface-inset border border-border-default">
          <button
            type="button"
            onClick={() => setVisualizacao('lista')}
            className={cn(
              'px-3 py-1.5 rounded-control text-[11px] font-semibold uppercase tracking-wider transition-colors',
              visualizacao === 'lista' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao('por_moto')}
            className={cn(
              'px-3 py-1.5 rounded-control text-[11px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5',
              visualizacao === 'por_moto' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Bike size={13} /> Por moto
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao('organograma')}
            className={cn(
              'px-3 py-1.5 rounded-control text-[11px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5',
              visualizacao === 'organograma' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Network size={13} /> Organograma
          </button>
        </div>

        {visualizacao === 'organograma' && (
          <div className="inline-flex items-center gap-1 p-1 rounded-control bg-surface-inset border border-border-default">
            <button
              type="button"
              onClick={() => setOrgChartDominio('categorias')}
              className={cn(
                'px-2.5 py-1 rounded-control text-[10.5px] font-semibold uppercase tracking-wider transition-colors',
                orgChartDominio === 'categorias' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Categorias
            </button>
            <button
              type="button"
              onClick={() => setOrgChartDominio('motos')}
              className={cn(
                'px-2.5 py-1 rounded-control text-[10.5px] font-semibold uppercase tracking-wider transition-colors',
                orgChartDominio === 'motos' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Motos
            </button>
          </div>
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
              <TreeDropdown
                icon={<Filter size={14} />}
                value={categoriaFiltro}
                onChange={setCategoriaFiltro}
                nodes={categoriaNodes}
                emptyOption={{ value: 'Todas', label: 'Todas categorias' }}
                searchPlaceholder="Buscar categoria..."
                emptyMessage="Nenhuma categoria encontrada."
              />
              <TreeDropdown
                icon={<Bike size={14} />}
                value={modeloFiltro}
                onChange={setModeloFiltro}
                nodes={modeloNodes}
                emptyOption={{ value: 'Todas', label: 'Todos modelos' }}
                searchPlaceholder="Buscar moto..."
                emptyMessage="Nenhuma moto encontrada."
              />
              <CustomDropdown
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
              <button
                onClick={() => setSoSemPreco((v) => !v)}
                className={cn(
                  'h-10 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors',
                  soSemPreco ? 'bg-warning-bg border-warning/30 text-warning' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
                )}
              >
                Sem preço
                {soSemPreco && <X size={12} />}
              </button>
              {(itensComAvaria > 0 || soComAvaria) && (
                <button
                  onClick={() => setSoComAvaria((v) => !v)}
                  className={cn(
                    'h-10 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors',
                    soComAvaria ? 'bg-warning-bg border-warning/30 text-warning' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
                  )}
                >
                  Com avaria
                  <span className={cn('px-1.5 py-0.5 rounded-badge text-[10px]', soComAvaria ? 'bg-warning/20' : 'bg-surface-raised')}>{itensComAvaria}</span>
                  {soComAvaria && <X size={12} />}
                </button>
              )}
              <button
                onClick={() => setSoSemFoto((v) => !v)}
                className={cn(
                  'h-10 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors',
                  soSemFoto ? 'bg-warning-bg border-warning/30 text-warning' : 'bg-surface-inset border-border-default text-text-muted hover:text-text-secondary'
                )}
              >
                Sem foto
                {soSemFoto && <X size={12} />}
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
            renderMobileCard={renderMobileCard}
            paginaAtual={currentPage}
            totalPaginas={totalPaginas}
            onMudarPagina={setCurrentPage}
            emptyState={
              loading && items.length === 0 ? (
                <div className="py-12 flex items-center justify-center text-text-faint">
                  <Loader2 size={20} className="animate-spin" />
            </div>
          ) : estoqueError && items.length === 0 ? (
            <EmptyState
              icone={RefreshCw}
              mensagem="Não foi possível carregar o estoque. Verifique sua conexão."
              acaoLabel="Tentar novamente"
              onAcao={refreshData}
            />
          ) : (
            <EmptyState
              icone={Package}
              mensagem={items.length === 0 ? 'Nenhuma peça cadastrada ainda.' : 'Nenhum item corresponde aos filtros aplicados.'}
              acaoLabel={items.length === 0 && !readOnly ? 'Cadastrar peça' : undefined}
              onAcao={items.length === 0 && !readOnly ? openCreateModal : undefined}
            />
          )
        }
          />
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

                  {formData.imagens.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.imagens.map((url, i) => (
                        <div key={url} className="relative size-20 rounded-control overflow-hidden border border-border-default">
                          <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          {i === 0 && (
                            <span className="absolute bottom-0 inset-x-0 bg-media-overlay-badge text-white text-[9px] font-semibold uppercase tracking-wide text-center py-0.5">Capa</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, imagens: prev.imagens.filter((u) => u !== url) }))}
                            title="Remover foto"
                            className="absolute top-1 right-1 size-6 rounded-full bg-overlay-scrim text-white flex items-center justify-center hover:bg-danger"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {/* Câmera separada da galeria: no celular abre direto a
                        câmera (um toque a menos por peça) sem tirar a opção
                        de escolher fotos já salvas. Escondida no desktop,
                        onde `capture` não significa nada. */}
                    <button
                      type="button"
                      onClick={() => inputCameraRef.current?.click()}
                      disabled={isUploadingImagem}
                      className="md:hidden flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider transition-colors border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg disabled:opacity-50"
                    >
                      {isUploadingImagem ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Câmera
                    </button>
                    <button
                      type="button"
                      onClick={() => inputGaleriaRef.current?.click()}
                      disabled={isUploadingImagem}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider transition-colors border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg disabled:opacity-50"
                    >
                      {isUploadingImagem ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      <span className="md:hidden">{isUploadingImagem ? 'Enviando...' : 'Galeria'}</span>
                      <span className="hidden md:inline">
                        {isUploadingImagem ? 'Enviando...' : formData.imagens.length > 0 ? 'Adicionar mais fotos' : 'Anexar fotos'}
                      </span>
                    </button>
                  </div>
                  <input
                    ref={inputCameraRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleUploadImagem(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={inputGaleriaRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleUploadImagem(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  {resumoCompressao && <p className="text-[11px] text-positive">{resumoCompressao}</p>}
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
                      <Switch checked={publicarMlAtivo} onCheckedChange={setPublicarMlAtivo} />
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
          onPublicado={(links) => setEditingItem((prev) => (prev ? { ...prev, links_ml: links } : prev))}
        />
      )}
    </div>
  );
}
