// MetricCard: bloco de KPI usado em dashboards e resumos de tela.
// Redesenhado no estilo do "statistics-card-1" (21st.dev): rótulo discreto +
// ícone no topo, o VALOR grande logo abaixo com um badge de variação (seta +
// %) ao lado, e uma linha de contexto após uma divisória. Segue a regra do
// design system (ver CLAUDE.md): o número é o elemento mais forte; o rótulo é
// secundário. A API (icone/label/valor/contexto/tom) é a mesma de antes — o
// `tendencia` é opcional, então todos os usos existentes seguem funcionando.
import type { LucideIcon } from 'lucide-react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../utils';
import { AnimatedNumber } from './animated-number';
import { CountingNumber } from '@/src/components/animate-ui/primitives/texts/counting-number';

export type MetricTone = 'positive' | 'neutral' | 'negative';

export interface MetricTendencia {
  /** Variação absoluta em % (inteiro). null = sem base de comparação → sem badge. */
  pct: number | null;
  /** Direção real do número, pra escolher a seta ↑/↓. */
  subiu: boolean;
  /** Juízo semântico (bom/ruim) — define a cor do badge, podendo divergir da seta. */
  positivo: boolean;
}

// Cada tom só colore o ícone do topo (o valor é sempre neutro/forte). 'neutral'
// usa o accent porque uma métrica de destaque pode ser neutra sem carregar
// juízo positivo/negativo.
const ICON_TONE: Record<MetricTone, string> = {
  positive: 'text-positive',
  neutral: 'text-accent-soft-fg',
  negative: 'text-negative',
};

export interface MetricCardProps {
  /** Ícone exibido no canto superior direito */
  icone: LucideIcon;
  /** Rótulo curto da métrica (renderizado em caixa alta) */
  label: string;
  /**
   * Valor principal. Passe `string` quando já vier formatado (nível de
   * reputação, "12%", "—"). Passe `number` — junto de `formatarValor` — pra
   * ganhar a contagem animada até o valor final.
   */
  valor: string | number;
  /**
   * Formata o valor a cada quadro da contagem. Só se aplica quando `valor` é
   * número; passe a MESMA função de formatação usada no resto da tela.
   */
  formatarValor?: (value: number) => string;
  /** Linha de apoio abaixo do valor, após a divisória (ex: "12 vendas neste mês") */
  contexto?: string;
  /** Define a cor semântica do ícone */
  tom?: MetricTone;
  /** Badge de variação vs. período anterior (opcional). */
  tendencia?: MetricTendencia;
  /** Ajusta o feedback de hover para painéis operacionais sem deslocar o card. */
  hoverStyle?: 'lift' | 'subtle';
  /** Peso opcional do valor para destaques locais, sem alterar outros dashboards. */
  valorPeso?: 'semibold' | 'bold';
}

export function MetricCard({ icone: Icone, label, valor, formatarValor, contexto, tom = 'neutral', tendencia, hoverStyle = 'lift', valorPeso = 'semibold' }: MetricCardProps) {
  const mostraBadge = tendencia && tendencia.pct != null;
  const hoverClasses = hoverStyle === 'subtle'
    ? 'transition-[border-color,box-shadow] duration-200 hover:border-accent/35 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]'
    : 'transition-[transform,border-color,box-shadow] duration-base hover:-translate-y-0.5 hover:border-border-default hover:shadow-md';

  return (
    <div className={cn('group relative min-w-0 h-full overflow-hidden bg-surface-card border border-border-subtle rounded-card p-4 sm:p-5', hoverClasses)}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-surface-edge" />

      {/* Cabeçalho: rótulo à esquerda, ícone à direita (posição do menu no card original) */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-2xs font-semibold uppercase tracking-[0.06em] text-text-faint leading-tight line-clamp-2 break-words">{label}</p>
        <Icone size={16} strokeWidth={1.75} className={cn('shrink-0 mt-px', ICON_TONE[tom])} />
      </div>

      {/* Valor grande + badge de variação. No mobile o número é um degrau menor
          pra caber sem cortar em tela estreita, mas segue dominante sobre o
          label (regra do design system: número > label). Quando vem como
          número, conta até o valor final — reforça que ali está o dado. */}
      <div className="flex flex-wrap items-center gap-2.5 mt-3">
        <span className={cn('min-w-0 max-w-full text-xl sm:text-3xl text-text-primary leading-tight tabular-nums tracking-tight break-words', valorPeso === 'bold' ? 'font-bold' : 'font-semibold')}>
          {typeof valor === 'number' ? (
            formatarValor ? (
              // O primitivo `CountingNumber` do animate-ui não aceita uma
              // função de formatação por quadro (só decimalPlaces/
              // decimalSeparator) — não dá pra produzir "R$ 93.805,00" ou
              // "12%" com ele. Pra valor formatado (moeda, %, etc., que é a
              // maioria dos usos reais deste componente) mantém-se o
              // AnimatedNumber autoral, que já resolve isso.
              <AnimatedNumber value={valor} format={formatarValor} inView />
            ) : (
              <CountingNumber number={valor} inView />
            )
          ) : (
            valor
          )}
        </span>
        {mostraBadge && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-badge px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
              tendencia!.positivo ? 'bg-positive-bg text-positive' : 'bg-negative-bg text-negative'
            )}
          >
            {tendencia!.subiu ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
            {tendencia!.pct}%
          </span>
        )}
      </div>

      {/* Divisória + contexto (até 2 linhas no mobile em vez de cortar) */}
      {contexto && (
        <p className="text-xs text-text-faint mt-3 border-t border-border-subtle pt-2.5 leading-snug line-clamp-2 break-words">{contexto}</p>
      )}
    </div>
  );
}
