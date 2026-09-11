// Faixa de 4 pills (T01): total de gavetas / variantes / unidades / valor.
// Número é o elemento mais forte (ver CLAUDE.md > Design system): número
// grande em cima, label pequeno em UPPERCASE embaixo. Pill de VALOR usa
// accent (é o número "mais forte" da tela), as outras usam superfície neutra.
// Scroll horizontal próprio — a página nunca deve rolar na horizontal.
import { cn } from '../../../utils';

interface StatsRowProps {
  gavetas: number;
  variantes: number;
  unidades: number;
  valorTotal: number;
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR');
const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

function Pill({ valor, label, accent }: { valor: string; label: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'flex-none min-w-[104px] rounded-card border p-3',
        accent ? 'bg-surface-card border-accent' : 'bg-surface-card border-border-subtle'
      )}
    >
      <p className={cn('text-lg font-bold leading-tight truncate', accent ? 'text-accent' : 'text-text-primary')}>{valor}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mt-0.5">{label}</p>
    </div>
  );
}

export function StatsRow({ gavetas, variantes, unidades, valorTotal }: StatsRowProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="list" aria-label="Estatísticas do estoque">
      <Pill valor={fmtInt(gavetas)} label="Gavetas" />
      <Pill valor={fmtInt(variantes)} label="Variantes" />
      <Pill valor={fmtInt(unidades)} label="Unidades" />
      <Pill valor={fmtMoeda(valorTotal)} label="Valor" accent />
    </div>
  );
}
