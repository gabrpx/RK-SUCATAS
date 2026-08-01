// Bloco reutilizável de "gerenciar lista": usado pra Categorias e Formas de
// Pagamento na aba Configurações. Adicionar sempre disponível; renomear é
// opcional (só Formas de Pagamento usa); excluir mostra confirmação e, se o
// backend recusar (item em uso), exibe o motivo em vez de falhar silencioso.
import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils';

interface Item {
  id: string;
  nome: string;
}

interface ManageListSectionProps {
  theme: 'light' | 'dark';
  titulo: string;
  icone: any;
  itens: Item[];
  onCriar: (nome: string) => Promise<{ success: boolean; error?: string }>;
  onExcluir: (id: string) => Promise<{ success: boolean; error?: string }>;
  onRenomear?: (id: string, nome: string) => Promise<{ success: boolean; error?: string }>;
}

export function ManageListSection({ theme, titulo, icone: Icone, itens, onCriar, onExcluir, onRenomear }: ManageListSectionProps) {
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [itemParaExcluir, setItemParaExcluir] = useState<Item | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const handleCriar = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setCriando(true);
    setErro(null);
    const result = await onCriar(nome);
    if (result.success) {
      setNovoNome('');
    } else {
      setErro(result.error || 'Erro ao criar');
    }
    setCriando(false);
  };

  const iniciarEdicao = (item: Item) => {
    setEditandoId(item.id);
    setNomeEditado(item.nome);
  };

  const salvarEdicao = async (id: string) => {
    const nome = nomeEditado.trim();
    if (!nome || !onRenomear) return;
    const result = await onRenomear(id, nome);
    if (result.success) setEditandoId(null);
  };

  const confirmarExclusao = async () => {
    if (!itemParaExcluir) return;
    setExcluindo(true);
    setErroExclusao(null);
    const result = await onExcluir(itemParaExcluir.id);
    setExcluindo(false);
    if (result.success) {
      setItemParaExcluir(null);
    } else {
      setErroExclusao(result.error || 'Erro ao excluir');
    }
  };

  return (
    <div className={cn('rounded-3xl border overflow-hidden', theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm')}>
      <div className={cn('flex items-center gap-3 p-5 border-b', theme === 'dark' ? 'border-zinc-800/50' : 'border-zinc-100')}>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', theme === 'dark' ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600')}>
          <Icone size={18} />
        </div>
        <div>
          <h3 className={cn('font-black text-sm', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>{titulo}</h3>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{itens.length} cadastrado(s)</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriar()}
            placeholder="Nome novo..."
            className={cn(
              'flex-1 border rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/50',
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-900'
            )}
          />
          <button
            onClick={handleCriar}
            disabled={criando || !novoNome.trim()}
            className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
        {erro && <p className="text-xs text-rose-500">{erro}</p>}

        {itens.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">Nenhum item cadastrado ainda.</p>
        ) : (
          <div className="space-y-1.5 max-h-[30rem] overflow-y-auto pr-1">
            {itens.map((item) => (
              <div
                key={item.id}
                className={cn('flex items-center justify-between gap-2 px-3 py-2 rounded-xl', theme === 'dark' ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50')}
              >
                {editandoId === item.id ? (
                  <>
                    <input
                      autoFocus
                      value={nomeEditado}
                      onChange={(e) => setNomeEditado(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') salvarEdicao(item.id);
                        if (e.key === 'Escape') setEditandoId(null);
                      }}
                      className={cn('flex-1 border rounded-lg py-1.5 px-3 text-sm outline-none', theme === 'dark' ? 'bg-zinc-950 border-violet-500/50 text-zinc-200' : 'bg-white border-violet-400')}
                    />
                    <button onClick={() => salvarEdicao(item.id)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditandoId(null)} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-800/50">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={cn('text-sm font-medium truncate', theme === 'dark' ? 'text-zinc-200' : 'text-zinc-700')}>{item.nome}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {onRenomear && (
                        <button onClick={() => iniciarEdicao(item)} className="p-1.5 rounded-lg text-zinc-500 hover:text-violet-500 hover:bg-violet-500/10 transition-colors">
                          <Pencil size={13} />
                        </button>
                      )}
                      <button onClick={() => setItemParaExcluir(item)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {itemParaExcluir && (
          <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn('w-full max-w-sm rounded-3xl border p-6 text-center', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}>
              <h3 className="text-lg font-black mb-2">Excluir "{itemParaExcluir.nome}"?</h3>
              <p className="text-sm text-zinc-500 mb-4">Essa ação não pode ser desfeita.</p>
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
                <button onClick={confirmarExclusao} disabled={excluindo} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2">
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
