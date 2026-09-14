import * as React from 'react';
import { cn } from '@/src/utils';

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-badge bg-surface-raised',
        shimmer && 'animate-shimmer',
        className
      )}
    />
  );
}
