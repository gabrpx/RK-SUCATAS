// Modal de "Adicionar peças" à gaveta (Task 14, complementa T02): lista as
// peças ativas ainda sem gaveta (estoque.gaveta_id == null), permite buscar e
// selecionar várias, e move a seleção com concorrência controlada e uma única
// atualização final do estoque. Reusa o
// Modal compartilhado (src/components/ui/Modal.tsx) em vez de um backdrop
// próprio — mesmo padrão de outros modais do Estoque.
import { useMemo, useState } from 'react';
import { Loader2, Package, Search } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { cn } from '../../../utils';
import { useData } from '../../../context/DataContext';
import { aviso } from '../../../components/ui/toast';
import { useMoverPecasGaveta } from './hooks';
import { correspondeBuscaEstoque } from './buscaGavetas';
import type { Estoque } from '../types';

const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

interface AdicionarPecasGavetaProps {
  gavetaId: string;
  gavetaNome: string;
  onFechar: () => void;
}

export function AdicionarPecasGaveta({ gavetaId, gavetaNome, onFechar }: AdicionarPecasGavetaProps) {
  const { estoque } = useData();
  const { moverEmLote, loading } = useMoverPecasGaveta();

  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const disponiveis = useMemo(
    () => estoque.filter((i): i is Estoque => i.ativo && !i.gaveta_id),
    [estoque]
  );

  const filtrados = useMemo(() => {
    return disponiveis.filter((item) => correspondeBuscaEstoque(item, busca));
  }, [disponiveis, busca]);

  const alternar = (id: string) => {
    setSelecionados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  };

  const confirmar = async () => {
    const ids = Array.from(selecionados);
    if (ids.length === 0) return;
    const { sucesso, falhas } = await moverEmLote(ids, gavetaId);
    if (falhas.length === 0) {
      aviso.sucesso(`${sucesso.length} peça${sucesso.length === 1 ? '' : 's'} adicionada${sucesso.length === 1 ? '' : 's'} à gaveta.`);
      onFechar();
      return;
    }
    const nomePorId = new Map(disponiveis.map((item) => [item.id, item.nome]));
    const nomes = falhas.map(({ id }) => nomePorId.get(id) ?? id).join(', ');
    aviso.erro(sucesso.length > 0
      ? `${sucesso.length} adicionada${sucesso.length === 1 ? '' : 's'}; falha em: ${nomes}`
      : `Nenhuma peça foi movida. Falha em: ${nomes}`);
    setSelecionados(new Set(falhas.map(({ id }) => id)));
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Adicionar peças"
      subtitulo={`Peças sem gaveta que podem entrar em "${gavetaNome}"`}
      tamanho="md"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onFechar} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" variant="accent-cta" onClick={confirmar} disabled={loading || selecionados.size === 0}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : `Adicionar ${selecionados.size} peça${selecionados.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por palavras, código, modelo, categoria..."
            className={cn(
              'w-full h-11 border rounded-control py-2.5 pl-9 pr-4 text-sm outline-none transition-all',
              'focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint'
            )}
          />
        </div>

        {disponiveis.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">Nenhuma peça sem gaveta para adicionar.</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">Nenhuma peça encontrada.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle max-h-[50vh] overflow-y-auto">
            {filtrados.map((item) => {
              const marcado = selecionados.has(item.id);
              return (
                <label
                  key={item.id}
                  className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-3 py-2.5 min-h-11 cursor-pointer"
                >
                  <Checkbox checked={marcado} onCheckedChange={() => alternar(item.id)} />
                  <div className="flex-none size-9 rounded-control overflow-hidden bg-surface-inset flex items-center justify-center text-text-faint">
                    {item.imagens[0] ? (
                      <img src={item.imagens[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug text-text-primary break-words [overflow-wrap:anywhere]">{item.nome}</p>
                    <p className="text-xs leading-snug text-text-muted break-words [overflow-wrap:anywhere]">
                      {item.codigo} {item.categoria?.nome ? `· ${item.categoria.nome}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-right text-sm font-bold tabular-nums text-text-primary whitespace-nowrap">{fmtMoeda(item.valor)}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
