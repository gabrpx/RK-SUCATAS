// DataTable: tabela genérica orientada a `colunas`, no estilo já usado nas
// telas de Estoque/Vendas, mas padronizada com os tokens do design system.
import type React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils';

export interface DataTableColumn<T> {
  /** Chave única da coluna (usada como React key, não precisa bater com uma prop de T) */
  key: string;
  /** Aceita ReactNode (não só string) pra permitir cabeçalho clicável de ordenação */
  header: React.ReactNode;
  /** Renderiza o conteúdo da célula a partir da linha */
  render: (item: T) => React.ReactNode;
  /** Alinhamento do conteúdo — colunas numéricas normalmente usam 'right' */
  align?: 'left' | 'center' | 'right';
  /** Largura opcional (ex: '4rem') pra colunas de ícone/checkbox */
  width?: string;
}

export interface DataTableProps<T> {
  colunas: DataTableColumn<T>[];
  dados: T[];
  /** Extrai a key de linha do React a partir do item — evita depender de `index` */
  getRowKey: (item: T) => string | number;
  /**
   * Marca uma linha como "em alerta" (ex: estoque baixo, prazo vencido) com
   * uma borda esquerda de destaque em vez de precisar de uma coluna extra
   * só pra sinalizar isso.
   */
  destaqueLinha?: (item: T) => boolean;
  /** Quando informado, a linha inteira vira clicável (cursor-pointer + hover) */
  onRowClick?: (item: T) => void;
  emptyState?: React.ReactNode;

  /**
   * Card empilhado pra telas abaixo de `md`, onde a tabela só rolaria
   * horizontalmente. Quando ausente, mantém a tabela em qualquer largura
   * (comportamento anterior, sem fallback).
   */
  renderMobileCard?: (item: T) => React.ReactNode;

  // Paginação real: o componente não faz slice sozinho porque quem busca os
  // dados (API ou memo local) já deveria entregar só a página atual — isso
  // evita reprocessar/ordenar N itens no cliente à toa.
  paginaAtual: number;
  totalPaginas: number;
  onMudarPagina: (pagina: number) => void;
}

export function DataTable<T>({
  colunas,
  dados,
  getRowKey,
  destaqueLinha,
  onRowClick,
  emptyState,
  renderMobileCard,
  paginaAtual,
  totalPaginas,
  onMudarPagina,
}: DataTableProps<T>) {
  const alignClass = (align: DataTableColumn<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="bg-surface-card border border-border-subtle rounded-card overflow-hidden">
      <div className={cn('overflow-x-auto', renderMobileCard && 'hidden md:block')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default">
              {colunas.map((coluna) => (
                <th
                  key={coluna.key}
                  style={{ width: coluna.width }}
                  className={cn(
                    'px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted',
                    alignClass(coluna.align)
                  )}
                >
                  {coluna.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.length === 0 ? (
              <tr>
                <td colSpan={colunas.length} className="p-0">
                  {emptyState}
                </td>
              </tr>
            ) : (
              dados.map((item) => {
                const emAlerta = destaqueLinha?.(item) ?? false;
                return (
                  <tr
                    key={getRowKey(item)}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    className={cn(
                      'border-b border-border-subtle last:border-b-0',
                      // Borda de 2px só aparece quando a linha está em alerta; do
                      // contrário fica transparente pra não desalinhar o padding
                      emAlerta ? 'border-l-2 border-l-warning' : 'border-l-2 border-l-transparent',
                      onRowClick && 'cursor-pointer hover:bg-surface-raised'
                    )}
                  >
                    {colunas.map((coluna) => (
                      <td key={coluna.key} className={cn('px-3 py-2.5 text-text-secondary', alignClass(coluna.align))}>
                        {coluna.render(item)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {renderMobileCard && (
        <div className="md:hidden">
          {dados.length === 0 ? (
            emptyState
          ) : (
            <div className="divide-y divide-border-subtle">
              {dados.map((item) => {
                const emAlerta = destaqueLinha?.(item) ?? false;
                return (
                  <div
                    key={getRowKey(item)}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    className={cn(
                      'border-l-2 px-3 py-3',
                      emAlerta ? 'border-l-warning' : 'border-l-transparent',
                      onRowClick && 'cursor-pointer hover:bg-surface-raised'
                    )}
                  >
                    {renderMobileCard(item)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-border-subtle">
          <span className="text-xs text-text-faint">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMudarPagina(Math.max(1, paginaAtual - 1))}
              disabled={paginaAtual === 1}
              className="size-7 flex items-center justify-center rounded-control border border-border-default text-text-secondary disabled:opacity-30 hover:bg-surface-raised"
              aria-label="Página anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => onMudarPagina(Math.min(totalPaginas, paginaAtual + 1))}
              disabled={paginaAtual === totalPaginas}
              className="size-7 flex items-center justify-center rounded-control border border-border-default text-text-secondary disabled:opacity-30 hover:bg-surface-raised"
              aria-label="Próxima página"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
