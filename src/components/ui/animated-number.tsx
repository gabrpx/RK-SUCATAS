// Número com contagem animada (spring), equivalente local ao animated-number do
// Cult UI. Autoral porque o registry do Cult fica atrás de um bot-challenge da
// Vercel (não instalável via CLI aqui) — e assim já nasce nos tokens/springs
// deste projeto. Anima o valor via `motion`, reusando SPRING_MICRO (ver
// src/components/ui/motion.ts) pra ficar coerente com o resto do movimento da
// base. Respeita `prefers-reduced-motion`: sem animação, mostra o valor final.
//
// Uso típico (moeda): <AnimatedNumber value={total} format={formatCurrency} />
// O `format` recebe o valor intermediário a cada frame — passe a MESMA função
// de formatação já usada na tela (não montar formatação por fora).
import * as React from 'react';
import {
  motion,
  useInView,
  useReducedMotion,
  useSpring,
  useTransform,
  type SpringOptions,
} from 'motion/react';

import { SPRING_MICRO } from './motion';
import { cn } from '../../utils';

// SPRING_MICRO é um Transition (inclui `type: 'spring'`); useSpring só lê
// stiffness/damping, então dá pra reaproveitar direto.
const DEFAULT_SPRING = SPRING_MICRO as SpringOptions;

// Os limiares de repouso do spring são absolutos (0.01 e 2 por padrão) e foram
// pensados pra pixels. Num valor de estoque na casa dos 90 mil isso vira uma
// cauda longa: o número trava em "R$ 93.805,23" por mais de um segundo até
// fechar os centavos. Escalando o repouso pela ordem de grandeza do alvo, a
// contagem encerra assim que chega perto — e o motion crava o valor exato ao
// terminar, então o número final continua sendo o correto.
function repousoPara(value: number): SpringOptions {
  const magnitude = Math.abs(value);
  return {
    restDelta: Math.max(0.01, magnitude / 1000),
    restSpeed: Math.max(2, magnitude / 100),
  };
}

type AnimatedNumberProps = {
  value: number;
  /** Formata o valor a cada frame. Default: inteiro arredondado. */
  format?: (value: number) => string;
  /** Valor de partida da animação de entrada. Default: 0 (conta de zero). */
  from?: number;
  /**
   * Só começa a contar quando o número entra na viewport. Use em listas longas
   * (ex: cards de moto), onde contar tudo de uma vez fora da tela desperdiça
   * a animação — e no mobile ainda pesa. Default: false (conta ao montar).
   */
  inView?: boolean;
  spring?: SpringOptions;
  className?: string;
};

export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  from = 0,
  inView = false,
  spring = DEFAULT_SPRING,
  className,
}: AnimatedNumberProps) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  // `once`: depois que contou, não reconta ao rolar de volta.
  const visivel = useInView(ref, { once: true, amount: 0.5 });
  const podeAnimar = !inView || visivel;

  const opcoes = React.useMemo(
    () => ({ ...repousoPara(value), ...spring }),
    [value, spring],
  );
  const motionValue = useSpring(from, opcoes);
  const display = useTransform(motionValue, (latest) => format(latest));

  React.useEffect(() => {
    if (reduce) {
      // Sem movimento: pula direto pro valor final, sem animar.
      motionValue.jump(value);
      return;
    }
    if (!podeAnimar) return;
    motionValue.set(value);
  }, [value, reduce, podeAnimar, motionValue]);

  return (
    <motion.span ref={ref} className={cn('tabular-nums', className)}>
      {display}
    </motion.span>
  );
}
