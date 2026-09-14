// Tela principal do estoque reorganizado (T01, docs/mockups/T01-listagem-gavetas.png):
// header + busca local + StatsRow + FilterChips + lista de gavetas + seção
// "ITENS NÃO AGRUPADOS". Só é montada numa rota de verdade na Task 13 — este
// componente não assume nada sobre onde vive, e a navegação pro detalhe é um
// prop (onAbrirGaveta/onAbrirItem) que a rota decide o que fazer.
import { useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { useCatalogos } from '../../../hooks/useCatalogos';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { cn } from '../../../utils';
import { useCriarGaveta, useGavetas } from './hooks';
import { agruparPorGaveta, statsGaveta } from './gavetaEstoque';
import { GavetaRow, GavetaRowNaoAgrupado } from './GavetaRow';
import { StatsRow } from './StatsRow';
import { FilterChips, FiltrosRapidosChips, type FilterChipOption } from './FilterChips';
import { CategoriaGavetaDropdown } from './CategoriaGavetaDropdown';
import { GavetaListSkeleton } from './GavetaSkeletons';
import { AlertaDuplicataGaveta, EmptyGavetas, OfflineBar, encontrarGavetaSemelhante } from './EstadosGaveta';
import type { Estoque, Gaveta } from '../types';
import { correspondeBuscaEstoque, itemAtendeFiltroRapido, normalizarTextoBusca, type FiltroRapido } from './buscaGavetas';
import { EstoqueHeaderControle, type EstoqueViewId } from './EstoqueHeaderVariants';

interface GavetaListProps {
  /** Navegação pro detalhe da gaveta (Task 13 decide a rota real). */
  onAbrirGaveta?: (gaveta: Gaveta) => void;
  /** Navegação pro item legado sem gaveta (Task 13 decide a rota real). */
  onAbrirItemNaoAgrupado?: (item: Estoque) => void;
  /** Resumo do cadastro do dia, integrado ao único cabeçalho desta tela. */
  resumoDoDia?: { itens: number; valorTotal: number; semValor: number };
  onVisualizacaoChange?: (valor: EstoqueViewId) => void;
}

export function GavetaList({ onAbrirGaveta, onAbrirItemNaoAgrupado, resumoDoDia, onVisualizacaoChange }: GavetaListProps) {
  const { estoque, estoqueError } = useData();
  const { categorias } = useCatalogos();
  const { gavetas, loading: carregandoGavetas, refetch: recarregarGavetas } = useGavetas();
  const { criar, loading: criando, error: erroCriar } = useCriarGaveta();

  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [filtrosRapidos, setFiltrosRapidos] = useState<Set<FiltroRapido>>(new Set());
  const [modalAberto, setModalAberto] = useState(false);
  const [nomeNovaGaveta, setNomeNovaGaveta] = useState('');
  const [categoriaNovaGaveta, setCategoriaNovaGaveta] = useState<string>('');
  // Uma vez que o usuário escolhe "criar mesmo assim", não insiste no aviso
  // pro mesmo nome — senão o clique preciso teria que ser repetido no submit.
  const [ignorarDuplicata, setIgnorarDuplicata] = useState(false);

  // Peças ativas — mesma base usada pelo resto do módulo de estoque.
  const itensAtivos = useMemo(() => estoque.filter((i) => i.ativo), [estoque]);

  const linhas = useMemo(() => agruparPorGaveta(itensAtivos, gavetas), [itensAtivos, gavetas]);

  const linhasGaveta = linhas.filter((l): l is Extract<typeof l, { tipo: 'gaveta' }> => l.tipo === 'gaveta');
  const linhaNaoAgrupada = linhas.find((l) => l.tipo === 'nao-agrupado');

  // StatsRow reflete SEMPRE o total (todas as peças ativas), independente de
  // busca/filtro em vigor — são as estatísticas do estoque, não da lista filtrada.
  const statsGerais = useMemo(() => statsGaveta(itensAtivos), [itensAtivos]);

  // Opções de filtro: só categorias que têm ao menos 1 gaveta cadastrada.
  const opcoesCategoria = useMemo<FilterChipOption[]>(() => {
    const vistas = new Map<string, string>();
    for (const linha of linhasGaveta) {
      const cat = linha.gaveta.categoria;
      if (cat && !vistas.has(cat.id)) vistas.set(cat.id, cat.nome);
    }
    return Array.from(vistas, ([id, nome]) => ({ id, nome }));
  }, [linhasGaveta]);

  const buscaNormalizada = normalizarTextoBusca(busca);
  const termosBusca = buscaNormalizada.split(/\s+/).filter(Boolean);
  const filtrosAtivos = filtrosRapidos.size > 0;
  const filtrando = buscaNormalizada !== '' || filtrosAtivos || categoriaFiltro !== null;

  // Um item passa nos filtros de estado (AND) e na busca textual.
  const itemPassaEstado = (item: Estoque) =>
    Array.from(filtrosRapidos).every((f) => itemAtendeFiltroRapido(item, f));
  const itemPassaBusca = (item: Estoque) => !buscaNormalizada || correspondeBuscaEstoque(item, busca);

  // Cada linha guarda também quantos itens dela realmente casaram — é isso que
  // alimenta a contagem "X resultados em Y gavetas" (sem recontar o estoque
  // inteiro nem misturar com o resumo geral).
  const linhasFiltradas = useMemo(() => {
    return linhasGaveta
      .filter((linha) => !categoriaFiltro || linha.gaveta.categoria_id === categoriaFiltro)
      .map((linha) => {
        const itensQueBatem = linha.itens.filter((item) => itemPassaEstado(item) && itemPassaBusca(item));
        const nomeDaGavetaBate =
          buscaNormalizada.length > 0 &&
          termosBusca.every((termo) => normalizarTextoBusca(linha.gaveta.nome).includes(termo));
        return { ...linha, itensQueBatem, nomeDaGavetaBate };
      })
      .filter((linha) => {
        // Sem filtro de estado: nome da gaveta batendo já mostra a gaveta.
        if (linha.nomeDaGavetaBate && !filtrosAtivos) return true;
        if (!buscaNormalizada && !filtrosAtivos) return true;
        return linha.itensQueBatem.length > 0;
      });
  }, [linhasGaveta, categoriaFiltro, buscaNormalizada, filtrosRapidos]);

  const itensNaoAgrupadosFiltrados = useMemo(() => {
    const itens = linhaNaoAgrupada?.itens ?? [];
    return itens.filter((item) => itemPassaEstado(item) && itemPassaBusca(item));
  }, [linhaNaoAgrupada, busca, buscaNormalizada, filtrosRapidos]);

  // "Resultado atual" — separado do "Resumo do estoque" (StatsRow, sempre total).
  const resultado = useMemo(() => {
    const variantes =
      linhasFiltradas.reduce((s, l) => s + (l.nomeDaGavetaBate && !filtrosAtivos ? l.itens.length : l.itensQueBatem.length), 0) +
      itensNaoAgrupadosFiltrados.length;
    const gavetas = linhasFiltradas.length;
    return { variantes, gavetas };
  }, [linhasFiltradas, itensNaoAgrupadosFiltrados, filtrosAtivos]);

  const alternarFiltroRapido = (id: FiltroRapido) =>
    setFiltrosRapidos((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const limparBusca = () => setBusca('');
  const limparTudo = () => {
    setBusca('');
    setCategoriaFiltro(null);
    setFiltrosRapidos(new Set());
  };

  const fecharModal = () => {
    setModalAberto(false);
    setNomeNovaGaveta('');
    setCategoriaNovaGaveta('');
    setIgnorarDuplicata(false);
  };

  // Reusa a mesma lógica de similaridade (Jaccard/tokens) já usada pra
  // detectar peça duplicada em src/features/estoque/detectarDuplicata.ts —
  // ver EstadosGaveta.tsx > encontrarGavetaSemelhante.
  const gavetaSemelhante = useMemo(
    () => encontrarGavetaSemelhante(nomeNovaGaveta, gavetas),
    [nomeNovaGaveta, gavetas]
  );
  const mostrarAlertaDuplicata = !!gavetaSemelhante && !ignorarDuplicata;

  const vincularAGavetaExistente = () => {
    if (!gavetaSemelhante) return;
    fecharModal();
    onAbrirGaveta?.(gavetaSemelhante);
  };

  const salvarNovaGaveta = async () => {
    const nome = nomeNovaGaveta.trim();
    if (!nome) return;
    if (gavetaSemelhante && !ignorarDuplicata) return;
    try {
      await criar({ nome, categoria_id: categoriaNovaGaveta || null, icone: null });
      await recarregarGavetas();
      fecharModal();
    } catch {
      // erro já fica em erroCriar, exibido no modal
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';

  // Vazio de verdade: nem gaveta cadastrada, nem item legado sem gaveta —
  // com filtro/busca em vigor isso vira "Nenhuma gaveta ou peça encontrada"
  // (mensagem de filtro sem resultado), não o empty state de primeira vez.
  const semNadaCadastrado = !carregandoGavetas && gavetas.length === 0 && (linhaNaoAgrupada?.itens.length ?? 0) === 0;

  return (
    <section aria-labelledby="gavetas-estoque-titulo" className="flex flex-col gap-3.5 w-full max-w-2xl mx-auto px-0 sm:px-4">
      <OfflineBar />

      <EstoqueHeaderControle
        resumo={resumoDoDia}
        visualizacao="gavetas"
        onVisualizacaoChange={(valor) => onVisualizacaoChange?.(valor)}
        onNovaGaveta={() => setModalAberto(true)}
      />

      {carregandoGavetas ? (
        <GavetaListSkeleton />
      ) : semNadaCadastrado ? (
        <EmptyGavetas onNova={() => setModalAberto(true)} mostrarAcao={false} />
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar peça, modelo, código, categoria..."
              className={cn(inputClass, 'h-11 pl-9', busca && 'pr-10')}
            />
            {busca && (
              <button
                type="button"
                onClick={limparBusca}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center size-7 rounded-control text-text-faint hover:text-text-primary hover:bg-surface-raised"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Resumo do estoque</p>
            <StatsRow
              gavetas={gavetas.length}
              variantes={statsGerais.variantes}
              unidades={statsGerais.unidadesDisponiveis}
              valorTotal={statsGerais.valorTotal}
            />
          </div>

          {opcoesCategoria.length > 0 && (
            <FilterChips opcoes={opcoesCategoria} selecionado={categoriaFiltro} onSelecionar={setCategoriaFiltro} />
          )}

          <FiltrosRapidosChips ativos={filtrosRapidos} onAlternar={alternarFiltroRapido} />

          {filtrando && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-text-secondary" role="status" aria-live="polite">
                <span className="font-semibold text-text-primary">{resultado.variantes}</span>{' '}
                {resultado.variantes === 1 ? 'resultado' : 'resultados'} em{' '}
                <span className="font-semibold text-text-primary">{resultado.gavetas}</span>{' '}
                {resultado.gavetas === 1 ? 'gaveta' : 'gavetas'}
              </p>
              <button
                type="button"
                onClick={limparTudo}
                className="shrink-0 text-xs font-semibold text-accent-soft-fg hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {estoqueError && (
            <p className="text-sm text-danger">Não foi possível carregar o estoque. Verifique sua conexão.</p>
          )}

          <div className="flex flex-col divide-y divide-border-subtle">
            {linhasFiltradas.length === 0 && itensNaoAgrupadosFiltrados.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-10">Nenhuma gaveta ou peça encontrada.</p>
            ) : (
              <>
                {linhasFiltradas.map((linha) => (
                  <div key={linha.id}>
                    <GavetaRow gaveta={linha.gaveta} itens={linha.itens} onClick={onAbrirGaveta} />
                  </div>
                ))}

                {itensNaoAgrupadosFiltrados.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border-subtle">
                    <div className="mb-1 flex items-center gap-3 px-3">
                      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Itens não agrupados</p>
                      <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                    </div>
                    {itensNaoAgrupadosFiltrados.map((item) => (
                      <div key={item.id}>
                        <GavetaRowNaoAgrupado item={item} onClick={onAbrirItemNaoAgrupado} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <Dialog open={modalAberto} onOpenChange={(aberto) => (aberto ? setModalAberto(true) : fecharModal())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova gaveta</DialogTitle>
          </DialogHeader>

          {erroCriar && <p className="text-xs text-danger">{erroCriar}</p>}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted" htmlFor="nova-gaveta-nome">
                Nome
              </label>
              <input
                id="nova-gaveta-nome"
                autoFocus
                value={nomeNovaGaveta}
                onChange={(e) => {
                  setNomeNovaGaveta(e.target.value);
                  setIgnorarDuplicata(false);
                }}
                placeholder="Ex: Tanque CG 125"
                className={cn(inputClass, 'h-11')}
              />
              {mostrarAlertaDuplicata && gavetaSemelhante && (
                <div className="mt-2">
                  <AlertaDuplicataGaveta
                    nome={gavetaSemelhante.nome}
                    onVincular={vincularAGavetaExistente}
                    onCriarMesmoAssim={() => setIgnorarDuplicata(true)}
                  />
                </div>
              )}
            </div>
            <div>
              <CategoriaGavetaDropdown
                id="nova-gaveta-categoria"
                label="Categoria (opcional)"
                value={categoriaNovaGaveta}
                onChange={setCategoriaNovaGaveta}
                options={[{ id: '', nome: 'Sem categoria' }, ...categorias.map((cat) => ({ id: cat.id, nome: cat.nome }))]}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fecharModal} disabled={criando}>
              Cancelar
            </Button>
            <Button type="button" variant="accent-cta" onClick={salvarNovaGaveta} disabled={!nomeNovaGaveta.trim() || criando || mostrarAlertaDuplicata}>
              {criando ? <Loader2 size={16} className="animate-spin" /> : 'Criar gaveta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
