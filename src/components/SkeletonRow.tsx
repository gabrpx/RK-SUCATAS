import React, { memo } from 'react';
import { cn } from '../utils';

// SkeletonRow: linha de loading animada para tabelas
// theme: controla cores do skeleton no dark/light mode
interface SkeletonRowProps {
  theme: 'light' | 'dark';
}

export const SkeletonRow = memo(({ theme }: SkeletonRowProps) => (
  <tr className="animate-pulse transform-gpu">
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-16", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-48", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-32", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-24", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
    <td className="px-6 py-4"><div className={cn("h-4 rounded w-20", theme === 'dark' ? "bg-zinc-800" : "bg-zinc-200")}></div></td>
  </tr>
));

SkeletonRow.displayName = 'SkeletonRow';

