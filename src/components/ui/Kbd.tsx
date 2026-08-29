import * as React from 'react';
import { cn } from '@/src/utils';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-badge border border-border-default bg-surface-inset text-2xs font-mono text-text-secondary',
        className
      )}
    >
      {children}
    </kbd>
  );
}
