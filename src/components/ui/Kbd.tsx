import * as React from 'react';
import { cn } from '@/src/utils';

type KbdProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export function Kbd({ children, className, ...rest }: KbdProps) {
  return (
    <kbd
      {...rest}
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-badge border border-border-default bg-surface-inset text-2xs font-mono text-text-secondary',
        className
      )}
    >
      {children}
    </kbd>
  );
}
