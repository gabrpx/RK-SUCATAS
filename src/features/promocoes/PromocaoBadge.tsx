// Badge de desconto ativo — mesmo tom "accent" já usado pra destacar algo
// fora do padrão (ver StatusBadge), nunca "positive"/"danger": desconto não
// é bom nem ruim por si só, é um destaque temporário no preço.
import { Tag } from 'lucide-react';
import { cn } from '../../utils';
import { formatarPrazoRestante } from './formatarPrazo';
import type { PromocaoAtiva } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

export function PromocaoBadge({ promocao, className }: { promocao: PromocaoAtiva; className?: string }) {
  const rotulo = promocao.tipo_desconto === 'percentual' ? `-${promocao.valor}%` : `-${formatCurrency(promocao.valor)}`;
  return (
    <span
      title={formatarPrazoRestante(promocao.data_fim)}
      className={cn('inline-flex items-center gap-1 rounded-badge bg-accent-soft-bg px-1.5 py-0.5 text-[10px] font-semibold text-accent-soft-fg leading-none', className)}
    >
      <Tag size={9} /> {rotulo}
    </span>
  );
}
