// Dropdown de categoria/modelo de moto com "+ adicionar novo" embutido.
// Existe pra evitar que cadastrar uma categoria nova exija sair do formulário
// — só cria a linha na tabela de apoio (categorias/modelos_moto) e já seleciona.
import { useState } from 'react';
import { Plus, Loader2, Check, X } from 'lucide-react';
import { cn } from '../utils';
import { CustomDropdown } from './CustomDropdown';

interface CatalogOption {
  id: string;
  nome: string;
}

interface CatalogSelectProps {
  theme: 'light' | 'dark';
  value: string;
  onChange: (id: string) => void;
  options: CatalogOption[];
  onCreate: (nome: string) => Promise<{ success: boolean; data?: CatalogOption; error?: string }>;
  placeholder?: string;
  allowEmpty?: boolean; // true pra campos opcionais (ex: modelo de moto universal)
  emptyLabel?: string;
}

export function CatalogSelect({ theme, value, onChange, options, onCreate, placeholder, allowEmpty, emptyLabel = 'Nenhum / universal' }: CatalogSelectProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [saving, setSaving] = useState(false);

  const dropdownOptions = [
    ...(allowEmpty ? [{ value: '', label: emptyLabel }] : []),
    ...options.map((o) => ({ value: o.id, label: o.nome })),
  ];

  const handleCreate = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setSaving(true);
    try {
      const result = await onCreate(nome);
      if (result.success && result.data) {
        onChange(result.data.id);
        setIsAdding(false);
        setNovoNome('');
      }
    } finally {
      setSaving(false);
    }
  };

  if (isAdding) {
    return (
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
            if (e.key === 'Escape') setIsAdding(false);
          }}
          placeholder="Nome do novo..."
          className={cn(
            'flex-1 border rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/50',
            theme === 'dark' ? 'bg-zinc-950 border-violet-500/50 text-zinc-200' : 'bg-white border-violet-400 text-zinc-900'
          )}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !novoNome.trim()}
          className="p-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button type="button" onClick={() => setIsAdding(false)} className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <CustomDropdown theme={theme} variant="form" className="flex-1" value={value} onChange={onChange} options={dropdownOptions} placeholder={placeholder} />
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        title="Adicionar novo"
        className={cn(
          'p-2.5 rounded-xl border transition-colors shrink-0',
          theme === 'dark' ? 'border-zinc-800 text-zinc-400 hover:text-violet-400 hover:border-violet-500/50' : 'border-zinc-200 text-zinc-500 hover:text-violet-600 hover:border-violet-300'
        )}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
