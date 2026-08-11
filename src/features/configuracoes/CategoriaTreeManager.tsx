// Gerenciamento de categorias em árvore (profundidade livre): criar raiz e
// subcategoria em qualquer nível, renomear, mover pra outro pai, excluir
// (avisando quando a subárvore inteira será removida junto) e reordenar
// irmãos via drag-and-drop (mouse e touch). Mesmo visual/interação do
// ManageListSection (usado por Formas de Pagamento), só que recursivo.
// Por padrão toda a árvore começa recolhida (só as raízes aparecem) — o
// usuário abre só o que precisa, em vez de receber a lista inteira já expandida.
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Loader2, ChevronRight, ChevronDown, GripVertical, FolderInput, Layers, ChevronsDownUp, ChevronsUpDown, Search, ArrowDownAZ, List, Network } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../utils';
import { CustomDropdown } from '../../components/CustomDropdown';
import { TreeDropdown, type TreeDropdownNode } from '../../components/TreeDropdown';
import { Modal } from '../../components/ui/Modal';
import { buildTree, filterTree, getDescendantIds, type CategoriaNode } from '../categorias/categoriaTree';
import { CategoriaOrgChart } from '../categorias/CategoriaOrgChart';
import type { Categoria } from '../../types/catalog';

type ApiResult = { success: boolean; error?: string };

interface CategoriaTreeManagerProps {
  categorias: Categoria[];
  onCriar: (nome: string, parentId?: string | null) => Promise<ApiResult>;
  onRenomear: (id: string, nome: string) => Promise<ApiResult>;
  onMover: (id: string, parentId: string | null) => Promise<ApiResult>;
  onReordenar: (ids: string[]) => Promise<ApiResult>;
  onExcluir: (id: string) => Promise<ApiResult>;
}

const ROOT_OPTION_VALUE = '__raiz__';

export function CategoriaTreeManager({ categorias, onCriar, onRenomear, onMover, onReordenar, onExcluir }: CategoriaTreeManagerProps) {
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'nome_asc' | 'nome_desc' | 'manual'>('nome_asc');
  const [modoVisualizacao, setModoVisualizacao] = useState<'lista' | 'organograma'>('lista');

  // Guarda quem está ABERTO (não recolhido) — começa vazio, ou seja, tudo
  // recolhido por padrão até o usuário clicar pra expandir.
  const [expandidoIds, setExpandidoIds] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [adicionandoSubDe, setAdicionandoSubDe] = useState<string | null>(null);
  const [novoSubNome, setNovoSubNome] = useState('');
  const [movendoId, setMovendoId] = useState<string | null>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<Categoria | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const comparador = useMemo(() => {
    if (sortKey === 'nome_asc') return (a: Categoria, b: Categoria) => a.nome.localeCompare(b.nome, 'pt');
    if (sortKey === 'nome_desc') return (a: Categoria, b: Categoria) => b.nome.localeCompare(a.nome, 'pt');
    return (a: Categoria, b: Categoria) => a.ordem - b.ordem;
  }, [sortKey]);

  const arvoreCompleta = useMemo(() => buildTree(categorias, comparador), [categorias, comparador]);
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
    const percorrer = (nodes: CategoriaNode[]) => {
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
    categorias.forEach((c) => {
      if (c.parent_id) comFilhos.add(c.parent_id);
    });
    return comFilhos;
  }, [categorias]);

  const tudoExpandido = idsComFilhos.size > 0 && [...idsComFilhos].every((id) => expandidoIds.has(id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const irmaosDe = (parentId: string | null) =>
    categorias.filter((c) => (c.parent_id ?? null) === parentId).sort((a, b) => a.ordem - b.ordem);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const parentA = (active.data.current?.parentId as string | null) ?? null;
    const parentB = (over.data.current?.parentId as string | null) ?? null;
    if (parentA !== parentB) return; // só reordena dentro do mesmo grupo de irmãos

    const irmaos = irmaosDe(parentA).map((c) => c.id);
    const oldIndex = irmaos.indexOf(String(active.id));
    const newIndex = irmaos.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReordenar(arrayMove(irmaos, oldIndex, newIndex));
  };

  const handleCriarRaiz = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setCriando(true);
    setErroCriar(null);
    const result = await onCriar(nome, null);
    if (result.success) setNovoNome('');
    else setErroCriar(result.error || 'Erro ao criar');
    setCriando(false);
  };

  // Nós elegíveis como novo pai — exclui a própria categoria e toda a
  // subárvore dela (não dá pra mover uma categoria pra dentro dela mesma).
  const nosParaMover = (idExcluido: string): TreeDropdownNode[] => {
    const bloqueados = new Set(getDescendantIds(idExcluido, categorias));
    return categorias.filter((c) => !bloqueados.has(c.id)).map((c) => ({ id: c.id, nome: c.nome, parent_id: c.parent_id, ordem: c.ordem }));
  };

  const totalRaizes = arvoreCompleta.length;
  const borderGuia = 'border-border-default';

  return (
    <div className={cn('rounded-3xl border overflow-hidden', 'bg-surface-card border-border-subtle')}>
      <div className={cn('flex items-center gap-3 p-5 border-b', 'border-border-default/50')}>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', 'bg-accent/10 text-accent')}>
          <Layers size={18} />
        </div>
        <div className="min-w-0">
          <h3 className={cn('font-black text-sm', 'text-text-primary')}>Categorias de Peça</h3>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{categorias.length} cadastrada(s) · {totalRaizes} raiz(es)</p>
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
              placeholder="Buscar categoria..."
              className="flex-1 py-2.5 bg-transparent outline-none text-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="p-1 rounded-full hover:bg-surface-raised text-text-muted shrink-0">
                <X size={13} />
              </button>
            )}
          </div>
          <CustomDropdown
            icon={<ArrowDownAZ size={14} />}
            value={sortKey}
            onChange={(v) => setSortKey(v as typeof sortKey)}
            options={[
              { value: 'nome_asc', label: 'Ordem alfabética (A-Z)' },
              { value: 'nome_desc', label: 'Ordem alfabética (Z-A)' },
              { value: 'manual', label: 'Ordem manual (arrastar)' },
            ]}
          />
        </div>

        {modoVisualizacao === 'lista' && (
          <>
            <div className="flex items-center gap-2">
              <input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCriarRaiz()}
                placeholder="Nova categoria raiz..."
                className={cn(
                  'flex-1 border rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-accent/50',
                  'bg-surface-inset border-border-default text-text-primary'
                )}
              />
              <button
                onClick={handleCriarRaiz}
                disabled={criando || !novoNome.trim()}
                className="p-2.5 rounded-xl bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-colors shrink-0"
              >
                {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>
            {erroCriar && <p className="text-xs text-danger">{erroCriar}</p>}
          </>
        )}

        {modoVisualizacao === 'organograma' ? (
          <div className="max-h-[34rem] overflow-y-auto pr-1 pt-2">
            <CategoriaOrgChart
              categorias={categorias}
              arvore={arvore}
              forceExpandedIds={idsExpandidosNaBusca}
              emptyMessage={searchTerm.trim() ? `Nenhum resultado para "${searchTerm.trim()}".` : 'Nenhuma categoria cadastrada ainda.'}
            />
          </div>
        ) : arvore.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            {searchTerm.trim() ? `Nenhum resultado para "${searchTerm.trim()}".` : 'Nenhuma categoria cadastrada ainda.'}
          </p>
        ) : (
          <div className="max-h-[30rem] overflow-y-auto pr-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <CategoriaNivel
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
                  onIniciarEdicao: (node) => {
                    setEditandoId(node.id);
                    setNomeEditado(node.nome);
                  },
                  onCancelarEdicao: () => setEditandoId(null),
                  onSalvarEdicao: async (id) => {
                    const nome = nomeEditado.trim();
                    if (!nome) return;
                    const result = await onRenomear(id, nome);
                    if (result.success) setEditandoId(null);
                  },
                  adicionandoSubDe,
                  novoSubNome,
                  setNovoSubNome,
                  onIniciarSub: (id) => {
                    setAdicionandoSubDe(id);
                    setNovoSubNome('');
                    setExpandidoIds((prev) => new Set(prev).add(id));
                  },
                  onCancelarSub: () => setAdicionandoSubDe(null),
                  onCriarSub: async (parentId) => {
                    const nome = novoSubNome.trim();
                    if (!nome) return;
                    const result = await onCriar(nome, parentId);
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
            <button
              onClick={() => {
                setItemParaExcluir(null);
                setErroExclusao(null);
              }}
              className="flex-1 py-3 rounded-2xl font-bold text-sm bg-surface-card text-text-secondary"
            >
              Cancelar
            </button>
            <button
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
              className="flex-1 py-3 rounded-2xl font-bold text-sm bg-danger text-surface-page hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {excluindo ? <Loader2 size={16} className="animate-spin" /> : 'Excluir'}
            </button>
          </div>
        }
      >
        {itemParaExcluir && (
          <>
            <p className="text-sm text-text-muted">
              {getDescendantIds(itemParaExcluir.id, categorias).length > 1
                ? `Isso também excluirá as ${getDescendantIds(itemParaExcluir.id, categorias).length - 1} subcategoria(s) abaixo dela. Essa ação não pode ser desfeita.`
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
  onIniciarEdicao: (node: Categoria) => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: (id: string) => void;
  adicionandoSubDe: string | null;
  novoSubNome: string;
  setNovoSubNome: (v: string) => void;
  onIniciarSub: (id: string) => void;
  onCancelarSub: () => void;
  onCriarSub: (parentId: string) => void;
  movendoId: string | null;
  setMovendoId: (id: string | null) => void;
  nosParaMover: (id: string) => TreeDropdownNode[];
  onMover: (id: string, parentId: string | null) => void;
  onPedirExclusao: (node: Categoria) => void;
}

interface CategoriaNivelProps {
  nodes: CategoriaNode[];
  parentId: string | null;
  depth: number;
  h: ArvoreHandlers;
}

function CategoriaNivel({ nodes, parentId, depth, h }: CategoriaNivelProps) {
  return (
    <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
      {nodes.map((node) => (
        <React.Fragment key={node.id}>
          <CategoriaRow node={node} parentId={parentId} depth={depth} h={h} />
        </React.Fragment>
      ))}
    </SortableContext>
  );
}

function CategoriaRow({ node, parentId, depth, h }: { node: CategoriaNode; parentId: string | null; depth: number; h: ArvoreHandlers }) {
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

        <button
          onClick={() => temFilhos && onToggleExpandido(node.id)}
          className={cn('w-5 h-5 flex items-center justify-center shrink-0 text-text-muted', !temFilhos && 'opacity-0 pointer-events-none')}
        >
          {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

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
              <button onClick={() => h.onSalvarEdicao(node.id)} className="p-1.5 rounded-lg text-positive hover:bg-positive/10 shrink-0">
                <Check size={14} />
              </button>
              <button onClick={h.onCancelarEdicao} className="p-1.5 rounded-lg text-text-muted hover:bg-surface-raised shrink-0">
                <X size={14} />
              </button>
            </>
          ) : h.movendoId === node.id ? (
            <>
              <TreeDropdown
                variant="form"
                className="flex-1"
                nodes={h.nosParaMover(node.id)}
                value={node.parent_id ?? ROOT_OPTION_VALUE}
                onChange={(value) => h.onMover(node.id, value === ROOT_OPTION_VALUE ? null : value)}
                emptyOption={{ value: ROOT_OPTION_VALUE, label: '— Categoria raiz —' }}
                searchPlaceholder="Buscar categoria..."
              />
              <button onClick={() => h.setMovendoId(null)} className="p-1.5 rounded-lg text-text-muted hover:bg-surface-raised shrink-0">
                <X size={14} />
              </button>
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
                <span className="truncate">{node.nome}</span>
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
                <button onClick={() => h.onIniciarSub(node.id)} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Adicionar subcategoria">
                  <Plus size={13} />
                </button>
                <button onClick={() => h.setMovendoId(node.id)} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Mover para outra categoria">
                  <FolderInput size={13} />
                </button>
                <button onClick={() => h.onIniciarEdicao(node)} className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Renomear">
                  <Pencil size={13} />
                </button>
                <button onClick={() => h.onPedirExclusao(node)} className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Excluir">
                  <Trash2 size={13} />
                </button>
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
              placeholder="Nome da subcategoria..."
              className={cn(
                'flex-1 border rounded-lg py-1.5 px-3 text-sm outline-none',
                'bg-surface-inset border-accent/50 text-text-primary'
              )}
            />
            <button onClick={() => h.onCriarSub(node.id)} className="p-1.5 rounded-lg text-positive hover:bg-positive/10 shrink-0">
              <Check size={14} />
            </button>
            <button onClick={h.onCancelarSub} className="p-1.5 rounded-lg text-text-muted hover:bg-surface-raised shrink-0">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {temFilhos && expandido && (
        <div className={cn('ml-3 pl-5 border-l', borderGuia)}>
          <CategoriaNivel nodes={node.children} parentId={node.id} depth={depth + 1} h={h} />
        </div>
      )}
    </div>
  );
}
