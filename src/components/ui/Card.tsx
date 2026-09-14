import * as React from 'react';
import { cn } from '@/src/utils';
import { BorderTrail } from '../animate-ui/primitives/effects/border-trail';
import { useMotionTier } from './hooks/useMotionTier';

// `type` (intersection) em vez de `interface extends React.HTMLAttributes<...>`:
// com este projeto sem @types/react instalado, `interface X extends
// React.HTMLAttributes<HTMLDivElement>` silenciosamente perde os membros
// herdados (className/children etc. "não existem" em X) enquanto a forma
// de interseção resolve normalmente. Estrutural e funcionalmente equivalente
// para quem consome `CardProps`.
export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'highlight';
};

export function Card({ variant = 'default', className, children, ...rest }: CardProps) {
  const tier = useMotionTier();
  const showTrail = tier !== 'reduced' && tier !== 'low';

  return (
    <div
      className={cn(
        'relative rounded-card border border-border-default bg-surface-card p-4 shadow-elevation-1',
        variant === 'highlight' && 'shadow-glow-accent',
        className
      )}
      {...rest}
    >
      {variant === 'highlight' && showTrail && <BorderTrail />}
      {children}
    </div>
  );
}
