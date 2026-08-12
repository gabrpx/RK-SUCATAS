// Gerenciamento de modelos de moto em árvore (profundidade livre: Marca >
// Cilindrada > Modelo > Variação por ano, e dá pra ir além manualmente):
// criar raiz e sub-nível em qualquer lugar, renomear, mover pra outro pai,
// excluir (avisando quando a subárvore inteira será removida junto) e
// reordenar irmãos via drag-and-drop (mouse e touch). Espelha
// CategoriaTreeManager.tsx, com um bloco extra no topo ("Nova moto") que cria
// marca+cilindrada+modelo de uma vez só, e um campo "Ano" opcional em
// qualquer nó (aceita período em texto livre, ex: "2004-2008"). Motos com
// carburador/mix/injeção diferentes por ano viram sub-níveis do modelo base
// (ver dica no bloco "Nova moto") — a visualização "Por Moto" do Estoque
// (EstoqueByMoto.tsx) mostra essas variações como cards ao clicar no modelo.
// Por padrão toda a árvore começa recolhida (só as marcas aparecem).
import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Loader2, ChevronRight, ChevronDown, GripVertical, FolderInput, Bike, ChevronsDownUp, ChevronsUpDown, Search, ArrowDownAZ, Camera, ImageOff, List, Network } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../utils';
import { CustomDropdown } from '../../components/CustomDropdown';
import { TreeDropdown, type TreeDropdownNode } from '../../components/TreeDropdown';
import { Modal } from '../../components/ui/Modal';
import { Button } from '@/src/components/ui/button';
import { comprimirImagem } from '../../utils/comprimirImagem';
import { uploadImagemModeloMoto } from '../motos/api';
import { buildTree, filterTree, getDescendantIds, extrairAnoOrdenavel, type ModeloMotoNode } from '../motos/motoTree';
import { MotoOrgChart } from '../motos/MotoOrgChart';
import type { ModeloMoto } from '../../types/catalog';

type ApiResult = { success: boolean; error?: string };

interface MotoTreeManagerProps {
  modelos: ModeloMoto[];
  onCriar: (nome: string, parentId?: string | null, ano?: string | null) => Promise<ApiResult>;
  onCriarRapido: (marca: string, cilindrada: string | null, nome: string, ano?: string | null) => Promise<ApiResult>;
  onRenomear: (id: string, nome: string, ano?: string | null, imagemUrl?: string | null) => Promise<ApiResult>;
  onMover: (id: string, parentId: string | null) => Promise<ApiResult>;
  onReordenar: (ids: string[]) => Promise<ApiResult>;
  onExcluir: (id: string) => Promise<ApiResult>;
}

const ROOT_OPTION_VALUE = '__raiz__';

export function MotoTreeManager({ modelos, onCriar, onCriarRapido, onRenomear, onMover, onReordenar, onExcluir }: MotoTreeManagerProps) {
  const [novaMarca, setNovaMarca] = useState('');
  const [novaCilindrada, setNovaCilindrada] = useState('');
  const [novoNomeMoto, setNovoNomeMoto] = useState('');
  const [novoAnoMoto, setNovoAnoMoto] = useState('');
  const [criandoRapido, setCriandoRapido] = useState(false);
  const [erroRapido, setErroRapido] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'nome_asc' | 'nome_desc' | 'ano_desc' | 'ano_asc' | 'manual'>('nome_asc');
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'organograma'>('lista');

  // Guarda quem está ABERTO (não recolhido) — começa vazio, ou seja, tudo
  // recolhido por padrão até o usuário clicar pra expandir.
  const [expandidoIds, setExpandidoIds] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [anoEditado, setAnoEditado] = useState('');
  const [imagemEditada, setImagemEditada] = useState<string | null>(null);
  const [uploadandoImagem, setUploadandoImagem] = useState(false);
  const inputImagemRef = useRef<HTMLInputElement>(null);
  const [adicionandoSubDe, setAdicionandoSubDe] = useState<string | null>(null);
  const [novoSubNome, setNovoSubNome] = useState('');
  const [novoSubAno, setNovoSubAno] = useState('');
  const [movendoId, setMovendoId] = useState<string | null>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<ModeloMoto | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const comparador = useMemo(() => {
    const anoNum = (m: ModeloMoto) => extrairAnoOrdenavel(m.ano);
    if (sortKey === 'nome_asc') return (a: ModeloMoto, b: ModeloMoto) => a.nome.localeCompare(b.nome, 'pt');
    if (sortKey === 'nome_desc') return (a: ModeloMoto, b: ModeloMoto) => b.nome.localeCompare(a.nome, 'pt');
    if (sortKey === 'ano_desc' || sortKey === 'ano_asc') {
      return (a: ModeloMoto, b: ModeloMoto) => {
        const av = anoNum(a);
        const bv = anoNum(b);
        if (av == null && bv == null) return a.nome.localeCompare(b.nome, 'pt');
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortKey === 'ano_desc' ? bv - av : av - bv;
      };
    }
    return (a: ModeloMoto, b: ModeloMoto) => a.ordem - b.ordem;
  }, [sortKey]);

  const arvoreCompleta = useMemo(() => buildTree(modelos, comparador), [modelos, comparador]);
  const arvore = useMemo(
    () => (searchTerm.trim() ? filterTree(arvoreCompleta, searchTerm) : arvoreCompleta),
    [arvoreCompleta, searchTerm]
  );

  // Enquanto a busca está ativa, força a exibição expandida dos ramos com
  // resultado — sem sujar o estado real de expandido/recolhido, que volta a
  // valer assim que a busca é limpa.
  const idsExpandidosNaBusca = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const ids = new Set<string>();
    const percorrer = (nodes: ModeloMotoNode[]) => {
      nodes.forEach((n) => {
        if (n.children.length > 0) {
          ids.add(n.id);
          percorrer(n.children);
        }
      });
    };
    percorrer(arvore);
    return ids;
  }, [arvore, searchTerm]);

  const idsComFilhos = useMemo(() => {
    const comFilhos = new Set<string>();
    modelos.forEach((m) => {
      if (m.parent_id) comFilhos.add(m.parent_id);
    });
    return comFilhos;
  }, [modelos]);

  const tudoExpandido = idsComFilhos.size > 0 && [...idsComFilhos].every((id) => expandidoIds.has(id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const irmaosDe = (parentId: string | null) =>
    modelos.filter((m) => (m.parent_id ?? null) === parentId).sort((a, b) => a.ordem - b.ordem);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const parentA = (active.data.current?.parentId as string | null) ?? null;
    const parentB = (over.data.current?.parentId as string | null) ?? null;
    if (parentA !== parentB) return; // só reordena dentro do mesmo grupo de irmãos

    const irmaos = irmaosDe(parentA).map((m) => m.id);
    const oldIndex = irmaos.indexOf(String(active.id));
    const newIndex = irmaos.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReordenar(arrayMove(irmaos, oldIndex, newIndex));
  };

  const handleSelecionarImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadandoImagem(true);
    try {
      const { arquivo } = await comprimirImagem(file);
      const result = await uploadImagemModeloMoto(arquivo);
      if (result.success && result.url) setImagemEditada(result.url);
    } finally {
      setUploadandoImagem(false);
    }
  };

  const handleCriarRapido = async () => {
    const marca = novaMarca.trim();
    const nome = novoNomeMoto.trim();
    if (!marca || !nome) return;
    setCriandoRapido(true);
    setErroRapido(null);
    const result = await onCriarRapido(marca, novaCilindrada.trim() || null, nome, novoAnoMoto.trim() || null);
    setCriandoRapido(false);
    if (result.success) {
      setNovaMarca('');
      setNovaCilindrada('');
      setNovoNomeMoto('');
      setNovoAnoMoto('');
    } else {
      setErroRapido(result.error || 'Erro ao criar');
    }
  };

  // Nós elegíveis como novo pai — exclui o próprio nó e toda a subárvore dele
  // (não dá pra mover um modelo pra dentro dele mesmo).
  const nosParaMover = (idExcluido: string): TreeDropdownNode[] => {
    const bloqueados = new Set(getDescendantIds(idExcluido, modelos));
    return modelos
      .filter((m) => !bloqueados.has(m.id))
      .map((m) => ({ id: m.id, nome: m.nome, parent_id: m.parent_id, ordem: m.ordem, secundario: m.ano }));
  };

  const totalRaizes = arvoreCompleta.length;
  const borderGuia = 'border-border-default';
  const inputClass = cn(
    'flex-1 border rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-accent/50',
    'bg-surface-inset border-border-default text-text-primary'
  );

  return (
    <div className={cn('rounded-3xl border overflow-hidden', 'bg-surface-card border-border-subtle')}>
      <div className={cn('flex items-center gap-3 p-5 border-b', 'border-border-default/50')}>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', 'bg-accent/10 text-accent')}>
          <Bike size={18} />
        </div>
        <div className="min-w-0">
          <h3 className={cn('font-black text-sm', 'text-text-primary')}>Motos</h3>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{modelos.length} cadastrado(s) · {totalRaizes} marca(s)</p>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 rounded-control bg-surface-inset border border-border-default">
            <button
              type="button"
              onClick={() => setModoVisualizacao('lista')}
              className={cn(
                'px-2.5 py-1.5 rounded-control text-[10px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5',
                modoVisualizacao === 'lista' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <List size={12} /> <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao('organograma')}
              className={cn(
                'px-2.5 py-1.5 rounded-control text-[10px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5',
                modoVisualizacao === 'organograma' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Network size={12} /> <span className="hidden sm:inline">Organograma</span>
            </button>
          </div>
          {modoVisualizacao === 'lista' && idsComFilhos.size > 0 && (
            <button
              onClick={() => setExpandidoIds(tudoExpandido ? new Set() : new Set(idsComFilhos))}
              className={cn(
                'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-colors shrink-0',
                'text-text-muted hover:text-accent hover:bg-accent/10'
              )}
            >
              {tudoExpandido ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
              <span className="hidden sm:inline">{tudoExpandido ? 'Recolher tudo' : 'Expandir tudo'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className={cn('flex-1 flex items-center gap-2 rounded-xl border px-3', 'bg-surface-inset border-border-default')}>
            <Search size={15} className="text-text-muted shrink-0" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar moto (marca, modelo ou ano)..."
              className="flex-1 py-2.5 bg-transparent outline-none text-sm"
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')} className="size-5 rounded-full text-text-muted hover:text-text-muted shrink-0">
                <X size={13} />
              </Button>
            )}
          </div>
          <CustomDropdown
            icon={<ArrowDownAZ size={14} />}
            value={sortKey}
            onChange={(v) => setSortKey(v as typeof sortKey)}
            options={[
              { value: 'nome_asc', label: 'Ordem alfabética (A-Z)' },
              { value: 'nome_desc', label: 'Ordem alfabética (Z-A)' },
              { value: 'ano_desc', label: 'Ano (mais recente)' },
              { value: 'ano_asc', label: 'Ano (mais antigo)' },
              { value: 'manual', label: 'Ordem manual (arrastar)' },
            ]}
          />
        </div>

        {modoVisualizacao === 'lista' && (
          <div className={cn('rounded-2xl border p-4 space-y-2', 'border-border-default bg-surface-inset/40')}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Nova moto</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={novaMarca} onChange={(e) => setNovaMarca(e.target.value)} placeholder="Marca (ex: Honda)" className={inputClass} />
              <input value={novaCilindrada} onChange={(e) => setNovaCilindrada(e.target.value)} placeholder="Cilindrada (ex: 150)" className={inputClass} />
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input
                value={novoNomeMoto}
                onChange={(e) => setNovoNomeMoto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCriarRapido()}
                placeholder="Nome da moto (ex: Bros NXR 150)"
                className={inputClass}
              />
              <input
                value={novoAnoMoto}
                onChange={(e) => setNovoAnoMoto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCriarRapido()}
                placeholder="Ano"
                className={cn(inputClass, 'flex-none w-20')}
              />
              <Button
                size="icon"
                onClick={handleCriarRapido}
                disabled={criandoRapido || !novaMarca.trim() || !novoNomeMoto.trim()}
                className="rounded-xl shrink-0"
              >
                {criandoRapido ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </Button>
            </div>
            {erroRapido && <p className="text-xs text-danger">{erroRapido}</p>}
            <p className="text-[11px] text-text-muted leading-relaxed">
              Moto com versões diferentes por ano (ex: carburada, mix, injetada)? Cadastre o modelo base aqui (sem ano) e depois clique no{' '}
              <Plus size={11} className="inline -mt-0.5" /> dele pra adicionar cada versão como sub-nível, com nome ("Carburada") e período ("2004-2008") no campo Ano.
            </p>
          </div>
        )}

        <input ref={inputImagemRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleSelecionarImagem} />

        {modoVisualizacao === 'organograma' ? (
          <div className="max-h-[34rem] overflow-y-auto pr-1 pt-2">
            <MotoOrgChart
              modelos={modelos}
              arvore={arvore}
              forceExpandedIds={idsExpandidosNaBusca}
              emptyMessage={searchTerm.trim() ? `Nenhum resultado para "${searchTerm.trim()}".` : 'Nenhuma moto cadastrada ainda.'}
            />
          </div>
        ) : arvore.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            {searchTerm.trim() ? `Nenhum resultado para "${searchTerm.trim()}".` : 'Nenhuma moto cadastrada ainda.'}
          </p>
        ) : (
          <div className="max-h-[30rem] overflow-y-auto pr-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <MotoNivel
                nodes={arvore}
                parentId={null}
                depth={0}
                h={{
                  borderGuia,
                  arrastavel: sortKey === 'manual',
                  expandidoIds: idsExpandidosNaBusca ?? expandidoIds,
                  onToggleExpandido: (id) =>
                    setExpandidoIds((prev) => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    }),
                  editandoId,
                  nomeEditado,
                  setNomeEditado,
                  anoEditado,
                  setAnoEditado,
                  imagemEditada,
                  uploadandoImagem,
                  onEscolherImagem: () => inputImagemRef.current?.click(),
                  onRemoverImagem: () => setImagemEditada(null),
                  onIniciarEdicao: (node) => {
                    setEditandoId(node.id);
                    setNomeEditado(node.nome);
                    setAnoEditado(node.ano || '');
                    setImagemEditada(node.imagem_url || null);
                  },
                  onCancelarEdicao: () => setEditandoId(null),
                  onSalvarEdicao: async (id) => {
                    const nome = nomeEditado.trim();
                    if (!nome) return;
                    const result = await onRenomear(id, nome, anoEditado.trim() || null, imagemEditada);
                    if (result.success) setEditandoId(null);
                  },
                  adicionandoSubDe,
                  novoSubNome,
                  setNovoSubNome,
                  novoSubAno,
                  setNovoSubAno,
                  onIniciarSub: (id) => {
                    setAdicionandoSubDe(id);
                    setNovoSubNome('');
                    setNovoSubAno('');
                    setExpandidoIds((prev) => new Set(prev).add(id));
                  },
                  onCancelarSub: () => setAdicionandoSubDe(null),
                  onCriarSub: async (parentId) => {
                    const nome = novoSubNome.trim();
                    if (!nome) return;
                    const result = await onCriar(nome, parentId, novoSubAno.trim() || null);
                    if (result.success) setAdicionandoSubDe(null);
                  },
                  movendoId,
                  setMovendoId,
                  nosParaMover,
                  onMover: async (id, parentId) => {
                    await onMover(id, parentId);
                    setMovendoId(null);
                  },
                  onPedirExclusao: (node) => setItemParaExcluir(node),
                }}
              />
            </DndContext>
          </div>
        )}
      </div>

      <Modal
        aberto={!!itemParaExcluir}
        onFechar={() => {
          setItemParaExcluir(null);
          setErroExclusao(null);
        }}
        titulo={itemParaExcluir ? `Excluir "${itemParaExcluir.nome}"?` : 'Excluir?'}
        icone={Trash2}
        tamanho="sm"
        rodape={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setItemParaExcluir(null);
                setErroExclusao(null);
              }}
              className="h-auto flex-1 py-3 rounded-2xl font-bold text-sm"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!itemParaExcluir) return;
                setExcluindo(true);
                setErroExclusao(null);
                const result = await onExcluir(itemParaExcluir.id);
                setExcluindo(false);
                if (result.success) setItemParaExcluir(null);
                else setErroExclusao(result.error || 'Erro ao excluir');
              }}
              disabled={excluindo}
              className="h-auto flex-1 py-3 rounded-2xl font-bold text-sm"
            >
              {excluindo ? <Loader2 size={16} className="animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        }
      >
        {itemParaExcluir && (
          <>
            <p className="text-sm text-text-muted">
              {getDescendantIds(itemParaExcluir.id, modelos).length > 1
                ? `Isso também excluirá os ${getDescendantIds(itemParaExcluir.id, modelos).length - 1} sub-nível(is) abaixo dele. Essa ação não pode ser desfeita.`
                : 'Essa ação não pode ser desfeita.'}
            </p>
            {erroExclusao && <p className="text-xs text-danger mt-3">{erroExclusao}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}

// Handlers/estado compartilhados por toda a árvore — passados por referência
// (não espalhados via JSX spread) pra cada nível/linha recursiva.
interface ArvoreHandlers {
  borderGuia: string;
  arrastavel: boolean;
  expandidoIds: Set<string>;
  onToggleExpandido: (id: string) => void;
  editandoId: string | null;
  nomeEditado: string;
  setNomeEditado: (v: string) => void;
  anoEditado: string;
  setAnoEditado: (v: string) => void;
  imagemEditada: string | null;
  uploadandoImagem: boolean;
  onEscolherImagem: () => void;
  onRemoverImagem: () => void;
  onIniciarEdicao: (node: ModeloMoto) => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: (id: string) => void;
  adicionandoSubDe: string | null;
  novoSubNome: string;
  setNovoSubNome: (v: string) => void;
  novoSubAno: string;
  setNovoSubAno: (v: string) => void;
  onIniciarSub: (id: string) => void;
  onCancelarSub: () => void;
  onCriarSub: (parentId: string) => void;
  movendoId: string | null;
  setMovendoId: (id: string | null) => void;
  nosParaMover: (id: string) => TreeDropdownNode[];
  onMover: (id: string, parentId: string | null) => void;
  onPedirExclusao: (node: ModeloMoto) => void;
}

interface MotoNivelProps {
  nodes: ModeloMotoNode[];
  parentId: string | null;
  depth: number;
  h: ArvoreHandlers;
}

function MotoNivel({ nodes, parentId, depth, h }: MotoNivelProps) {
  return (
    <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
      {nodes.map((node) => (
        <React.Fragment key={node.id}>
          <MotoRow node={node} parentId={parentId} depth={depth} h={h} />
        </React.Fragment>
      ))}
    </SortableContext>
  );
}

function MotoRow({ node, parentId, depth, h }: { node: ModeloMotoNode; parentId: string | null; depth: number; h: ArvoreHandlers }) {
  const { borderGuia, expandidoIds, onToggleExpandido } = h;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { parentId },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const temFilhos = node.children.length > 0;
  const expandido = expandidoIds.has(node.id);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-xl',
          'hover:bg-surface-raised'
        )}
      >
        <button
          {...(h.arrastavel ? { ...attributes, ...listeners } : {})}
          className={cn(
            'p-1.5 shrink-0 touch-none',
            h.arrastavel ? 'text-text-muted cursor-grab active:cursor-grabbing' : 'text-text-muted opacity-40 cursor-not-allowed'
          )}
          title={h.arrastavel ? 'Arrastar para reordenar' : 'Disponível apenas em Ordem manual (arrastar)'}
        >
          <GripVertical size={14} />
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => temFilhos && onToggleExpandido(node.id)}
          className={cn('size-5 text-text-muted', !temFilhos && 'opacity-0 pointer-events-none')}
        >
          {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </Button>

        <div className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2 py-2">
          {h.editandoId === node.id ? (
            <>
              <input
                autoFocus
                value={h.nomeEditado}
                onChange={(e) => h.setNomeEditado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') h.onSalvarEdicao(node.id);
                  if (e.key === 'Escape') h.onCancelarEdicao();
                }}
                className={cn(
                  'flex-1 border rounded-lg py-1.5 px-3 text-sm outline-none',
                  'bg-surface-inset border-accent/50 text-text-primary'
                )}
              />
              <input
                value={h.anoEditado}
                onChange={(e) => h.setAnoEditado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') h.onSalvarEdicao(node.id);
                  if (e.key === 'Escape') h.onCancelarEdicao();
                }}
                placeholder="Ano"
                title="Ano único (2015) ou período (2004-2008)"
                className={cn(
                  'w-16 border rounded-lg py-1.5 px-2 text-sm outline-none shrink-0',
                  'bg-surface-inset border-accent/50 text-text-primary'
                )}
              />
              {!temFilhos && (
                <button
                  type="button"
                  onClick={h.onEscolherImagem}
                  disabled={h.uploadandoImagem}
                  title={h.imagemEditada ? 'Trocar foto' : 'Adicionar foto'}
                  className={cn(
                    'size-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border',
                    'border-border-default bg-surface-inset'
                  )}
                >
                  {h.uploadandoImagem ? (
                    <Loader2 size={13} className="animate-spin text-text-muted" />
                  ) : h.imagemEditada ? (
                    <img src={h.imagemEditada} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={14} className="text-text-muted" />
                  )}
                </button>
              )}
              {!temFilhos && h.imagemEditada && (
                <Button variant="ghost" size="icon" onClick={h.onRemoverImagem} className="size-7 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 shrink-0" title="Remover foto">
                  <ImageOff size={13} />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => h.onSalvarEdicao(node.id)} className="size-7 rounded-lg text-positive hover:text-positive hover:bg-positive/10 shrink-0">
                <Check size={14} />
              </Button>
              <Button variant="ghost" size="icon" onClick={h.onCancelarEdicao} className="size-7 rounded-lg text-text-muted shrink-0">
                <X size={14} />
              </Button>
            </>
          ) : h.movendoId === node.id ? (
            <>
              <TreeDropdown
                variant="form"
                className="flex-1"
                nodes={h.nosParaMover(node.id)}
                value={node.parent_id ?? ROOT_OPTION_VALUE}
                onChange={(value) => h.onMover(node.id, value === ROOT_OPTION_VALUE ? null : value)}
                emptyOption={{ value: ROOT_OPTION_VALUE, label: '— Marca raiz —' }}
                searchPlaceholder="Buscar moto..."
              />
              <Button variant="ghost" size="icon" onClick={() => h.setMovendoId(null)} className="size-7 rounded-lg text-text-muted shrink-0">
                <X size={14} />
              </Button>
            </>
          ) : (
            <>
              <span
                onClick={() => temFilhos && onToggleExpandido(node.id)}
                className={cn(
                  'flex items-center gap-2 text-sm truncate min-w-0',
                  temFilhos && 'cursor-pointer',
                  temFilhos ? 'font-bold' : 'font-medium',
                  'text-text-primary'
                )}
              >
                <span className="truncate">
                  {node.nome}
                  {node.ano && <span className="text-text-muted font-normal"> ({node.ano})</span>}
                </span>
                {temFilhos && (
                  <span
                    className={cn(
                      'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      'bg-surface-raised text-text-muted'
                    )}
                  >
                    {node.children.length}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => h.onIniciarSub(node.id)} className="size-7 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10" title="Adicionar sub-nível">
                  <Plus size={13} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => h.setMovendoId(node.id)} className="size-7 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10" title="Mover para outro nível">
                  <FolderInput size={13} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => h.onIniciarEdicao(node)} className="size-7 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10" title="Renomear">
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => h.onPedirExclusao(node)} className="size-7 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10" title="Excluir">
                  <Trash2 size={13} />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {h.adicionandoSubDe === node.id && (
        <div className={cn('ml-3 pl-5 border-l', borderGuia)}>
          <div className="flex items-center gap-2 py-1.5">
            <input
              autoFocus
              value={h.novoSubNome}
              onChange={(e) => h.setNovoSubNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') h.onCriarSub(node.id);
                if (e.key === 'Escape') h.onCancelarSub();
              }}
              placeholder='Nome do sub-nível... (ex: "Carburada")'
              className={cn(
                'flex-1 border rounded-lg py-1.5 px-3 text-sm outline-none',
                'bg-surface-inset border-accent/50 text-text-primary'
              )}
            />
            <input
              value={h.novoSubAno}
              onChange={(e) => h.setNovoSubAno(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') h.onCriarSub(node.id);
                if (e.key === 'Escape') h.onCancelarSub();
              }}
              placeholder="Ano"
              title="Ano único (2015) ou período (2004-2008)"
              className={cn(
                'w-16 border rounded-lg py-1.5 px-2 text-sm outline-none shrink-0',
                'bg-surface-inset border-accent/50 text-text-primary'
              )}
            />
            <Button variant="ghost" size="icon" onClick={() => h.onCriarSub(node.id)} className="size-7 rounded-lg text-positive hover:text-positive hover:bg-positive/10 shrink-0">
              <Check size={14} />
            </Button>
            <Button variant="ghost" size="icon" onClick={h.onCancelarSub} className="size-7 rounded-lg text-text-muted shrink-0">
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {temFilhos && expandido && (
        <div className={cn('ml-3 pl-5 border-l', borderGuia)}>
          <MotoNivel nodes={node.children} parentId={node.id} depth={depth + 1} h={h} />
        </div>
      )}
    </div>
  );
}
