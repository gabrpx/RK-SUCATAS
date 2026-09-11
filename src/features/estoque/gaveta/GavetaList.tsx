// Tela principal do estoque reorganizado (T01, docs/mockups/T01-listagem-gavetas.png):
// header + busca local + StatsRow + FilterChips + lista de gavetas + seção
// "ITENS NÃO AGRUPADOS". Só é montada numa rota de verdade na Task 13 — este
// componente não assume nada sobre onde vive, e a navegação pro detalhe é um
// prop (onAbrirGaveta/onAbrirItem) que a rota decide o que fazer.
import { useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
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
import { FilterChips, type FilterChipOption } from './FilterChips';
import type { Estoque, Gaveta } from '../types';

interface GavetaListProps {
  /** Navegação pro detalhe da gaveta (Task 13 decide a rota real). */
  onAbrirGaveta?: (gaveta: Gaveta) => void;
  /** Navegação pro item legado sem gaveta (Task 13 decide a rota real). */
  onAbrirItemNaoAgrupado?: (item: Estoque) => void;
}

function normalizar(texto: string): string {
  return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function GavetaList({ onAbrirGaveta, onAbrirItemNaoAgrupado }: GavetaListProps) {
  const { estoque, estoqueError } = useData();
  const { categorias } = useCatalogos();
  const { gavetas, loading: carregandoGavetas, refetch: recarregarGavetas } = useGavetas();
  const { criar, loading: criando, error: erroCriar } = useCriarGaveta();

  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [nomeNovaGaveta, setNomeNovaGaveta] = useState('');
  const [categoriaNovaGaveta, setCategoriaNovaGaveta] = useState<string>('');

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

  const buscaNormalizada = normalizar(busca.trim());

  const linhasFiltradas = useMemo(() => {
    return linhasGaveta.filter((linha) => {
      if (categoriaFiltro && linha.gaveta.categoria_id !== categoriaFiltro) return false;
      if (buscaNormalizada && !normalizar(linha.gaveta.nome).includes(buscaNormalizada)) {
        const algumItemBate = linha.itens.some(
          (item) => normalizar(item.nome).includes(buscaNormalizada) || normalizar(item.codigo).includes(buscaNormalizada)
        );
        if (!algumItemBate) return false;
      }
      return true;
    });
  }, [linhasGaveta, categoriaFiltro, buscaNormalizada]);

  const itensNaoAgrupadosFiltrados = useMemo(() => {
    const itens = linhaNaoAgrupada?.itens ?? [];
    if (!buscaNormalizada) return itens;
    return itens.filter(
      (item) => normalizar(item.nome).includes(buscaNormalizada) || normalizar(item.codigo).includes(buscaNormalizada)
    );
  }, [linhaNaoAgrupada, buscaNormalizada]);

  const fecharModal = () => {
    setModalAberto(false);
    setNomeNovaGaveta('');
    setCategoriaNovaGaveta('');
  };

  const salvarNovaGaveta = async () => {
    const nome = nomeNovaGaveta.trim();
    if (!nome) return;
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

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-text-primary">Estoque</h1>
        <Button variant="accent-cta" size="sm" onClick={() => setModalAberto(true)}>
          <Plus size={16} /> Nova Gaveta
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar peça, modelo, código..."
          className={cn(inputClass, 'h-11 pl-9')}
        />
      </div>

      <StatsRow
        gavetas={gavetas.length}
        variantes={statsGerais.variantes}
        unidades={statsGerais.unidadesDisponiveis}
        valorTotal={statsGerais.valorTotal}
      />

      {opcoesCategoria.length > 0 && (
        <FilterChips opcoes={opcoesCategoria} selecionado={categoriaFiltro} onSelecionar={setCategoriaFiltro} />
      )}

      {estoqueError && (
        <p className="text-sm text-danger">Não foi possível carregar o estoque. Verifique sua conexão.</p>
      )}

      {carregandoGavetas ? (
        <div className="flex items-center justify-center py-10 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col">
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
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 mb-1">
                    Itens não agrupados
                  </p>
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
                onChange={(e) => setNomeNovaGaveta(e.target.value)}
                placeholder="Ex: Tanque CG 125"
                className={cn(inputClass, 'h-11')}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted" htmlFor="nova-gaveta-categoria">
                Categoria (opcional)
              </label>
              <select
                id="nova-gaveta-categoria"
                value={categoriaNovaGaveta}
                onChange={(e) => setCategoriaNovaGaveta(e.target.value)}
                className={cn(inputClass, 'h-11')}
              >
                <option value="">Sem categoria</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fecharModal} disabled={criando}>
              Cancelar
            </Button>
            <Button type="button" variant="accent-cta" onClick={salvarNovaGaveta} disabled={!nomeNovaGaveta.trim() || criando}>
              {criando ? <Loader2 size={16} className="animate-spin" /> : 'Criar gaveta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
