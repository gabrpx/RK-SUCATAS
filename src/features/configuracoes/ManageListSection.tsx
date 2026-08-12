// Bloco reutilizável de "gerenciar lista": usado pra Categorias e Formas de
// Pagamento na aba Configurações. Adicionar sempre disponível; renomear é
// opcional (só Formas de Pagamento usa); excluir mostra confirmação e, se o
// backend recusar (item em uso), exibe o motivo em vez de falhar silencioso.
import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Loader2, Search, ArrowDownAZ } from 'lucide-react';
import { cn } from '../../utils';
import { CustomDropdown } from '../../components/CustomDropdown';
import { Modal } from '../../components/ui/Modal';
import { Button } from '@/src/components/ui/button';

function normalizarTexto(texto: string) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

interface Item {
  id: string;
  nome: string;
  [key: string]: any;
}

// Toggle opcional por item (hoje só usado por Formas de Pagamento, pro
// marcador "é fiado?" — ver migration_030). Sem isso, o componente continua
// se comportando exatamente como antes pra Categorias/Motos.
interface ToggleConfig {
  rotulo: string;
  ativo: (item: Item) => boolean;
  onAlternar: (item: Item) => Promise<{ success: boolean; error?: string }>;
}

interface ManageListSectionProps {
  titulo: string;
  icone: any;
  itens: Item[];
  onCriar: (nome: string) => Promise<{ success: boolean; error?: string }>;
  onExcluir: (id: string) => Promise<{ success: boolean; error?: string }>;
  onRenomear?: (id: string, nome: string) => Promise<{ success: boolean; error?: string }>;
  toggle?: ToggleConfig;
}

export function ManageListSection({ titulo, icone: Icone, itens, onCriar, onExcluir, onRenomear, toggle }: ManageListSectionProps) {
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [itemParaExcluir, setItemParaExcluir] = useState<Item | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'nome_asc' | 'nome_desc'>('nome_asc');

  const itensExibidos = useMemo(() => {
    const alvo = normalizarTexto(searchTerm);
    const filtrados = alvo ? itens.filter((item) => normalizarTexto(item.nome).includes(alvo)) : itens;
    return [...filtrados].sort((a, b) => (sortKey === 'nome_asc' ? a.nome.localeCompare(b.nome, 'pt') : b.nome.localeCompare(a.nome, 'pt')));
  }, [itens, searchTerm, sortKey]);

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
    <div className={cn('rounded-3xl border overflow-hidden', 'bg-surface-card border-border-subtle')}>
      <div className={cn('flex items-center gap-3 p-5 border-b', 'border-border-default/50')}>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', 'bg-accent/10 text-accent')}>
          <Icone size={18} />
        </div>
        <div>
          <h3 className={cn('font-black text-sm', 'text-text-primary')}>{titulo}</h3>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{itens.length} cadastrado(s)</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className={cn('flex-1 flex items-center gap-2 rounded-xl border px-3', 'bg-surface-inset border-border-default')}>
            <Search size={15} className="text-text-muted shrink-0" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Buscar ${titulo.toLowerCase()}...`}
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
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriar()}
            placeholder="Nome novo..."
            className={cn(
              'flex-1 border rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-accent/50',
              'bg-surface-inset border-border-default text-text-primary'
            )}
          />
          <Button
            size="icon"
            onClick={handleCriar}
            disabled={criando || !novoNome.trim()}
            className="rounded-xl shrink-0"
          >
            {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </Button>
        </div>
        {erro && <p className="text-xs text-danger">{erro}</p>}

        {itensExibidos.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">
            {searchTerm.trim() ? `Nenhum resultado para "${searchTerm.trim()}".` : 'Nenhum item cadastrado ainda.'}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[30rem] overflow-y-auto pr-1">
            {itensExibidos.map((item) => (
              <div
                key={item.id}
                className={cn('flex items-center justify-between gap-2 px-3 py-2 rounded-xl', 'hover:bg-surface-raised')}
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
                      className={cn('flex-1 border rounded-lg py-1.5 px-3 text-sm outline-none', 'bg-surface-inset border-accent/50 text-text-primary')}
                    />
                    <Button variant="ghost" size="icon" onClick={() => salvarEdicao(item.id)} className="size-7 rounded-lg text-positive hover:text-positive hover:bg-positive/10">
                      <Check size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditandoId(null)} className="size-7 rounded-lg text-text-muted">
                      <X size={14} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={cn('text-sm font-medium truncate', 'text-text-primary')}>{item.nome}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {toggle && (
                        <button
                          onClick={() => toggle.onAlternar(item)}
                          title={toggle.rotulo}
                          className={cn(
                            'px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors',
                            toggle.ativo(item)
                              ? 'bg-warning/15 text-warning'
                              : 'bg-surface-raised text-text-muted hover:text-text-secondary'
                          )}
                        >
                          {toggle.rotulo}
                        </button>
                      )}
                      {onRenomear && (
                        <Button variant="ghost" size="icon" onClick={() => iniciarEdicao(item)} className="size-7 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10">
                          <Pencil size={13} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setItemParaExcluir(item)} className="size-7 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
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
            <Button variant="destructive" onClick={confirmarExclusao} disabled={excluindo} className="h-auto flex-1 py-3 rounded-2xl font-bold text-sm">
              {excluindo ? <Loader2 size={16} className="animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">Essa ação não pode ser desfeita.</p>
        {erroExclusao && <p className="text-xs text-danger mt-3">{erroExclusao}</p>}
      </Modal>
    </div>
  );
}
