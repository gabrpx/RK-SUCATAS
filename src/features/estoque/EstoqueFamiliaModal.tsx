// Modal de família de peça — abre ao clicar numa linha-família ou numa linha
// avulsa na tabela de Estoque. Mostra grupos modelo/ano com cards de unidade,
// métricas agregadas no header e ações (Registrar unidade, Venda rápida, etc.).
import { useState, useMemo, useCallback, useEffect, type Key } from 'react';
import { Package, Search, ShoppingCart, Plus, Trash2, Pencil, Check, Move, AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '../../utils';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { aviso } from '../../components/ui/toast';
import { formatarTempoRelativoCurto } from '../../utils/tempoRelativo';
import {
  agruparPorModelo,
  emEstoqueFamilia,
  variacoesFamilia,
  contarModelosFamilia,
  faixaPrecoFamilia,
  comAvariaFamilia,
  valorEmEstoqueFamilia,
  type EstoqueLinha,
  type GrupoModeloFamilia,
} from './familiaEstoque';
import { valorDaUnidade, condicaoNotaDaUnidade } from './valorEstoque';
import { CondicaoNotaBadge } from './CondicaoNotaBadge';
import { estoqueApi, estoqueFamiliasApi } from './api';
import type { Estoque, EstoqueUnidade } from './types';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../../components/animate-ui/components/radix/accordion';
import { DialogContent, DialogCloseButton } from '../../components/animate-ui/components/radix/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent } from '../../components/animate-ui/components/animate/tabs';
import { RegistrarUnidadeDialog } from './RegistrarUnidadeDialog';
import { ImageZoom } from '../../components/ui/image-zoom';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// ─── helpers ────────────────────────────────────────────────────────────────

function getItens(linha: EstoqueLinha): Estoque[] {
  return linha.tipo === 'familia' ? linha.itens : [linha.item];
}

function getTitulo(linha: EstoqueLinha): string {
  return linha.tipo === 'familia' ? linha.familia.nome : linha.item.nome;
}

// Dentro de um grupo, qual unidade tem a maior condicao_nota disponível?
function melhorEstadoId(unidades: EstoqueUnidade[], valorPadrao: number): string | null {
  const disponiveis = unidades.filter((u) => !u.vendida_em);
  if (disponiveis.length === 0) return null;
  return disponiveis.reduce((best, u) =>
    (condicaoNotaDaUnidade(u, null) ?? 0) > (condicaoNotaDaUnidade(best, null) ?? 0) ? u : best
  ).id;
}

function melhorPrecoId(unidades: EstoqueUnidade[], valorPadrao: number): string | null {
  const disponiveis = unidades.filter((u) => !u.vendida_em);
  if (disponiveis.length === 0) return null;
  return disponiveis.reduce((best, u) =>
    valorDaUnidade(u, valorPadrao) < valorDaUnidade(best, valorPadrao) ? u : best
  ).id;
}

// ─── Metric tile ────────────────────────────────────────────────────────────

function MetricTile({ valor, label }: { valor: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-base sm:text-lg font-semibold tabular-nums text-text-primary leading-none">{valor}</span>
      <span className="text-[10px] text-text-muted uppercase tracking-wider leading-none whitespace-nowrap">{label}</span>
    </div>
  );
}

// ─── Unit card ──────────────────────────────────────────────────────────────

interface UnidadeCardProps {
  key?: Key;
  unidade: EstoqueUnidade;
  item: Estoque; // ficha-mãe (herança de foto/valor)
  isMelhorEstado: boolean;
  isMelhorPreco: boolean;
  selecionado: boolean;
  modoSelecao: boolean;
  onToggleSelecao: () => void;
  onVerDetalhes: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onMarcarVendida: () => void;
}

function UnidadeCard({
  unidade, item, isMelhorEstado, isMelhorPreco, selecionado, modoSelecao,
  onToggleSelecao, onEditar, onExcluir, onMarcarVendida,
  onVerDetalhes,
}: UnidadeCardProps) {
  const foto = unidade.fotos[0] ?? null;
  const preco = unidade.valor ?? null;
  const nota = condicaoNotaDaUnidade(unidade, item.condicao_nota);
  const vendida = !!unidade.vendida_em;
  const fichaIncompleta = !vendida && (!foto || !(Number(unidade.valor) > 0));
  const nome = unidade.nome ?? 'Padrão';
  const tempo = formatarTempoRelativoCurto(unidade.criado_em);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-control p-3 border transition-colors cursor-pointer',
        selecionado ? 'border-accent bg-accent-soft' : 'border-border-subtle hover:bg-surface-raised',
        vendida && 'opacity-60'
      )}
      onClick={modoSelecao ? onToggleSelecao : onVerDetalhes}
    >
      {modoSelecao && (
        <div className={cn(
          'size-4 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-colors',
          selecionado ? 'bg-accent border-accent text-white' : 'border-border-default'
        )}>
          {selecionado && <Check size={10} />}
        </div>
      )}

      {/* Foto — clicável para zoom em tela cheia */}
      <div className={cn(
        'size-14 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset',
        fichaIncompleta && 'border border-dashed border-warning/50 bg-transparent',
      )}>
        {foto ? (
          <ImageZoom
            src={foto}
            alt={nome}
            className="w-full h-full object-cover"
            triggerClassName="block w-full h-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          fichaIncompleta ? <AlertTriangle size={20} className="text-warning" /> : <Package size={20} className="text-text-faint" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-text-primary">{nome}</span>
              <CondicaoNotaBadge nota={nota} />
              {isMelhorEstado && !vendida && !fichaIncompleta && (
                <StatusBadge tom="positive" texto="Melhor estado" />
              )}
              {isMelhorPreco && !vendida && !fichaIncompleta && (
                <StatusBadge tom="accent" texto="Melhor preço" />
              )}
              {unidade.avaria && !vendida && (
                <span className="inline-flex items-center gap-0.5 rounded-badge bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  <AlertTriangle size={9} />
                  Avaria
                </span>
              )}
              {fichaIncompleta && <StatusBadge tom="warning" texto="Ficha incompleta" />}
            </div>
            <p className="text-[11px] text-text-faint mt-0.5">
              {item.codigo}{tempo ? ` · ${tempo}` : ''}
            </p>
          </div>

          {!modoSelecao && (
            <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" aria-label="Editar unidade" title="Editar unidade" onClick={onEditar}
                className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent-soft">
                <Pencil size={12} /> Editar
              </button>
              {!vendida && (
                <button type="button" aria-label="Marcar como vendida" title="Marcar como vendida" onClick={onMarcarVendida}
                  className="p-1.5 rounded-control text-text-faint hover:text-accent hover:bg-surface-raised">
                  <ShoppingCart size={13} />
                </button>
              )}
              <button type="button" aria-label="Excluir unidade" title="Excluir unidade" onClick={onExcluir}
                className="p-1.5 rounded-control text-text-faint hover:text-danger hover:bg-danger-bg">
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn('text-sm font-semibold tabular-nums', preco ? 'text-text-primary' : 'text-warning')}>
            {preco ? fmt(preco) : 'Sem valor próprio'}
          </span>
          <StatusBadge
            tom={vendida ? 'neutral' : 'positive'}
            texto={vendida ? 'Vendida' : 'Disponível'}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Grupo de modelo ─────────────────────────────────────────────────────────

interface GrupoProps {
  key?: Key;
  grupo: GrupoModeloFamilia;
  busca: string;
  statusFiltro: 'todos' | 'disponivel' | 'vendida';
  avaFiltro: 'todos' | 'com' | 'sem';
  selecionados: Set<string>;
  modoSelecao: boolean;
  onToggleSelecao: (id: string) => void;
  onVerDetalhes: (u: EstoqueUnidade, item: Estoque) => void;
  onEditarUnidade: (u: EstoqueUnidade, item: Estoque) => void;
  onExcluirUnidade: (u: EstoqueUnidade, item: Estoque) => void;
  onMarcarVendida: (u: EstoqueUnidade, item: Estoque) => void;
}

function GrupoModelo({
  grupo, busca, statusFiltro, avaFiltro, selecionados, modoSelecao,
  onToggleSelecao, onVerDetalhes, onEditarUnidade, onExcluirUnidade, onMarcarVendida,
}: GrupoProps) {
  const todasUnidades = grupo.itens.flatMap((item) =>
    (item.unidades ?? []).map((u) => ({ unidade: u, item }))
  );

  const term = busca.toLowerCase();
  const unidadesFiltradas = todasUnidades.filter(({ unidade, item }) => {
    if (term && !(unidade.nome?.toLowerCase().includes(term) || item.codigo?.toLowerCase().includes(term))) return false;
    if (statusFiltro === 'disponivel' && unidade.vendida_em) return false;
    if (statusFiltro === 'vendida' && !unidade.vendida_em) return false;
    if (avaFiltro === 'com' && !unidade.avaria) return false;
    if (avaFiltro === 'sem' && unidade.avaria) return false;
    return true;
  });

  if (unidadesFiltradas.length === 0) return null;

  const disponiveis = unidadesFiltradas.filter(({ unidade }) => !unidade.vendida_em);
  const todasUnidadesDisponiveis = todasUnidades.filter(({ unidade }) => !unidade.vendida_em).map(({ unidade }) => unidade);
  const valorPadrao = grupo.itens[0]?.valor ?? 0;

  const melhorEstado = melhorEstadoId(todasUnidadesDisponiveis, valorPadrao);
  const melhorPreco = melhorPrecoId(todasUnidadesDisponiveis, valorPadrao);

  const precos = disponiveis.map(({ unidade, item }) => valorDaUnidade(unidade, item.valor));
  const min = precos.length ? Math.min(...precos) : 0;
  const max = precos.length ? Math.max(...precos) : 0;
  const resumoPreco = precos.length === 0 ? '' : min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;

  const nomeGrupo = grupo.nomeModelo + (grupo.ano ? ` · ${grupo.ano}` : '');

  return (
    <AccordionItem value={grupo.modeloMotoId ?? '__sem__'}>
      <AccordionTrigger className="text-sm">
        <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
          <span className="font-medium text-text-primary">{nomeGrupo}</span>
          {resumoPreco && (
            <span className="text-[11px] text-text-muted font-normal">
              {disponiveis.length} em estoque{resumoPreco ? ` · ${resumoPreco}` : ''}
            </span>
          )}
        </div>
        <StatusBadge tom="neutral" texto={`${unidadesFiltradas.length}`} />
      </AccordionTrigger>
      <AccordionContent className="px-0 pb-0">
        <div className="flex flex-col gap-2 pt-1 px-4 pb-3">
          {/* Galeria de fotos das fichas — todas as imagens da ficha-mãe, não só a capa */}
          {grupo.itens.some((it) => it.imagens.length > 0) && (
            <div className="mb-1">
              {grupo.itens.map((it) =>
                it.imagens.length > 0 ? (
                  <div key={it.id} className="mb-2 last:mb-0">
                    {grupo.itens.length > 1 && (
                      <p className="text-[10px] text-text-muted mb-1">
                        {it.modelo_moto?.nome ?? it.nome}
                      </p>
                    )}
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                      {it.imagens.map((url, i) => (
                        <div key={url} className="size-14 shrink-0 rounded-control overflow-hidden border border-border-subtle">
                          <ImageZoom
                            src={url}
                            alt={`Foto ${i + 1}`}
                            className="w-full h-full object-cover"
                            triggerClassName="block w-full h-full"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
          {unidadesFiltradas.map(({ unidade, item }) => (
            <UnidadeCard
              key={unidade.id}
              unidade={unidade}
              item={item}
              isMelhorEstado={melhorEstado === unidade.id}
              isMelhorPreco={melhorPreco === unidade.id}
              selecionado={selecionados.has(unidade.id)}
              modoSelecao={modoSelecao}
              onToggleSelecao={() => onToggleSelecao(unidade.id)}
              onVerDetalhes={() => onVerDetalhes(unidade, item)}
              onEditar={() => onEditarUnidade(unidade, item)}
              onExcluir={() => onExcluirUnidade(unidade, item)}
              onMarcarVendida={() => onMarcarVendida(unidade, item)}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Modal principal ─────────────────────────────────────────────────────────

export interface EstoqueFamiliaModalProps {
  linha: EstoqueLinha;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function EstoqueFamiliaModal({ linha, open, onClose, onRefresh }: EstoqueFamiliaModalProps) {
  // Mantém uma cópia viva enquanto o detalhe está aberto. O refresh global é
  // assíncrono e a linha original da tabela não muda por referência; sem esta
  // camada, o usuário salva e continua vendo os dados antigos até reabrir.
  const [linhaAtual, setLinhaAtual] = useState(linha);
  useEffect(() => setLinhaAtual(linha), [linha]);

  const itens = getItens(linhaAtual);
  const titulo = getTitulo(linhaAtual);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'disponivel' | 'vendida'>('todos');
  const [avaFiltro, setAvaFiltro] = useState<'todos' | 'com' | 'sem'>('todos');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const [editarUnidade, setEditarUnidade] = useState<{ u: EstoqueUnidade; item: Estoque } | null>(null);
  const [fichaDetalhe, setFichaDetalhe] = useState<{ u: EstoqueUnidade; item: Estoque } | null>(null);
  // Mover selecionadas: null = não mostrando o seletor de destino
  const [moverDestinoAberto, setMoverDestinoAberto] = useState(false);
  const [movendoPara, setMovendoPara] = useState<string>(''); // fichaDestinoId

  const grupos = useMemo(() => agruparPorModelo(itens), [itens]);

  // 6 métricas do header
  const nModelos = contarModelosFamilia(itens);
  const nVariacoes = itens.length; // número de fichas (variações de catálogo), não total de unidades
  const nEmEstoque = emEstoqueFamilia(itens);
  const valorTotal = valorEmEstoqueFamilia(itens);
  const faixa = faixaPrecoFamilia(itens);
  const nAvaria = comAvariaFamilia(itens);

  const faixaTexto = !faixa ? '—' : faixa.min === faixa.max ? fmt(faixa.min) : `${fmt(faixa.min)} – ${fmt(faixa.max)}`;

  const toggleSelecao = useCallback((id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleEditarUnidade = useCallback((u: EstoqueUnidade, item: Estoque) => {
    setEditarUnidade({ u, item });
  }, []);

  const handleVerDetalhes = useCallback((u: EstoqueUnidade, item: Estoque) => {
    setFichaDetalhe({ u, item });
  }, []);

  const handleRefreshDetalhe = useCallback((atualizacao?: { estoqueId: string; unidade?: EstoqueUnidade; removidaUnidadeId?: string }) => {
    if (atualizacao) {
      setLinhaAtual((atual) => {
        const atualizarItem = (item: Estoque): Estoque => {
          if (item.id !== atualizacao.estoqueId) return item;
          const unidades = item.unidades ?? [];
          const semRemovida = atualizacao.removidaUnidadeId
            ? unidades.filter((u) => u.id !== atualizacao.removidaUnidadeId)
            : unidades;
          const comAtualizada = atualizacao.unidade
            ? semRemovida.some((u) => u.id === atualizacao.unidade!.id)
              ? semRemovida.map((u) => u.id === atualizacao.unidade!.id ? atualizacao.unidade! : u)
              : [...semRemovida, atualizacao.unidade]
            : semRemovida;
          return { ...item, unidades: comAtualizada };
        };
        return atual.tipo === 'familia'
          ? { ...atual, itens: atual.itens.map(atualizarItem) }
          : { ...atual, item: atualizarItem(atual.item) };
      });
    }
    onRefresh();
  }, [onRefresh]);

  const handleExcluirUnidade = useCallback(async (u: EstoqueUnidade, item: Estoque) => {
    if (!confirm(`Excluir unidade "${u.nome ?? 'Padrão'}"? Esta ação não pode ser desfeita.`)) return;
    const result = await estoqueApi.excluirUnidade(item.id, u.id);
    if (!result.success) {
      aviso.erro('Erro ao excluir unidade', { descricao: result.error });
      return;
    }
    aviso.sucesso('Unidade excluída');
    handleRefreshDetalhe({ estoqueId: item.id, removidaUnidadeId: u.id });
  }, [handleRefreshDetalhe]);

  const handleMarcarVendida = useCallback((u: EstoqueUnidade, item: Estoque) => {
    aviso.atencao('Use o fluxo de Vendas para registrar a venda de uma unidade específica.');
  }, []);

  const handleExcluirSelecionadas = useCallback(async () => {
    if (selecionados.size === 0) return;
    if (!confirm(`Excluir ${selecionados.size} unidade(s) selecionada(s)?`)) return;
    setSalvando(true);
    let erros = 0;
    for (const unidadeId of selecionados) {
      // Encontra o item-pai da unidade
      const itemPai = itens.find((it) => it.unidades?.some((u) => u.id === unidadeId));
      if (!itemPai) { erros++; continue; }
      const result = await estoqueApi.excluirUnidade(itemPai.id, unidadeId);
      if (!result.success) erros++;
    }
    setSalvando(false);
    setSelecionados(new Set());
    setModoSelecao(false);
    if (erros > 0) aviso.atencao(`${erros} unidade(s) não puderam ser excluídas`);
    else aviso.sucesso('Unidades excluídas');
    onRefresh();
  }, [selecionados, itens, onRefresh]);

  const handleExcluirFamilia = useCallback(async () => {
    if (linha.tipo !== 'familia') return;
    const result = await estoqueFamiliasApi.excluir(linha.familia.id);
    if (result.success) {
      aviso.sucesso('Família excluída');
      onClose();
      onRefresh();
      return;
    }
    // 409 = tem unidade vendida — oferecer "desvincular"
    if ((result as any).status === 409 || result.error?.includes('409') || result.error?.includes('vendida')) {
      if (confirm('Esta família tem unidades já vendidas e não pode ser excluída. Deseja desvincular as peças (elas ficam no estoque sem família)?')) {
        await desvinuclarFamilia();
      }
      return;
    }
    aviso.erro('Erro ao excluir família', { descricao: result.error });
  }, [linha, onClose, onRefresh]);

  const desvinuclarFamilia = useCallback(async () => {
    if (linha.tipo !== 'familia') return;
    setSalvando(true);
    let erros = 0;
    for (const item of itens) {
      const result = await estoqueApi.atualizar(item.id, { familia_id: null });
      if (!result.success) erros++;
    }
    setSalvando(false);
    if (erros > 0) aviso.atencao(`${erros} peça(s) não foram desvinculadas`);
    else { aviso.sucesso('Peças desvinculadas da família'); onClose(); onRefresh(); }
  }, [linha, itens, onClose, onRefresh]);

  const handleVendaRapida = useCallback(() => {
    // Grava o nome da família no sessionStorage e navega pra aba Vendas via
    // evento customizado — App.tsx escuta 'rk:ir-para-vendas' e troca a aba.
    const termoBusca = linha.tipo === 'familia' ? linha.familia.nome : linha.item.nome;
    try { sessionStorage.setItem('rk:venda-rapida-busca', termoBusca); } catch { /* privado */ }
    window.dispatchEvent(new CustomEvent('rk:ir-para-vendas'));
    onClose();
  }, [linha, onClose]);

  // Mover unidades selecionadas para outra ficha
  const handleMoverSelecionadas = useCallback(async () => {
    if (!movendoPara) { aviso.atencao('Selecione a ficha de destino.'); return; }
    if (selecionados.size === 0) return;
    setSalvando(true);
    let erros = 0;
    for (const unidadeId of selecionados) {
      const itemPai = itens.find((it) => it.unidades?.some((u) => u.id === unidadeId));
      if (!itemPai) { erros++; continue; }
      const result = await estoqueApi.moverUnidade(itemPai.id, unidadeId, movendoPara);
      if (!result.success) erros++;
    }
    setSalvando(false);
    setMoverDestinoAberto(false);
    setSelecionados(new Set());
    setModoSelecao(false);
    setMovendoPara('');
    if (erros > 0) aviso.atencao(`${erros} unidade(s) não foram movidas`);
    else aviso.sucesso('Unidades movidas');
    onRefresh();
  }, [movendoPara, selecionados, itens, onRefresh]);

  return (
    <DialogContent open={open} onClose={onClose} title="Estoque — família de peças" description="Detalhes e unidades da família">
      {/* Botão fechar */}
      <DialogCloseButton />

      {/* Header: título + 6 métricas */}
      <div className="px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
        <div className="pr-6">
          <h2 className="text-base font-semibold text-text-primary leading-snug line-clamp-2">{titulo}</h2>
          {linha.tipo === 'familia' && itens[0]?.categoria?.nome && (
            <p className="text-xs text-text-muted mt-0.5">{itens[0].categoria.nome}</p>
          )}
        </div>

        {/* 6 métricas — número sempre maior que o label */}
        <div className="flex items-center justify-between mt-4 gap-1 overflow-x-auto">
          <MetricTile valor={nModelos} label="Modelos" />
          <div className="h-8 w-px bg-border-subtle shrink-0" />
          <MetricTile valor={nVariacoes} label="Variações" />
          <div className="h-8 w-px bg-border-subtle shrink-0" />
          <MetricTile valor={nEmEstoque} label="Em estoque" />
          <div className="h-8 w-px bg-border-subtle shrink-0" />
          <MetricTile valor={fmt(valorTotal)} label="Valor total" />
          <div className="h-8 w-px bg-border-subtle shrink-0" />
          <MetricTile valor={faixaTexto} label="Faixa" />
          <div className="h-8 w-px bg-border-subtle shrink-0" />
          <MetricTile valor={nAvaria} label="c/ Avaria" />
        </div>
      </div>

      {/* Barra de busca + filtros */}
      <div className="px-4 py-3 border-b border-border-subtle shrink-0 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="search"
            placeholder="Buscar unidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-control border border-border-default bg-surface-inset text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value as any)}
          className="text-sm rounded-control border border-border-default bg-surface-inset text-text-primary px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="todos">Todos</option>
          <option value="disponivel">Disponível</option>
          <option value="vendida">Vendida</option>
        </select>
        <select
          value={avaFiltro}
          onChange={(e) => setAvaFiltro(e.target.value as any)}
          className="text-sm rounded-control border border-border-default bg-surface-inset text-text-primary px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="todos">Avaria: todos</option>
          <option value="com">Com avaria</option>
          <option value="sem">Sem avaria</option>
        </select>
      </div>

      {/* Abas */}
      <div className="shrink-0 px-4 pt-3">
        <Tabs defaultValue="unidades">
          <TabsList className="w-fit">
            <TabsTrigger value="unidades">Unidades</TabsTrigger>
            <TabsTrigger value="historico" disabled className="opacity-40 cursor-not-allowed">Histórico</TabsTrigger>
            <TabsTrigger value="relacionadas" disabled className="opacity-40 cursor-not-allowed">Relacionadas</TabsTrigger>
          </TabsList>

          {/* Corpo scrollável */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(88dvh - 330px)' }}>
            <TabsContents>
              <TabsContent value="unidades">
                {/* Multi-seleção */}
                {modoSelecao && selecionados.size > 0 && (
                  <div className="flex items-center gap-2 py-2 bg-accent-soft rounded-control px-3 mb-2 flex-wrap">
                    <span className="text-sm font-medium text-accent-fg flex-1 min-w-0">{selecionados.size} selecionada(s)</span>
                    {/* Mover selecionadas */}
                    {itens.length > 1 && (
                      <div className="relative">
                        <Button
                          variant="ghost" size="sm" className="h-7"
                          disabled={salvando}
                          onClick={() => setMoverDestinoAberto((v) => !v)}
                        >
                          <Move size={12} />
                          Mover
                          <ChevronDown size={10} />
                        </Button>
                        {moverDestinoAberto && (
                          <div className="absolute bottom-full mb-1 left-0 z-10 bg-surface-card border border-border-default rounded-control shadow-lg p-2 min-w-48">
                            <p className="text-xs text-text-muted mb-1.5 px-1">Mover para a ficha:</p>
                            {itens.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={cn(
                                  'w-full text-left text-xs px-2 py-1.5 rounded hover:bg-surface-raised',
                                  movendoPara === item.id ? 'font-medium text-accent' : 'text-text-primary'
                                )}
                                onClick={() => setMovendoPara(item.id)}
                              >
                                {item.modelo_moto?.nome ?? item.nome}
                                {item.modelo_moto?.ano ? ` · ${item.modelo_moto.ano}` : ''}
                              </button>
                            ))}
                            <div className="flex gap-1 mt-2 pt-1.5 border-t border-border-subtle">
                              <Button size="sm" className="h-6 text-xs flex-1" disabled={!movendoPara || salvando} onClick={handleMoverSelecionadas}>
                                Confirmar
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setMoverDestinoAberto(false); setMovendoPara(''); }}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger h-7"
                      disabled={salvando}
                      onClick={handleExcluirSelecionadas}
                    >
                      <Trash2 size={12} />
                      Excluir
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => { setSelecionados(new Set()); setModoSelecao(false); }}>
                      Cancelar
                    </Button>
                  </div>
                )}

                {grupos.length === 0 ? (
                  <div className="py-8 text-center text-text-faint text-sm">Nenhuma unidade cadastrada</div>
                ) : (
                  <Accordion type="multiple" defaultValue={grupos.map((g) => g.modeloMotoId ?? '__sem__')}>
                    {grupos.map((grupo) => (
                      <GrupoModelo
                        key={grupo.modeloMotoId ?? '__sem__'}
                        grupo={grupo}
                        busca={busca}
                        statusFiltro={statusFiltro}
                        avaFiltro={avaFiltro}
                        selecionados={selecionados}
                        modoSelecao={modoSelecao}
                        onToggleSelecao={toggleSelecao}
                        onVerDetalhes={handleVerDetalhes}
                        onEditarUnidade={handleEditarUnidade}
                        onExcluirUnidade={handleExcluirUnidade}
                        onMarcarVendida={handleMarcarVendida}
                      />
                    ))}
                  </Accordion>
                )}
              </TabsContent>

              <TabsContent value="historico">
                <div className="py-8 text-center text-sm text-text-muted">Em breve</div>
              </TabsContent>
              <TabsContent value="relacionadas">
                <div className="py-8 text-center text-sm text-text-muted">Em breve</div>
              </TabsContent>
            </TabsContents>
          </div>
        </Tabs>
      </div>

      {/* Rodapé — no máximo 1 botão accent (Registrar unidade) */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border-subtle shrink-0 mt-auto">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleVendaRapida}>
          <ShoppingCart size={12} />
          Venda rápida
        </Button>
        {!modoSelecao && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setModoSelecao(true)}>
            <Check size={12} />
            Selecionar
          </Button>
        )}
        <div className="flex-1" />
        {linha.tipo === 'familia' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-danger hover:text-danger"
            disabled={salvando}
            onClick={handleExcluirFamilia}
          >
            <Trash2 size={12} />
            Excluir
          </Button>
        )}
        {/* Único botão accent */}
        <Button size="sm" className="h-8 text-xs" onClick={() => setRegistrarAberto(true)}>
          <Plus size={12} />
          Registrar unidade
        </Button>
      </div>

      {/* Dialog empilhado de Registrar unidade */}
      {registrarAberto && (
        <RegistrarUnidadeDialog
          linha={linha}
          open={registrarAberto}
          onClose={() => setRegistrarAberto(false)}
          onRefresh={() => { setRegistrarAberto(false); handleRefreshDetalhe(); }}
        />
      )}

      {/* Dialog empilhado de Editar unidade */}
      {editarUnidade && (
        <RegistrarUnidadeDialog
          linha={linha}
          open={!!editarUnidade}
          onClose={() => setEditarUnidade(null)}
          onRefresh={(atualizacao) => { setEditarUnidade(null); handleRefreshDetalhe(atualizacao); }}
          unidadeParaEditar={editarUnidade.u}
        />
      )}

      {fichaDetalhe && (
        <DialogContent
          open={!!fichaDetalhe}
          onClose={() => setFichaDetalhe(null)}
          title="Detalhes da unidade"
          description="Fotos e informações da ficha individual"
          className="md:max-w-xl"
        >
          <DialogCloseButton />
          <div className="px-5 pt-5 pb-3 border-b border-border-subtle">
            <h2 className="text-base font-semibold text-text-primary">{fichaDetalhe.u.nome ?? 'Padrão'}</h2>
            <p className="text-xs text-text-muted mt-0.5">{fichaDetalhe.item.codigo}</p>
          </div>
          <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(88dvh - 180px)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {fichaDetalhe.u.fotos.length > 0 ? fichaDetalhe.u.fotos.map((foto, index) => (
                <div key={`${foto}-${index}`} className="aspect-square rounded-control overflow-hidden border border-border-subtle bg-surface-inset">
                  <ImageZoom src={foto} alt={`Foto ${index + 1} da unidade`} className="w-full h-full object-cover" triggerClassName="block w-full h-full" referrerPolicy="no-referrer" />
                </div>
              )) : (
                <div className="col-span-full py-8 text-center text-sm text-text-muted">Nenhuma foto cadastrada</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="block text-xs text-text-muted">Valor</span><span className="font-semibold text-text-primary">{fichaDetalhe.u.valor != null ? fmt(fichaDetalhe.u.valor) : fmt(fichaDetalhe.item.valor)}</span></div>
              <div><span className="block text-xs text-text-muted">Condição</span><span className="font-medium text-text-primary">{fichaDetalhe.u.condicao_nota ? `Nota ${fichaDetalhe.u.condicao_nota}` : 'Herdada da ficha'}</span></div>
              <div><span className="block text-xs text-text-muted">Status</span><span className="font-medium text-text-primary">{fichaDetalhe.u.vendida_em ? 'Vendida' : 'Disponível'}</span></div>
              <div><span className="block text-xs text-text-muted">Avaria</span><span className="font-medium text-text-primary">{fichaDetalhe.u.avaria ? (fichaDetalhe.u.avaria_descricao || 'Sim') : 'Não'}</span></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border-subtle">
            <Button variant="ghost" size="sm" onClick={() => setFichaDetalhe(null)}>Fechar</Button>
            {!fichaDetalhe.u.vendida_em && <Button size="sm" onClick={() => { const atual = fichaDetalhe; setFichaDetalhe(null); handleEditarUnidade(atual.u, atual.item); }}><Pencil size={13} /> Editar</Button>}
          </div>
        </DialogContent>
      )}
    </DialogContent>
  );
}
