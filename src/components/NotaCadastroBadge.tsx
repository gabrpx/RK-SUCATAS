// Selo visual pra peças de Motor indicando se têm nota fiscal pra cadastro —
// usado em toda tela que exibe uma peça (tabela, card, busca, detalhe), pra
// deixar a informação evidente onde quer que o item apareça.
import { FileCheck, FileX } from 'lucide-react';
import { cn } from '../utils';
import type { NotaCadastro } from '../features/estoque/types';

const NOTA_CADASTRO_LABEL: Record<NotaCadastro, string> = { com_nota: 'Com nota', sem_nota: 'Sem nota' };

export function NotaCadastroBadge({ value, size = 'md' }: { value: NotaCadastro | null | undefined; size?: 'sm' | 'md' }) {
  if (!value) return null;
  const isCom = value === 'com_nota';
  const Icon = isCom ? FileCheck : FileX;
  return (
    <span
      title={`${NOTA_CADASTRO_LABEL[value]} pra cadastro`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wide border shrink-0',
        size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2 py-1',
        isCom ? 'bg-sky-500/10 text-sky-500 border-sky-500/30' : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
      )}
    >
      <Icon size={size === 'sm' ? 9 : 11} strokeWidth={3} />
      {NOTA_CADASTRO_LABEL[value]}
    </span>
  );
}
