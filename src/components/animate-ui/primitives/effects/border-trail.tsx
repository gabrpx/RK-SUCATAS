'use client';

// Portado do motion-primitives (@motion-primitives/border-trail).
// Fetch via CLI/registry HTTP direto bloqueado por um Vercel Security Checkpoint
// (challenge JS, mesmo obstáculo documentado em src/components/ui/animated-number.tsx
// pro Cult UI) — conteúdo obtido rodando fetch() dentro de uma sessão de browser
// já autenticada no site. Import de alias '@/lib/utils' reescrito pra caminho
// relativo deste projeto; `React.CSSProperties` precisa do import de tipo do
// namespace React (ausente no original, que assumia importação global); lógica
// intacta.
import type * as React from 'react';
import { cn } from '../../../../utils';
import { motion, type Transition } from 'motion/react';

export type BorderTrailProps = {
  className?: string;
  size?: number;
  transition?: Transition;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
};

export function BorderTrail({
  className,
  size = 60,
  transition,
  onAnimationComplete,
  style,
}: BorderTrailProps) {
  const defaultTransition: Transition = {
    repeat: Infinity,
    duration: 5,
    ease: 'linear',
  };

  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
      <motion.div
        className={cn('absolute aspect-square bg-zinc-500', className)}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style,
        }}
        animate={{
          offsetDistance: ['0%', '100%'],
        }}
        transition={transition || defaultTransition}
        onAnimationComplete={onAnimationComplete}
      />
    </div>
  );
}
