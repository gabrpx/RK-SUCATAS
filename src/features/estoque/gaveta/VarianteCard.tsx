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
import { Package, Pencil, Plus, X } from 'lucide-react';
import { cn } from '../../../utils';
import { Button } from '../../../components/ui/button';
import { estoqueApi } from '../api';
import { useData } from '../../../context/DataContext';
import { faixaPrecoVariante } from './gavetaEstoque';
import { UnidadeForm } from './UnidadeForm';
import { UnidadeRow } from './UnidadeRow';
import type { Estoque, EstoqueUnidade } from '../types';

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
  const [editandoAno, setEditandoAno] = useState(false);
  const [faixaAno, setFaixaAno] = useState(() => parseFaixaAno(item.ano));
  const [salvandoAno, setSalvandoAno] = useState(false);
  const [novaUnidadeAberta, setNovaUnidadeAberta] = useState(false);
  const [unidadeEditando, setUnidadeEditando] = useState<EstoqueUnidade | null>(null);

  const faixa = faixaPrecoVariante(item);
  const unidadesDisponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em);
  const semFicha = Math.max(0, (Number(item.quantidade) || 0) - unidadesDisponiveis.length);
  const totalUnidades = unidadesDisponiveis.length + semFicha;
  const capa = item.imagens[0] ?? null;

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

  const inputAnoClass =
    'w-16 border rounded-control py-1 px-2 text-sm text-center outline-none bg-surface-inset border-accent text-text-primary focus:ring-2 focus:ring-accent/50';

  return (
    <div className={cn('rounded-card border p-3 space-y-3', editandoAno ? 'border-accent' : 'border-border-default')}>
      <div className="flex items-start gap-3">
        <div className="flex-none size-14 rounded-control overflow-hidden bg-surface-inset flex items-center justify-center text-text-faint">
          {capa ? (
            <img src={capa} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Package size={20} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-text-primary truncate">{item.nome}</p>
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
                valorPadrao={item.valor}
                notaPadrao={item.condicao_nota}
                onEditar={setUnidadeEditando}
              />
            </div>
          ))}
          {unidadesDisponiveis.length === 0 && semFicha === 0 && (
            <p className="text-xs text-text-faint py-2">Nenhuma unidade cadastrada.</p>
          )}
        </div>

        {novaUnidadeAberta && (
          <div className="mt-2">
            <UnidadeForm estoqueId={item.id} onSalvar={aoSalvarUnidade} onCancelar={() => setNovaUnidadeAberta(false)} />
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
    </div>
  );
}
