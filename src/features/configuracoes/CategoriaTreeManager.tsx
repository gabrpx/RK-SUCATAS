// Gerenciamento de categorias em árvore (profundidade livre): criar raiz e
// subcategoria em qualquer nível, renomear, mover pra outro pai, excluir
// (avisando quando a subárvore inteira será removida junto) e reordenar
// irmãos via drag-and-drop (mouse e touch). Mesmo visual/interação do
// ManageListSection (usado por Formas de Pagamento), só que recursivo.
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Loader2, ChevronRight, ChevronDown, GripVertical, FolderInput, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../utils';
import { CustomDropdown } from '../../components/CustomDropdown';
import { buildTree, getDescendantIds, getDepth, type CategoriaNode } from '../categorias/categoriaTree';
import type { Categoria } from '../../types/catalog';

type ApiResult = { success: boolean; error?: string };

interface CategoriaTreeManagerProps {
  theme: 'light' | 'dark';
  categorias: Categoria[];
  onCriar: (nome: string, parentId?: string | null) => Promise<ApiResult>;
  onRenomear: (id: string, nome: string) => Promise<ApiResult>;
  onMover: (id: string, parentId: string | null) => Promise<ApiResult>;
  onReordenar: (ids: string[]) => Promise<ApiResult>;
  onExcluir: (id: string) => Promise<ApiResult>;
}

const ROOT_OPTION_VALUE = '__raiz__';

export function CategoriaTreeManager({ theme, categorias, onCriar, onRenomear, onMover, onReordenar, onExcluir }: CategoriaTreeManagerProps) {
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);

  const [colapsadoIds, setColapsadoIds] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [adicionandoSubDe, setAdicionandoSubDe] = useState<string | null>(null);
  const [novoSubNome, setNovoSubNome] = useState('');
  const [movendoId, setMovendoId] = useState<string | null>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<Categoria | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const arvore = useMemo(() => buildTree(categorias), [categorias]);

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

  const opcoesParaMover = (idExcluido: string) => {
    const bloqueados = new Set(getDescendantIds(idExcluido, categorias));
    const opcoes = categorias
      .filter((c) => !bloqueados.has(c.id))
      .map((c) => ({ value: c.id, label: `${'　'.repeat(getDepth(c.id, categorias))}${getDepth(c.id, categorias) > 0 ? '└ ' : ''}${c.nome}` }));
    return [{ value: ROOT_OPTION_VALUE, label: '— Categoria raiz —' }, ...opcoes];
  };

  const totalRaizes = arvore.length;

  return (
    <div className={cn('rounded-3xl border overflow-hidden', theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm')}>
      <div className={cn('flex items-center gap-3 p-5 border-b', theme === 'dark' ? 'border-zinc-800/50' : 'border-zinc-100')}>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', theme === 'dark' ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600')}>
          <Layers size={18} />
        </div>
        <div>
          <h3 className={cn('font-black text-sm', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Categorias de Peça</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{categorias.length} cadastrada(s) · {totalRaizes} raiz(es)</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriarRaiz()}
            placeholder="Nova categoria raiz..."
            className={cn(
              'flex-1 border rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/50',
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-900'
            )}
          />
          <button
            onClick={handleCriarRaiz}
            disabled={criando || !novoNome.trim()}
            className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
        {erroCriar && <p className="text-xs text-rose-500">{erroCriar}</p>}

        {arvore.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">Nenhuma categoria cadastrada ainda.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto pr-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <CategoriaNivel
                nodes={arvore}
                parentId={null}
                depth={0}
                h={{
                  theme,
                  colapsadoIds,
                  onToggleColapso: (id) =>
                    setColapsadoIds((prev) => {
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
                  opcoesParaMover,
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

      <AnimatePresence>
        {itemParaExcluir && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn('w-full max-w-sm rounded-3xl border p-6 text-center', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}
            >
              <h3 className="text-lg font-black mb-2">Excluir "{itemParaExcluir.nome}"?</h3>
              <p className="text-sm text-zinc-500 mb-4">
                {getDescendantIds(itemParaExcluir.id, categorias).length > 1
                  ? `Isso também excluirá as ${getDescendantIds(itemParaExcluir.id, categorias).length - 1} subcategoria(s) abaixo dela. Essa ação não pode ser desfeita.`
                  : 'Essa ação não pode ser desfeita.'}
              </p>
              {erroExclusao && <p className="text-xs text-rose-500 mb-4">{erroExclusao}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setItemParaExcluir(null);
                    setErroExclusao(null);
                  }}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm bg-zinc-900 text-zinc-300"
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
                  className="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {excluindo ? <Loader2 size={16} className="animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Handlers/estado compartilhados por toda a árvore — passados por referência
// (não espalhados via JSX spread) pra cada nível/linha recursiva.
interface ArvoreHandlers {
  theme: 'light' | 'dark';
  colapsadoIds: Set<string>;
  onToggleColapso: (id: string) => void;
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
  opcoesParaMover: (id: string) => { value: string; label: string }[];
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
  const { theme, colapsadoIds, onToggleColapso } = h;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { parentId },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const temFilhos = node.children.length > 0;
  const colapsado = colapsadoIds.has(node.id);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'flex items-center gap-1 rounded-xl',
          theme === 'dark' ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50'
        )}
        style={{ paddingLeft: depth * 20 }}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 text-zinc-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          title="Arrastar para reordenar"
        >
          <GripVertical size={14} />
        </button>

        <button
          onClick={() => temFilhos && onToggleColapso(node.id)}
          className={cn('w-5 h-5 flex items-center justify-center shrink-0 text-zinc-500', !temFilhos && 'opacity-0 pointer-events-none')}
        >
          {colapsado ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
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
                  theme === 'dark' ? 'bg-zinc-950 border-violet-500/50 text-zinc-200' : 'bg-white border-violet-400'
                )}
              />
              <button onClick={() => h.onSalvarEdicao(node.id)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 shrink-0">
                <Check size={14} />
              </button>
              <button onClick={h.onCancelarEdicao} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800/50 shrink-0">
                <X size={14} />
              </button>
            </>
          ) : h.movendoId === node.id ? (
            <>
              <CustomDropdown
                theme={theme}
                variant="form"
                className="flex-1"
                options={h.opcoesParaMover(node.id)}
                value={node.parent_id ?? ROOT_OPTION_VALUE}
                onChange={(value) => h.onMover(node.id, value === ROOT_OPTION_VALUE ? null : value)}
              />
              <button onClick={() => h.setMovendoId(null)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800/50 shrink-0">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <span className={cn('text-sm font-medium truncate', theme === 'dark' ? 'text-zinc-200' : 'text-zinc-700')}>{node.nome}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => h.onIniciarSub(node.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-500 hover:bg-violet-500/10 transition-colors" title="Adicionar subcategoria">
                  <Plus size={13} />
                </button>
                <button onClick={() => h.setMovendoId(node.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-500 hover:bg-violet-500/10 transition-colors" title="Mover para outra categoria">
                  <FolderInput size={13} />
                </button>
                <button onClick={() => h.onIniciarEdicao(node)} className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-500 hover:bg-violet-500/10 transition-colors" title="Renomear">
                  <Pencil size={13} />
                </button>
                <button onClick={() => h.onPedirExclusao(node)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Excluir">
                  <Trash2 size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {h.adicionandoSubDe === node.id && (
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: (depth + 1) * 20 + 26 }}>
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
              theme === 'dark' ? 'bg-zinc-950 border-violet-500/50 text-zinc-200' : 'bg-white border-violet-400'
            )}
          />
          <button onClick={() => h.onCriarSub(node.id)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 shrink-0">
            <Check size={14} />
          </button>
          <button onClick={h.onCancelarSub} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800/50 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {temFilhos && !colapsado && (
        <CategoriaNivel nodes={node.children} parentId={node.id} depth={depth + 1} h={h} />
      )}
    </div>
  );
}
