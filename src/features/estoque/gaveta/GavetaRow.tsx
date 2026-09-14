// 1 linha da listagem (T01): ícone da categoria, nome da gaveta (forte),
// "categoria · N variantes" (secundário), faixa de preço e contagem de
// unidades disponíveis, chevron indicando navegação pro detalhe (Task 13).
// Também cobre a variante "não agrupado" (item legado sem gaveta_id), que
// aparece dimmed com um badge tracejado "SEM GRUPO" no lugar do ícone normal.
import { ChevronRight, Fuel, Lightbulb, Zap, Puzzle, Package } from 'lucide-react';
import { cn } from '../../../utils';
import { statsGaveta, faixaPrecoVariante } from './gavetaEstoque';
import { ResumoPendenciasChips } from './PendenciaBadges';
import type { Estoque, Gaveta } from '../types';

const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

// Mapeamento simples nome-de-categoria -> ícone, só pra dar identidade visual
// à linha (não é fonte de verdade nenhuma, puramente decorativo/semântico).
function iconePorCategoria(nomeCategoria: string | null | undefined) {
  const nome = (nomeCategoria || '').toLowerCase();
  if (nome.includes('tanque')) return Fuel;
  if (nome.includes('farol') || nome.includes('lanterna')) return Lightbulb;
  if (nome.includes('cdi') || nome.includes('elétri') || nome.includes('eletri')) return Zap;
  if (nome.includes('carenagem')) return Puzzle;
  return Package;
}

function FaixaPreco({ faixa }: { faixa: { min: number; max: number } | null }) {
  if (!faixa) return <span className="break-words text-sm leading-snug text-text-faint">Sem preço</span>;
  if (faixa.min === faixa.max) return <span className="break-words text-sm font-semibold leading-snug text-text-primary">{fmtMoeda(faixa.min)}</span>;
  return (
    <span className="break-words text-sm font-semibold leading-snug text-text-primary">
      {fmtMoeda(faixa.min)} - {fmtMoeda(faixa.max)}
    </span>
  );
}

interface GavetaRowProps {
  gaveta: Gaveta;
  itens: Estoque[];
  onClick?: (gaveta: Gaveta) => void;
}

export function GavetaRow({ gaveta, itens, onClick }: GavetaRowProps) {
  const stats = statsGaveta(itens);
  const Icone = iconePorCategoria(gaveta.categoria?.nome);

  return (
    <button
      type="button"
      onClick={() => onClick?.(gaveta)}
      className="w-full flex items-start gap-2.5 py-3 px-1 text-left transition-colors hover:bg-surface-raised sm:items-center sm:gap-3 sm:px-3"
    >
      <div className="flex-none size-10 rounded-control border border-border-subtle bg-surface-inset flex items-center justify-center text-text-secondary">
        <Icone size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="break-words font-bold leading-snug text-text-primary [overflow-wrap:anywhere]">{gaveta.nome}</p>
        <p className="break-words text-xs leading-snug text-text-muted [overflow-wrap:anywhere]">
          {gaveta.categoria?.nome ?? 'Sem categoria'} · {stats.variantes} {stats.variantes === 1 ? 'variante' : 'variantes'}
        </p>
        <ResumoPendenciasChips itens={itens} className="mt-1" />
      </div>
      <div className="w-[34%] shrink-0 text-right sm:w-auto sm:max-w-[42%]">
        <FaixaPreco faixa={stats.faixa} />
        <p className="text-xs font-semibold text-accent-soft-fg">{stats.unidadesDisponiveis} un.</p>
      </div>
      <ChevronRight size={15} className="flex-none text-text-faint" />
    </button>
  );
}

interface GavetaRowNaoAgrupadoProps {
  item: Estoque;
  onClick?: (item: Estoque) => void;
}

// Item legado (gaveta_id null) — sem contagem de "variantes" (é 1 peça só) e
// sem ícone de categoria: o quadrado tracejado com "SEM GRUPO" ocupa o lugar
// do ícone pra deixar claro visualmente que isso é exceção, não regra.
export function GavetaRowNaoAgrupado({ item, onClick }: GavetaRowNaoAgrupadoProps) {
  const faixa = faixaPrecoVariante(item);
  const disponiveis = Math.max(0, Number(item.quantidade) || 0);

  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      className="w-full flex items-start gap-2.5 py-3 px-1 text-left opacity-60 transition-colors hover:bg-surface-raised sm:items-center sm:gap-3 sm:px-3"
    >
      <div className="flex-none size-10 rounded-control border border-dashed border-border-default flex items-center justify-center">
        <span className="text-[8px] font-bold uppercase tracking-wider text-text-faint leading-tight text-center">
          Sem
          <br />
          grupo
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="break-words font-bold leading-snug text-text-secondary [overflow-wrap:anywhere]">{item.nome}</p>
        <p className="break-words text-xs leading-snug text-text-faint [overflow-wrap:anywhere]">{item.categoria?.nome ?? 'Sem categoria'} · Legado</p>
      </div>
      <div className="w-[34%] shrink-0 text-right sm:w-auto sm:max-w-[42%]">
        <FaixaPreco faixa={faixa} />
        <p className="text-xs text-text-faint">{disponiveis} un.</p>
      </div>
      <ChevronRight size={15} className={cn('flex-none text-text-faint')} />
    </button>
  );
}
