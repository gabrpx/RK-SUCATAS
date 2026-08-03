// Dropdown pra escolher um nó de uma árvore (categoria ou moto) sem recorrer
// ao truque antigo de indentar o rótulo com espaços/'└ ' numa lista plana —
// isso ficava ilegível assim que a árvore passou a ter 4 níveis (Marca >
// Cilindrada > Modelo > Variação). Aqui a hierarquia é visual de verdade
// (recuo real + guia + expandir/recolher), o gatilho mostra o caminho
// completo até o item selecionado ("150 › CG 150 › Mix") em vez de só o nome
// solto, e dá pra buscar por texto. Genérico: não conhece Categoria nem
// ModeloMoto, só a forma mínima abaixo — cada tela converte seus dados pra
// isso antes de passar.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Search, Check, X } from 'lucide-react';
import { cn } from '../utils';

export interface TreeDropdownNode {
  id: string;
  nome: string;
  parent_id: string | null;
  ordem?: number;
  /** Texto secundário exibido ao lado do nome (ex: ano de uma variação de moto). */
  secundario?: string | null;
}

interface NodeComFilhos extends TreeDropdownNode {
  children: NodeComFilhos[];
}

function montarArvore(nodes: TreeDropdownNode[]): NodeComFilhos[] {
  const porId = new Map<string, NodeComFilhos>();
  nodes.forEach((n) => porId.set(n.id, { ...n, children: [] }));

  const raizes: NodeComFilhos[] = [];
  porId.forEach((node) => {
    if (node.parent_id && porId.has(node.parent_id)) {
      porId.get(node.parent_id)!.children.push(node);
    } else {
      raizes.push(node);
    }
  });

  const ordenar = (lista: NodeComFilhos[]) => {
    lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt'));
    lista.forEach((n) => ordenar(n.children));
  };
  ordenar(raizes);
  return raizes;
}

function normalizar(texto: string) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Se o nó bate, mantém ele com a subárvore original inteira; senão, mantém
// só se algum descendente bater (preserva o caminho até o resultado) — mesmo
// critério de src/features/categorias/categoriaTree.ts.
function filtrarArvore(nodes: NodeComFilhos[], termo: string): NodeComFilhos[] {
  const resultado: NodeComFilhos[] = [];
  for (const node of nodes) {
    const bate = normalizar(node.nome).includes(termo) || (node.secundario ? normalizar(node.secundario).includes(termo) : false);
    if (bate) {
      resultado.push(node);
      continue;
    }
    const filhosFiltrados = filtrarArvore(node.children, termo);
    if (filhosFiltrados.length > 0) resultado.push({ ...node, children: filhosFiltrados });
  }
  return resultado;
}

function getAncestorChain(id: string, nodes: TreeDropdownNode[]): TreeDropdownNode[] {
  const porId = new Map(nodes.map((n) => [n.id, n]));
  const cadeia: TreeDropdownNode[] = [];
  let atual = porId.get(id);
  while (atual) {
    cadeia.unshift(atual);
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
  }
  return cadeia;
}

export interface TreeDropdownProps {
  /** Lista completa (o chamador já filtra o que não deve aparecer, ex: bloqueados ao mover). */
  nodes: TreeDropdownNode[];
  value: string;
  onChange: (id: string) => void;
  /** Opção fixa no topo, fora da árvore (ex: "Todas as categorias" ou "— Categoria raiz —"). */
  emptyOption?: { value: string; label: string };
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
  /** 'pill' = filtro compacto (barra de filtros); 'form' = campo de formulário largo. */
  variant?: 'pill' | 'form';
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function TreeDropdown({
  nodes,
  value,
  onChange,
  emptyOption,
  placeholder = 'Selecione...',
  icon,
  className,
  variant = 'pill',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nada encontrado.',
}: TreeDropdownProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca('');
      }
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  // Ao abrir, garante que o caminho até o item selecionado esteja expandido
  // (senão a seleção atual fica escondida). Roda só na transição fechado→
  // aberto de propósito — não em toda mudança de `nodes`/`value`, pra não
  // reabrir ramos que o usuário fechou manualmente enquanto navega.
  useEffect(() => {
    if (!aberto) return;
    const cadeia = getAncestorChain(value, nodes);
    if (cadeia.length > 1) {
      setExpandidos((prev) => {
        const next = new Set(prev);
        cadeia.slice(0, -1).forEach((n) => next.add(n.id));
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const arvore = useMemo(() => montarArvore(nodes), [nodes]);
  const alvo = normalizar(busca.trim());
  const arvoreFiltrada = useMemo(() => (alvo ? filtrarArvore(arvore, alvo) : arvore), [arvore, alvo]);

  const idsExpandidosNaBusca = useMemo(() => {
    if (!alvo) return null;
    const ids = new Set<string>();
    const percorrer = (lista: NodeComFilhos[]) => {
      lista.forEach((n) => {
        if (n.children.length > 0) {
          ids.add(n.id);
          percorrer(n.children);
        }
      });
    };
    percorrer(arvoreFiltrada);
    return ids;
  }, [arvoreFiltrada, alvo]);

  const cadeiaAtual = useMemo(() => getAncestorChain(value, nodes), [value, nodes]);
  const labelAtual = cadeiaAtual.length > 0 ? cadeiaAtual.map((n) => n.nome).join(' › ') : emptyOption?.label ?? placeholder;

  const selecionar = (id: string) => {
    onChange(id);
    setAberto(false);
    setBusca('');
  };

  const gatilhoClasse =
    variant === 'form'
      ? 'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all flex items-center justify-between gap-2 bg-surface-inset border-border-default text-text-primary'
      : 'h-10 px-3 rounded-control border text-[13px] font-medium flex items-center gap-2 bg-surface-inset border-border-default text-text-secondary hover:text-text-primary transition-colors';

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title={labelAtual}
        className={cn(gatilhoClasse, aberto && 'border-accent/50 ring-2 ring-accent/20')}
      >
        <span className="flex items-center gap-2 min-w-0 overflow-hidden">
          {icon && <span className="shrink-0 text-text-faint">{icon}</span>}
          <span className="truncate">{labelAtual}</span>
        </span>
        <ChevronDown size={14} className={cn('shrink-0 opacity-50 transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="absolute z-[150] top-full mt-2 left-0 w-80 max-w-[90vw] rounded-card border border-border-default bg-surface-card shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border-subtle">
            <div className="flex items-center gap-2 rounded-control border border-border-default bg-surface-inset px-2.5">
              <Search size={13} className="text-text-faint shrink-0" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 py-2 bg-transparent outline-none text-xs text-text-primary placeholder:text-text-faint"
              />
              {busca && (
                <button type="button" onClick={() => setBusca('')} className="p-1 text-text-faint hover:text-text-secondary shrink-0">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1.5">
            {emptyOption && (
              <button
                type="button"
                onClick={() => selecionar(emptyOption.value)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition-colors',
                  value === emptyOption.value ? 'text-accent-soft-fg font-semibold bg-accent-soft-bg/40' : 'text-text-secondary hover:bg-surface-raised'
                )}
              >
                {emptyOption.label}
                {value === emptyOption.value && <Check size={13} className="shrink-0" />}
              </button>
            )}
            {arvoreFiltrada.length === 0 ? (
              <p className="px-3 py-4 text-xs text-text-faint text-center">{emptyMessage}</p>
            ) : (
              <TreeDropdownNivel
                nodes={arvoreFiltrada}
                depth={0}
                value={value}
                expandidos={idsExpandidosNaBusca ?? expandidos}
                onToggle={(id) =>
                  setExpandidos((prev) => {
                    const next = new Set(prev);
                    next.has(id) ? next.delete(id) : next.add(id);
                    return next;
                  })
                }
                onSelecionar={selecionar}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeDropdownNivel({
  nodes,
  depth,
  value,
  expandidos,
  onToggle,
  onSelecionar,
}: {
  nodes: NodeComFilhos[];
  depth: number;
  value: string;
  expandidos: Set<string>;
  onToggle: (id: string) => void;
  onSelecionar: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const temFilhos = node.children.length > 0;
        const expandido = expandidos.has(node.id);
        const selecionado = value === node.id;
        return (
          <div key={node.id}>
            <div className={cn('flex items-center gap-0.5', selecionado && 'bg-accent-soft-bg/30')} style={{ paddingLeft: depth * 14 }}>
              <button
                type="button"
                onClick={() => temFilhos && onToggle(node.id)}
                className={cn('w-5 h-7 flex items-center justify-center shrink-0 text-text-faint', !temFilhos && 'opacity-0 pointer-events-none')}
              >
                {expandido ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              <button
                type="button"
                onClick={() => onSelecionar(node.id)}
                className={cn(
                  'flex-1 min-w-0 flex items-center justify-between gap-2 py-1.5 pr-3 text-xs text-left transition-colors',
                  selecionado ? 'text-accent-soft-fg font-semibold' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <span className="truncate">
                  {node.nome}
                  {node.secundario && <span className="text-text-faint font-normal"> ({node.secundario})</span>}
                </span>
                {selecionado && <Check size={13} className="shrink-0" />}
              </button>
            </div>
            {temFilhos && expandido && (
              <TreeDropdownNivel nodes={node.children} depth={depth + 1} value={value} expandidos={expandidos} onToggle={onToggle} onSelecionar={onSelecionar} />
            )}
          </div>
        );
      })}
    </>
  );
}
