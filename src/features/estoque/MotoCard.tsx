// Card de um modelo de moto na visualização "Por Moto" do Estoque. A
// contagem de peças é o elemento mais forte do card — nome/breadcrumb são só
// identificação, ver regra de hierarquia número > label em CLAUDE.md.
//
// Quando o modelo tem variações por ano cadastradas (ex: CG 150 Carburada
// 2004-2008 / Mix 2009-2013 / Injetada 2013+), este card representa o grupo:
// a contagem soma as peças de todas as variações, e o clique abre os cards
// das variações em vez de ir direto pra lista de peças — ver EstoqueByMoto.tsx.
import { Bike, Layers } from 'lucide-react';
import { cn } from '../../utils';
import { AnimatedNumber } from '../../components/ui/animated-number';

interface MotoCardProps {
  nome: string;
  ano: string | null;
  breadcrumb: string;
  imagemUrl: string | null;
  quantidadePecas: number;
  /** > 0 quando este card é um grupo (modelo com variações por ano). */
  quantidadeVariacoes?: number;
  onClick: () => void;
}

export function MotoCard({ nome, ano, breadcrumb, imagemUrl, quantidadePecas, quantidadeVariacoes = 0, onClick }: MotoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface-card border border-border-subtle rounded-card overflow-hidden text-left hover:border-border-default transition-colors flex flex-col"
    >
      <div className="relative aspect-[4/3] w-full bg-surface-inset flex items-center justify-center">
        {imagemUrl ? (
          <img src={imagemUrl} alt={nome} className="w-full h-full object-contain" />
        ) : (
          <Bike size={40} strokeWidth={1.5} className="text-text-faint" />
        )}
        {quantidadeVariacoes > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-badge bg-surface-page/90 border border-border-subtle px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
            <Layers size={10} /> {quantidadeVariacoes}
          </span>
        )}
      </div>
      <div className="p-4">
        {breadcrumb && <p className="text-[11px] text-text-faint truncate">{breadcrumb}</p>}
        <p className={cn('text-sm font-medium text-text-primary truncate', breadcrumb ? 'mt-0.5' : '')}>
          {nome}
          {ano && <span className="text-text-muted font-normal"> ({ano})</span>}
        </p>
        {/* `inView`: a grade de motos é longa; só conta o card que aparece. */}
        <p className="text-[22px] font-medium text-text-primary leading-none mt-3 tabular-nums">
          <AnimatedNumber value={quantidadePecas} inView />
        </p>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mt-1">
          {quantidadeVariacoes > 0
            ? `${quantidadeVariacoes} ${quantidadeVariacoes === 1 ? 'versão' : 'versões'} · ${quantidadePecas === 1 ? 'peça' : 'peças'}`
            : quantidadePecas === 1
            ? 'peça cadastrada'
            : 'peças cadastradas'}
        </p>
      </div>
    </button>
  );
}
