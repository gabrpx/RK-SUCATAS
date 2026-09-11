// Tela de detalhe da gaveta (T02, docs/mockups/T02-detalhe-gaveta.png): back
// nav, título editável inline, meta (categoria · N variantes · N unidades ·
// faixa R$) e a lista de VarianteCard. Só é montada numa rota de verdade na
// Task 13 — recebe o id da gaveta e a navegação de volta como props, sem
// assumir router nenhum (mesmo padrão de GavetaList).
import { useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Plus, X } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { cn } from '../../../utils';
import { Button } from '../../../components/ui/button';
import { useAtualizarGaveta, useGavetas, useMoverPecaGaveta } from './hooks';
import { statsGaveta } from './gavetaEstoque';
import { VarianteCard } from './VarianteCard';
import { AdicionarPecasGaveta } from './AdicionarPecasGaveta';
import { GavetaDetailSkeleton } from './GavetaSkeletons';
import { OfflineBar } from './EstadosGaveta';

interface GavetaDetailProps {
  gavetaId: string;
  onVoltar?: () => void;
}

export function GavetaDetail({ gavetaId, onVoltar }: GavetaDetailProps) {
  const { estoque } = useData();
  const { gavetas, setGavetas, loading: carregandoGavetas } = useGavetas();
  const { atualizar, loading: salvandoTitulo } = useAtualizarGaveta();
  const { mover: soltarPeca } = useMoverPecaGaveta();

  const gaveta = gavetas.find((g) => g.id === gavetaId) ?? null;

  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloRascunho, setTituloRascunho] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  const itens = useMemo(
    () => estoque.filter((i) => i.ativo && i.gaveta_id === gavetaId),
    [estoque, gavetaId]
  );

  const stats = useMemo(() => statsGaveta(itens), [itens]);

  const abrirEdicaoTitulo = () => {
    if (!gaveta) return;
    setTituloRascunho(gaveta.nome);
    setEditandoTitulo(true);
  };

  const salvarTitulo = async () => {
    const nome = tituloRascunho.trim();
    if (!gaveta || !nome || nome === gaveta.nome) {
      setEditandoTitulo(false);
      return;
    }
    try {
      const atualizada = await atualizar(gaveta.id, { nome });
      setGavetas((prev) => prev.map((g) => (g.id === atualizada.id ? atualizada : g)));
      setEditandoTitulo(false);
    } catch {
      // erro silencioso — usuário pode tentar de novo
    }
  };

  if (carregandoGavetas && !gaveta) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <OfflineBar />
        <button type="button" onClick={onVoltar} className="flex items-center gap-1 text-sm font-semibold text-accent-soft-fg w-fit min-h-11 sm:min-h-9">
          <ChevronLeft size={16} /> Estoque
        </button>
        <GavetaDetailSkeleton />
      </div>
    );
  }

  if (!gaveta) {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <OfflineBar />
        <button type="button" onClick={onVoltar} className="flex items-center gap-1 text-sm font-semibold text-accent-soft-fg w-fit">
          <ChevronLeft size={16} /> Estoque
        </button>
        <p className="text-sm text-text-muted text-center py-10">Gaveta não encontrada.</p>
      </div>
    );
  }

  const faixaTexto = stats.faixa
    ? stats.faixa.min === stats.faixa.max
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faixa.min)
      : `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faixa.min)} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faixa.max)}`
    : 'Sem preço';

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <OfflineBar />
      <button type="button" onClick={onVoltar} className="flex items-center gap-1 text-sm font-semibold text-accent-soft-fg w-fit min-h-11 sm:min-h-9">
        <ChevronLeft size={16} /> Estoque
      </button>

      <div>
        {editandoTitulo ? (
          <div className="flex items-center gap-2">
            <input
              value={tituloRascunho}
              onChange={(e) => setTituloRascunho(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarTitulo();
                if (e.key === 'Escape') setEditandoTitulo(false);
              }}
              autoFocus
              disabled={salvandoTitulo}
              className={cn(
                'flex-1 border rounded-control py-2 px-3 text-xl font-bold outline-none transition-all',
                'focus:ring-2 focus:ring-accent/50 bg-surface-inset border-accent text-text-primary'
              )}
            />
            <button type="button" onClick={() => setEditandoTitulo(false)} disabled={salvandoTitulo} className="text-text-faint hover:text-danger p-1">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={abrirEdicaoTitulo} className="flex items-center gap-2 group">
            <h1 className="text-xl font-bold text-text-primary">{gaveta.nome}</h1>
            <Pencil size={14} className="text-text-faint group-hover:text-accent-soft-fg" />
          </button>
        )}
        <p className="text-xs text-text-muted mt-0.5">
          {gaveta.categoria?.nome ?? 'Sem categoria'} · {stats.variantes} {stats.variantes === 1 ? 'variante' : 'variantes'} ·{' '}
          {stats.unidadesDisponiveis} {stats.unidadesDisponiveis === 1 ? 'unidade' : 'unidades'} · {faixaTexto}
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent-cta" size="sm" onClick={() => setAdicionando(true)}>
          <Plus size={14} /> Adicionar peças
        </Button>
      </div>

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-text-muted text-center">Nenhuma peça nesta gaveta ainda.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setAdicionando(true)}>
            <Plus size={14} /> Adicionar peças
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {itens.map((item) => (
            <div key={item.id} className="space-y-1">
              <VarianteCard item={item} />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => soltarPeca(item.id, null)}
                  className="text-xs text-text-faint hover:text-danger px-2 py-1 min-h-11 sm:min-h-0"
                >
                  Soltar da gaveta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adicionando && (
        <AdicionarPecasGaveta
          gavetaId={gaveta.id}
          gavetaNome={gaveta.nome}
          onFechar={() => setAdicionando(false)}
        />
      )}
    </div>
  );
}
