// 1 card de VARIANTE dentro do GavetaDetail (T02, docs/mockups/T02-detalhe-gaveta.png):
// 1 peça (Estoque) = 1 variante. Thumbnail + título + badges (condição e
// canais de anúncio vinculados) + faixa de ano editável inline + faixa de
// preço COMPUTADA (nunca fixa) + lista de UnidadeRow + "+ Unidade" inline.
//
// Badges (5 cores semânticas do mockup, todas com token próprio a partir da
// Fase 2A): Original = accent (laranja, já é a cor de condicao='original' em
// EstoqueView), Paralela = info (roxo — token retomado do antigo roxo de
// marca, ver theme.css), Novo = accent-alt (azul), ML = warning (amarelo),
// Shopee = danger (rosa). "Novo" agora tem dado real: estoque.novo
// (migration_063), booleano manual — some quando false/ausente.
import { useState } from 'react';
import { Check, ChevronDown, Package, Pencil, Plus, X } from 'lucide-react';
import { cn } from '../../../utils';
import { Button } from '../../../components/ui/button';
import { estoqueApi } from '../api';
import { useData } from '../../../context/DataContext';
import { useCatalogos } from '../../../hooks/useCatalogos';
import { faixaPrecoVariante } from './gavetaEstoque';
import { UnidadeForm } from './UnidadeForm';
import { UnidadeRow } from './UnidadeRow';
import { UnidadeDetailDialog } from './UnidadeDetailDialog';
import { nomeVarianteExibicao } from './buscaGavetas';
import { PendenciaVarianteChips } from './PendenciaBadges';
import { obterNomeVariacaoModelo } from '../../motos/nomeModelo';
import type { Estoque, EstoqueUnidade } from '../types';
import { aviso } from '../../../components/ui/toast';

const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

function FaixaPreco({ faixa }: { faixa: { min: number; max: number } | null }) {
  if (!faixa) return <span className="text-sm text-text-faint">Sem preço</span>;
  if (faixa.min === faixa.max) {
    return <span className="text-base font-bold text-text-primary">{fmtMoeda(faixa.min)}</span>;
  }
  return (
    <span className="text-base font-bold text-text-primary">
      {fmtMoeda(faixa.min)} ~ {fmtMoeda(faixa.max)}
    </span>
  );
}

function parseFaixaAno(ano: string | null): { inicio: string; fim: string } {
  if (!ano) return { inicio: '', fim: '' };
  const [inicio, fim] = ano.split('-').map((v) => v.trim());
  return { inicio: inicio ?? '', fim: fim ?? inicio ?? '' };
}

interface VarianteCardProps {
  item: Estoque;
}

export function VarianteCard({ item }: VarianteCardProps) {
  const { refreshData } = useData();
  const { modelos } = useCatalogos();
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeRascunho, setNomeRascunho] = useState(() => nomeVarianteExibicao(item.nome));
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [editandoAno, setEditandoAno] = useState(false);
  const [faixaAno, setFaixaAno] = useState(() => parseFaixaAno(item.ano));
  const [salvandoAno, setSalvandoAno] = useState(false);
  const [novaUnidadeAberta, setNovaUnidadeAberta] = useState(false);
  const [unidadeEmFicha, setUnidadeEmFicha] = useState<EstoqueUnidade | null>(null);
  const [unidadeEditando, setUnidadeEditando] = useState<EstoqueUnidade | null>(null);
  const [mostrarVendidas, setMostrarVendidas] = useState(false);

  const faixa = faixaPrecoVariante(item);
  const unidadesDisponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em);
  const unidadesVendidas = (item.unidades ?? []).filter((u) => u.vendida_em);
  const semFicha = Math.max(0, (Number(item.quantidade) || 0) - unidadesDisponiveis.length);
  const totalUnidades = unidadesDisponiveis.length + semFicha;
  const nomeExibicao = nomeVarianteExibicao(item.nome);
  const modeloCatalogo = item.modelo_moto_id ? modelos.find((modelo) => modelo.id === item.modelo_moto_id) : undefined;
  const nomeVariacaoSugerido = modeloCatalogo ? obterNomeVariacaoModelo(modeloCatalogo, modelos) : null;
  const nomePadraoUnidade = nomeVariacaoSugerido || nomeExibicao;

  const abrirEdicaoNome = () => {
    setNomeRascunho(nomeExibicao);
    setEditandoNome(true);
  };

  const salvarNome = async () => {
    const nome = nomeRascunho.trim();
    if (!nome) return aviso.atencao('Informe o nome da variante');
    if (nome === item.nome) {
      setEditandoNome(false);
      return;
    }
    setSalvandoNome(true);
    try {
      const resultado = await estoqueApi.atualizarParcial(item.id, { nome });
      if (!resultado.success) throw new Error(resultado.error || 'Falha ao renomear variante');
      await refreshData();
      setEditandoNome(false);
    } catch (error: any) {
      aviso.erro(error?.message || 'Não foi possível renomear a variante');
    } finally {
      setSalvandoNome(false);
    }
  };

  const abrirEdicaoAno = () => {
    setFaixaAno(parseFaixaAno(item.ano));
    setEditandoAno(true);
  };

  const salvarAno = async () => {
    const inicio = faixaAno.inicio.trim();
    const fim = faixaAno.fim.trim();
    const novoAno = inicio && fim ? (inicio === fim ? inicio : `${inicio}-${fim}`) : inicio || fim || null;
    if (novoAno === item.ano) {
      setEditandoAno(false);
      return;
    }
    setSalvandoAno(true);
    try {
      const resultado = await estoqueApi.atualizarParcial(item.id, { ano: novoAno });
      if (!resultado.success) throw new Error(resultado.error);
      await refreshData();
      setEditandoAno(false);
    } catch {
      // erro silencioso não bloqueia a UI — usuário pode tentar de novo
    } finally {
      setSalvandoAno(false);
    }
  };

  const aoSalvarUnidade = async () => {
    setNovaUnidadeAberta(false);
    setUnidadeEditando(null);
    await refreshData();
  };

  // Salvar e continuar: atualiza os dados mas mantém o form aberto e limpo.
  const aoSalvarEContinuar = async () => {
    await refreshData();
  };

  const inputAnoClass =
    'w-16 border rounded-control py-1 px-2 text-sm text-center outline-none bg-surface-inset border-accent text-text-primary focus:ring-2 focus:ring-accent/50';

  return (
    <div className={cn('rounded-card border p-3 space-y-3', editandoAno || editandoNome ? 'border-accent' : 'border-border-default')}>
      <div className="flex items-start gap-3">
        <div className="flex-none size-14 rounded-control overflow-hidden bg-surface-inset flex items-center justify-center text-text-faint">
          <Package size={20} aria-hidden />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {editandoNome ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  aria-label="Nome da variante"
                  value={nomeRascunho}
                  onChange={(event) => setNomeRascunho(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') salvarNome();
                    if (event.key === 'Escape') setEditandoNome(false);
                  }}
                  autoFocus
                  disabled={salvandoNome}
                  className="h-9 min-w-0 flex-1 rounded-control border border-accent bg-surface-inset px-2 text-sm font-bold text-text-primary outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button type="button" aria-label="Salvar nome da variante" onClick={salvarNome} disabled={salvandoNome} className="p-2 text-positive disabled:opacity-50">
                  <Check size={15} />
                </button>
                <button type="button" aria-label="Cancelar edição do nome" onClick={() => setEditandoNome(false)} disabled={salvandoNome} className="p-2 text-text-faint hover:text-danger disabled:opacity-50">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 items-start gap-1">
                <p className="min-w-0 break-words font-bold leading-snug text-text-primary [overflow-wrap:anywhere]">{nomeExibicao}</p>
                <button type="button" aria-label="Editar nome da variante" onClick={abrirEdicaoNome} className="shrink-0 p-1 text-text-faint hover:text-accent-soft-fg">
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <span
              className={cn(
                'shrink-0 rounded-badge px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                item.condicao === 'original' ? 'bg-accent-soft-bg text-accent-soft-fg' : 'bg-info-bg text-info'
              )}
            >
              {item.condicao === 'original' ? 'Original' : 'Paralela'}
            </span>
            {item.novo === true && (
              <span className="shrink-0 rounded-badge bg-accent-alt-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-alt">
                Novo
              </span>
            )}
            {(item.links_ml?.length ?? 0) > 0 && (
              <span className="shrink-0 rounded-badge bg-warning-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">
                ML
              </span>
            )}
            {(item.links_shopee?.length ?? 0) > 0 && (
              <span className="shrink-0 rounded-badge bg-danger-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">
                Shopee
              </span>
            )}
          </div>

          {editandoAno ? (
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <input
                  value={faixaAno.inicio}
                  onChange={(e) => setFaixaAno((f) => ({ ...f, inicio: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && salvarAno()}
                  placeholder="Início"
                  inputMode="numeric"
                  className={inputAnoClass}
                  autoFocus
                />
                <span className="text-text-faint">-</span>
                <input
                  value={faixaAno.fim}
                  onChange={(e) => setFaixaAno((f) => ({ ...f, fim: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && salvarAno()}
                  placeholder="Fim"
                  inputMode="numeric"
                  className={inputAnoClass}
                />
                <button type="button" onClick={() => setEditandoAno(false)} disabled={salvandoAno} className="text-text-faint hover:text-danger p-1">
                  <X size={14} />
                </button>
              </div>
              <p className="text-[10px] text-accent-soft-fg">✎ Editando faixa de ano - Enter para salvar</p>
            </div>
          ) : (
            <button type="button" onClick={abrirEdicaoAno} className="mt-0.5 flex items-center gap-1 text-xs text-text-muted hover:text-accent-soft-fg">
              {item.ano || 'Sem ano informado'}
              <Pencil size={11} className="text-text-faint" />
            </button>
          )}

          <div className="mt-1 flex items-center gap-2">
            <FaixaPreco faixa={faixa} />
            <span className="text-xs font-semibold text-text-muted">{totalUnidades} un.</span>
          </div>

          <PendenciaVarianteChips item={item} className="mt-1.5" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Unidades</p>
          <Button type="button" variant="accent-cta" size="sm" onClick={() => setNovaUnidadeAberta(true)}>
            <Plus size={13} /> Unidade
          </Button>
        </div>

        <div className="flex flex-col divide-y divide-border-subtle">
          {unidadesDisponiveis.map((unidade, i) => (
            <div key={unidade.id}>
              <UnidadeRow
                unidade={unidade}
                numero={i + 1}
                nomePadrao={nomePadraoUnidade}
                valorPadrao={item.valor}
                notaPadrao={item.condicao_nota}
                variante={item}
                onAbrirFicha={setUnidadeEmFicha}
              />
            </div>
          ))}
          {unidadesDisponiveis.length === 0 && semFicha === 0 && (
            <p className="text-xs text-text-faint py-2">Nenhuma unidade cadastrada.</p>
          )}
        </div>

        {unidadesVendidas.length > 0 && (
          <div className="mt-2 border-t border-border-subtle pt-2">
            <button
              type="button"
              onClick={() => setMostrarVendidas((v) => !v)}
              aria-expanded={mostrarVendidas}
              className="flex w-full items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-text-secondary min-h-9"
            >
              <ChevronDown size={13} className={cn('transition-transform', mostrarVendidas && 'rotate-180')} aria-hidden />
              Vendidas ({unidadesVendidas.length})
            </button>
            {mostrarVendidas && (
              <div className="mt-1 flex flex-col divide-y divide-border-subtle opacity-70">
                {unidadesVendidas.map((unidade, i) => (
                  <UnidadeRow
                    key={unidade.id}
                    unidade={unidade}
                    numero={unidadesDisponiveis.length + i + 1}
                    nomePadrao={nomeExibicao}
                    valorPadrao={item.valor}
                    notaPadrao={item.condicao_nota}
                    variante={item}
                    onAbrirFicha={setUnidadeEmFicha}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {novaUnidadeAberta && (
          <div className="mt-2">
            <UnidadeForm
              estoqueId={item.id}
              nomeSugerido={nomeVariacaoSugerido}
              onSalvar={aoSalvarUnidade}
              onSalvarEContinuar={aoSalvarEContinuar}
              onCancelar={() => setNovaUnidadeAberta(false)}
            />
          </div>
        )}

        {unidadeEditando && (
          <div className="mt-2">
            <UnidadeForm
              estoqueId={item.id}
              unidade={unidadeEditando}
              onSalvar={aoSalvarUnidade}
              onCancelar={() => setUnidadeEditando(null)}
            />
          </div>
        )}
      </div>

      <UnidadeDetailDialog
        aberto={Boolean(unidadeEmFicha)}
        unidade={unidadeEmFicha}
        numero={unidadesDisponiveis.findIndex((unidade) => unidade.id === unidadeEmFicha?.id) + 1}
        variante={item}
        onFechar={() => setUnidadeEmFicha(null)}
        onEditar={(unidade) => {
          setUnidadeEmFicha(null);
          setUnidadeEditando(unidade);
        }}
      />
    </div>
  );
}
