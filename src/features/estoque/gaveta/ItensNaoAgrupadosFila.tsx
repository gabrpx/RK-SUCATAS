// "Itens não agrupados" como FILA DE TRABALHO (T04): contador de pendências,
// seleção múltipla e ação direta "Mover para gaveta" em lote — reusa o
// endpoint de movimentação (useMoverPecasGaveta), sem duplicar. Também permite
// criar uma gaveta nova na hora quando nenhuma existente serve.
import { useMemo, useState } from 'react';
import { FolderInput, Loader2, Package, Plus, Search, X } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { cn } from '../../../utils';
import { aviso } from '../../../components/ui/toast';
import { useCriarGaveta, useMoverPecasGaveta } from './hooks';
import { correspondeBuscaEstoque, normalizarTextoBusca } from './buscaGavetas';
import { PendenciaVarianteChips } from './PendenciaBadges';
import type { Estoque, Gaveta } from '../types';

const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

interface ItensNaoAgrupadosFilaProps {
  itens: Estoque[];
  gavetas: Gaveta[];
  onAbrirItem?: (item: Estoque) => void;
  /** Chamado depois de criar uma gaveta nova daqui, pra o pai recarregar a lista. */
  onGavetaCriada?: (gaveta: Gaveta) => void;
}

export function ItensNaoAgrupadosFila({ itens, gavetas, onAbrirItem, onGavetaCriada }: ItensNaoAgrupadosFilaProps) {
  const { moverEmLote, loading: movendo } = useMoverPecasGaveta();
  const { criar, loading: criando } = useCriarGaveta();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [destinoAberto, setDestinoAberto] = useState(false);
  const [buscaGaveta, setBuscaGaveta] = useState('');
  const [criandoNova, setCriandoNova] = useState(false);
  const [nomeNova, setNomeNova] = useState('');

  const alternar = (id: string) =>
    setSelecionados((prev) => {
      const p = new Set(prev);
      if (p.has(id)) p.delete(id);
      else p.add(id);
      return p;
    });

  const limpar = () => setSelecionados(new Set());

  const gavetasFiltradas = useMemo(() => {
    const termos = normalizarTextoBusca(buscaGaveta).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return gavetas;
    return gavetas.filter((g) => termos.every((t) => normalizarTextoBusca(g.nome).includes(t)));
  }, [gavetas, buscaGaveta]);

  const fecharDestino = () => {
    setDestinoAberto(false);
    setBuscaGaveta('');
    setCriandoNova(false);
    setNomeNova('');
  };

  const moverPara = async (gavetaId: string) => {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;
    const { sucesso, falhas } = await moverEmLote(ids, gavetaId);
    fecharDestino();
    if (falhas.length === 0) {
      aviso.sucesso(`${sucesso.length} peça${sucesso.length === 1 ? '' : 's'} movida${sucesso.length === 1 ? '' : 's'}.`);
      limpar();
      return;
    }
    const nomePorId = new Map(itens.map((i) => [i.id, i.nome]));
    const nomes = falhas.map(({ id }) => nomePorId.get(id) ?? id).join(', ');
    aviso.erro(sucesso.length > 0 ? `${sucesso.length} movida(s); falha em: ${nomes}` : `Nenhuma movida. Falha em: ${nomes}`);
    setSelecionados(new Set(falhas.map(({ id }) => id)));
  };

  const criarEMover = async () => {
    const nome = nomeNova.trim();
    if (!nome) return;
    try {
      const nova = await criar({ nome, categoria_id: null, icone: null });
      onGavetaCriada?.(nova);
      await moverPara(nova.id);
    } catch (error) {
      aviso.falha(error, 'Não foi possível criar a gaveta.');
    }
  };

  if (itens.length === 0) return null;

  return (
    <section aria-labelledby="nao-agrupados-titulo" className="mt-4 pt-3 border-t border-border-subtle">
      <div className="mb-1 flex items-center gap-3 px-3">
        <p id="nao-agrupados-titulo" className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Itens não agrupados
        </p>
        <span className="rounded-badge bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-warning">
          {itens.length} aguardando organização
        </span>
        <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
      </div>

      {selecionados.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-card border border-accent/40 bg-accent-soft-bg px-3 py-2">
          <span className="text-xs font-semibold text-accent-soft-fg">{selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={limpar} className="text-xs font-semibold text-text-muted hover:text-text-primary">
              Limpar
            </button>
            <Button type="button" variant="accent-cta" size="sm" onClick={() => setDestinoAberto(true)}>
              <FolderInput size={14} /> Mover para gaveta
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-border-subtle">
        {itens.map((item) => {
          const marcado = selecionados.has(item.id);
          const disponiveis = Math.max(0, Number(item.quantidade) || 0);
          return (
            <div key={item.id} className={cn('flex items-center gap-2 sm:gap-3 py-2 px-1 sm:px-3', marcado && 'bg-surface-raised')}>
              <Checkbox aria-label={`Selecionar ${item.nome}`} checked={marcado} onCheckedChange={() => alternar(item.id)} />
              <button
                type="button"
                onClick={() => onAbrirItem?.(item)}
                className="flex flex-1 items-center gap-2.5 min-w-0 text-left min-h-11"
              >
                <div className="flex-none size-10 rounded-control border border-dashed border-border-default flex items-center justify-center overflow-hidden">
                  {item.imagens[0] ? (
                    <img src={item.imagens[0]} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Package size={16} className="text-text-faint" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-secondary leading-snug break-words [overflow-wrap:anywhere]">{item.nome}</p>
                  <p className="text-xs text-text-faint">{item.categoria?.nome ?? 'Sem categoria'} · Legado</p>
                  <PendenciaVarianteChips item={item} className="mt-1" />
                </div>
                <span className="flex-none text-right text-sm font-bold tabular-nums text-text-primary whitespace-nowrap">
                  {fmtMoeda(item.valor)}
                  <span className="block text-[10px] font-normal text-text-faint">{disponiveis} un.</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {destinoAberto && (
        <Modal
          aberto
          onFechar={fecharDestino}
          titulo="Mover para gaveta"
          subtitulo={`${selecionados.size} peça${selecionados.size === 1 ? '' : 's'} selecionada${selecionados.size === 1 ? '' : 's'}`}
          tamanho="sm"
        >
          <div className="flex flex-col gap-3">
            {!criandoNova ? (
              <>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                  <input
                    value={buscaGaveta}
                    onChange={(e) => setBuscaGaveta(e.target.value)}
                    placeholder="Buscar gaveta..."
                    className="w-full h-11 rounded-control border border-border-default bg-surface-inset pl-9 pr-4 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-text-faint"
                  />
                </div>
                <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
                  {gavetasFiltradas.length === 0 ? (
                    <p className="py-4 text-center text-sm text-text-muted">Nenhuma gaveta encontrada.</p>
                  ) : (
                    gavetasFiltradas.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        disabled={movendo}
                        onClick={() => moverPara(g.id)}
                        className="flex items-center justify-between gap-2 rounded-control border border-border-subtle px-3 py-2.5 text-left text-sm text-text-primary hover:border-accent hover:bg-surface-raised min-h-11 disabled:opacity-50"
                      >
                        <span className="min-w-0 break-words font-semibold leading-snug [overflow-wrap:anywhere]">{g.nome}</span>
                        <span className="max-w-[38%] shrink-0 break-words text-right text-xs leading-snug text-text-muted [overflow-wrap:anywhere]">{g.categoria?.nome ?? 'Sem categoria'}</span>
                      </button>
                    ))
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setCriandoNova(true)}>
                  <Plus size={14} /> Criar nova gaveta
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor="fila-nova-gaveta" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Nome da nova gaveta
                  </label>
                  <input
                    id="fila-nova-gaveta"
                    autoFocus
                    value={nomeNova}
                    onChange={(e) => setNomeNova(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && criarEMover()}
                    placeholder="Ex: Caixa de marcha CG"
                    className="w-full h-11 rounded-control border border-border-default bg-surface-inset px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/50 placeholder:text-text-faint"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCriandoNova(false)} disabled={criando || movendo}>
                    <X size={14} /> Voltar
                  </Button>
                  <Button type="button" variant="accent-cta" size="sm" onClick={criarEMover} disabled={!nomeNova.trim() || criando || movendo}>
                    {criando || movendo ? <Loader2 size={14} className="animate-spin" /> : 'Criar e mover'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
