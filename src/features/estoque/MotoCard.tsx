// Card de um modelo de moto (nó-folha de modelos_moto) na visualização "Por
// Moto" do Estoque. A contagem de peças é o elemento mais forte do card —
// nome/breadcrumb são só identificação, ver regra de hierarquia número > label
// em CLAUDE.md.
import { Bike } from 'lucide-react';
import { cn } from '../../utils';

interface MotoCardProps {
  nome: string;
  ano: string | null;
  breadcrumb: string;
  imagemUrl: string | null;
  quantidadePecas: number;
  onClick: () => void;
}

export function MotoCard({ nome, ano, breadcrumb, imagemUrl, quantidadePecas, onClick }: MotoCardProps) {
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
      </div>
      <div className="p-4">
        {breadcrumb && <p className="text-[11px] text-text-faint truncate">{breadcrumb}</p>}
        <p className={cn('text-sm font-medium text-text-primary truncate', breadcrumb ? 'mt-0.5' : '')}>
          {nome}
          {ano && <span className="text-text-muted font-normal"> ({ano})</span>}
        </p>
        <p className="text-[22px] font-medium text-text-primary leading-none mt-3 tabular-nums">{quantidadePecas}</p>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-faint mt-1">
          {quantidadePecas === 1 ? 'peça cadastrada' : 'peças cadastradas'}
        </p>
      </div>
    </button>
  );
}
