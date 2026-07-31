// Seletor de categoria em cascata: um dropdown por nível da árvore. Escolher
// uma categoria com filhos revela o próximo dropdown com as opções daquele
// ramo; parar em qualquer nível é válido (categoria_id aceita qualquer
// profundidade). Cada nível tem seu próprio "+ adicionar" embutido, criando
// a subcategoria já dentro do pai daquele nível (mesmo padrão do CatalogSelect).
import { useState } from 'react';
import { Plus, Loader2, Check, X } from 'lucide-react';
import { cn } from '../utils';
import { CustomDropdown } from './CustomDropdown';
import { getAncestorChain } from '../features/categorias/categoriaTree';
import type { Categoria } from '../types/catalog';

interface CategoriaCascadeSelectProps {
  theme: 'light' | 'dark';
  categorias: Categoria[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (nome: string, parentId: string | null) => Promise<{ success: boolean; data?: Categoria; error?: string }>;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

const EMPTY_VALUE = '';

export function CategoriaCascadeSelect({ theme, categorias, value, onChange, onCreate, allowEmpty, emptyLabel = 'Nenhuma' }: CategoriaCascadeSelectProps) {
  const [adicionandoParentId, setAdicionandoParentId] = useState<string | null | undefined>(undefined);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cadeia = value ? getAncestorChain(value, categorias) : [];

  const niveis: { parentId: string | null; opcoes: Categoria[]; valorSelecionado: string }[] = [];
  let parentAtual: string | null = null;
  while (true) {
    const opcoes = categorias.filter((c) => (c.parent_id ?? null) === parentAtual).sort((a, b) => a.ordem - b.ordem);
    if (opcoes.length === 0) break;
    const selecionadoNesteNivel = cadeia.find((c) => (c.parent_id ?? null) === parentAtual);
    niveis.push({ parentId: parentAtual, opcoes, valorSelecionado: selecionadoNesteNivel?.id ?? EMPTY_VALUE });
    if (!selecionadoNesteNivel) break;
    parentAtual = selecionadoNesteNivel.id;
  }

  const handleCreate = async () => {
    const nome = novoNome.trim();
    if (!nome || adicionandoParentId === undefined) return;
    setSalvando(true);
    setErro(null);
    const result = await onCreate(nome, adicionandoParentId);
    setSalvando(false);
    if (result.success && result.data) {
      onChange(result.data.id);
      setAdicionandoParentId(undefined);
      setNovoNome('');
    } else {
      setErro(result.error || 'Erro ao criar');
    }
  };

  if (niveis.length === 0) {
    // Nenhuma categoria cadastrada ainda — mesmo assim precisa dar pra criar a primeira.
    niveis.push({ parentId: null, opcoes: [], valorSelecionado: EMPTY_VALUE });
  }

  return (
    <div className="space-y-2">
      {niveis.map((nivel, index) => (
        <div key={nivel.parentId ?? 'raiz'} className="flex items-center gap-2">
          <CustomDropdown
            theme={theme}
            variant="form"
            className="flex-1"
            value={nivel.valorSelecionado}
            onChange={onChange}
            options={[
              ...(index === 0 && allowEmpty ? [{ value: EMPTY_VALUE, label: emptyLabel }] : []),
              ...nivel.opcoes.map((o) => ({ value: o.id, label: o.nome })),
            ]}
            placeholder={index === 0 ? 'Selecione a categoria...' : 'Selecione a subcategoria...'}
          />
          <button
            type="button"
            onClick={() => {
              setAdicionandoParentId(nivel.parentId);
              setNovoNome('');
              setErro(null);
            }}
            title="Adicionar nesta categoria"
            className={cn(
              'p-2.5 rounded-xl border transition-colors shrink-0',
              theme === 'dark' ? 'border-zinc-800 text-zinc-400 hover:text-violet-400 hover:border-violet-500/50' : 'border-zinc-200 text-zinc-500 hover:text-violet-600 hover:border-violet-300'
            )}
          >
            <Plus size={16} />
          </button>
        </div>
      ))}

      {adicionandoParentId !== undefined && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
              if (e.key === 'Escape') setAdicionandoParentId(undefined);
            }}
            placeholder="Nome da nova categoria/subcategoria..."
            className={cn(
              'flex-1 border rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/50',
              theme === 'dark' ? 'bg-zinc-950 border-violet-500/50 text-zinc-200' : 'bg-white border-violet-400 text-zinc-900'
            )}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={salvando || !novoNome.trim()}
            className="p-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors shrink-0"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
          <button type="button" onClick={() => setAdicionandoParentId(undefined)} className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
      {erro && <p className="text-xs text-rose-500">{erro}</p>}
    </div>
  );
}
