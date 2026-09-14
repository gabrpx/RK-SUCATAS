// Tela de detalhe da gaveta (T02, docs/mockups/T02-detalhe-gaveta.png): back
// nav, título editável inline, meta (categoria · N variantes · N unidades ·
// faixa R$) e a lista de VarianteCard. Só é montada numa rota de verdade na
// Task 13 — recebe o id da gaveta e a navegação de volta como props, sem
// assumir router nenhum (mesmo padrão de GavetaList).
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, Pencil, Plus, X } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { cn } from '../../../utils';
import { Button } from '../../../components/ui/button';
import { aviso } from '../../../components/ui/toast';
import { useAtualizarGaveta, useGavetas, useMoverPecaGaveta } from './hooks';
import { statsGaveta } from './gavetaEstoque';
import { VarianteCard } from './VarianteCard';
import { AdicionarPecasGaveta } from './AdicionarPecasGaveta';
import { EditarGavetaDialog } from './EditarGavetaDialog';
import { GavetaDetailSkeleton } from './GavetaSkeletons';
import { OfflineBar } from './EstadosGaveta';
import { ResumoPendenciasChips } from './PendenciaBadges';
import { resumirPendenciasEstoque } from './pendenciasGaveta';
import { FiltrosRapidosChips } from './FilterChips';
import { itemAtendeFiltroRapido, type FiltroRapido } from './buscaGavetas';
import { ordenarVariantes, CRITERIOS_ORDENACAO, type CriterioOrdenacao } from './ordenacaoVariantes';

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
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [editandoGaveta, setEditandoGaveta] = useState(false);
  const [ordenacao, setOrdenacao] = useState<CriterioOrdenacao>('nome');
  const [filtrosRapidos, setFiltrosRapidos] = useState<Set<FiltroRapido>>(new Set());

  const itens = useMemo(
    () => estoque.filter((i) => i.ativo && i.gaveta_id === gavetaId),
    [estoque, gavetaId]
  );

  const stats = useMemo(() => statsGaveta(itens), [itens]);
  const resumoPend = useMemo(() => resumirPendenciasEstoque(itens), [itens]);

  const itensVisiveis = useMemo(() => {
    const filtrados = itens.filter((item) =>
      Array.from(filtrosRapidos as Set<FiltroRapido>).every((f) => itemAtendeFiltroRapido(item, f)),
    );
    return ordenarVariantes(filtrados, ordenacao);
  }, [itens, filtrosRapidos, ordenacao]);

  const alternarFiltroRapido = (id: FiltroRapido) =>
    setFiltrosRapidos((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  // Soltar da gaveta com recuperação: age na hora, avisa e oferece "Desfazer"
  // (move de volta pra mesma gaveta). Sem modal — a saída é o próprio undo.
  const soltarComUndo = async (estoqueId: string, nomePeca: string) => {
    try {
      await soltarPeca(estoqueId, null);
      aviso.sucesso(`"${nomePeca}" saiu da gaveta.`, {
        acao: {
          label: 'Desfazer',
          onClick: () => {
            soltarPeca(estoqueId, gavetaId).catch(() => aviso.erro('Não foi possível desfazer.'));
          },
        },
      });
    } catch (error) {
      aviso.falha(error, 'Não foi possível soltar a peça da gaveta.');
    }
  };

  const abrirEdicaoTitulo = () => {
    if (!gaveta) return;
    setTituloRascunho(gaveta.nome);
    setErroTitulo(null);
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
      setErroTitulo(null);
      setEditandoTitulo(false);
    } catch (error) {
      // Erro visível e acionável — mantém o modo de edição pra tentar de novo.
      const msg = error instanceof Error ? error.message : 'Não foi possível salvar o nome da gaveta.';
      setErroTitulo(msg);
      aviso.erro(msg);
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
        {editandoTitulo && erroTitulo && (
          <p className="mt-1 flex items-center gap-1 text-xs text-danger" role="alert">
            <AlertTriangle size={12} aria-hidden /> {erroTitulo}
          </p>
        )}
        <p className="text-xs text-text-muted mt-0.5">
          {gaveta.categoria?.nome ?? 'Sem categoria'} · {stats.variantes} {stats.variantes === 1 ? 'variante' : 'variantes'} ·{' '}
          {stats.unidadesDisponiveis} {stats.unidadesDisponiveis === 1 ? 'unidade disponível' : 'unidades disponíveis'}
          {resumoPend.porTipo.ficha_pendente > 0 && ` · ${resumoPend.porTipo.ficha_pendente} ${resumoPend.porTipo.ficha_pendente === 1 ? 'ficha pendente' : 'fichas pendentes'}`}
          {' · '}{faixaTexto}
        </p>
        <ResumoPendenciasChips itens={itens} maxChips={6} className="mt-1.5" />
      </div>

      <div className="flex justify-between items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoGaveta(true)}>
          <Pencil size={14} /> Editar gaveta
        </Button>
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
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-text-muted">
              Ordenar por
              <select
                aria-label="Ordenar variantes"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as CriterioOrdenacao)}
                className="h-9 rounded-control border border-border-default bg-surface-inset px-2 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent/50"
              >
                {CRITERIOS_ORDENACAO.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
          </div>

          <FiltrosRapidosChips ativos={filtrosRapidos} onAlternar={alternarFiltroRapido} />

          {itensVisiveis.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">Nenhuma variante com esse filtro.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {itensVisiveis.map((item) => (
                <div key={item.id} className="space-y-1">
                  <VarianteCard item={item} />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => soltarComUndo(item.id, item.nome)}
                      className="text-xs text-text-faint hover:text-danger px-2 py-1 min-h-11 sm:min-h-0"
                    >
                      Soltar da gaveta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {adicionando && (
        <AdicionarPecasGaveta
          gavetaId={gaveta.id}
          gavetaNome={gaveta.nome}
          onFechar={() => setAdicionando(false)}
        />
      )}

      {editandoGaveta && (
        <EditarGavetaDialog
          gaveta={gaveta}
          qtdPecas={itens.length}
          onFechar={() => setEditandoGaveta(false)}
          onAtualizada={(atualizada) =>
            setGavetas((prev) => prev.map((g) => (g.id === atualizada.id ? atualizada : g)))
          }
          onExcluida={() => {
            setEditandoGaveta(false);
            onVoltar?.();
          }}
        />
      )}
    </div>
  );
}
