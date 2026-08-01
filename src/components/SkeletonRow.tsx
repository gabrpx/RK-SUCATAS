import React, { memo } from 'react';
import { cn } from '../utils';

// SkeletonRow: linha de loading animada pra tabela de Estoque. Colunas batem
// com EstoqueView.tsx (checkbox, Peça com miniatura+código, Categoria, Moto,
// Condição, Valor, Qtd, Ações) pra não pular o layout quando os dados chegam.
interface SkeletonRowProps {
  theme: 'light' | 'dark';
}

export const SkeletonRow = memo(({ theme }: SkeletonRowProps) => {
  const bar = theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200';
  return (
    <tr className="animate-pulse transform-gpu">
      <td className="px-3 py-2.5">
        <div className={cn('w-4 h-4 rounded', bar)} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-lg shrink-0', bar)} />
          <div className="space-y-1.5">
            <div className={cn('h-3 rounded w-28', bar)} />
            <div className={cn('h-2.5 rounded w-14', bar)} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className={cn('h-5 rounded-lg w-20', bar)} />
      </td>
      <td className="px-3 py-2.5">
        <div className={cn('h-5 rounded-lg w-24', bar)} />
      </td>
      <td className="px-3 py-2.5">
        <div className={cn('h-5 rounded-lg w-16', bar)} />
      </td>
      <td className="px-3 py-2.5">
        <div className={cn('h-3 rounded w-14 ml-auto', bar)} />
      </td>
      <td className="px-3 py-2.5">
        <div className={cn('h-3 rounded w-8 ml-auto', bar)} />
      </td>
      <td className="px-3 py-2.5">
        <div className={cn('h-7 w-16 rounded-lg ml-auto', bar)} />
      </td>
    </tr>
  );
});

SkeletonRow.displayName = 'SkeletonRow';
