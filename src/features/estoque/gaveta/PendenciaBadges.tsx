// Exibição das pendências (T02). Regra de design do projeto: nunca depender só
// de cor — todo chip carrega ícone E texto ("2 sem foto"). Componentes puros
// de apresentação; a lógica mora em pendenciasGaveta.ts.
import { AlertTriangle, FileWarning, FolderInput, History, ImageOff, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Key } from 'react';
import { cn } from '../../../utils';
import {
  ORDEM_PENDENCIAS,
  nomePendencia,
  pendenciasDaVariante,
  resumirPendenciasEstoque,
  rotuloPendencia,
  type PendenciaGaveta,
} from './pendenciasGaveta';
import type { Estoque } from '../types';

const ICONE: Record<PendenciaGaveta, LucideIcon> = {
  sem_gaveta: FolderInput,
  ficha_pendente: FileWarning,
  sem_preco: Tag,
  com_avaria: AlertTriangle,
  sem_foto: ImageOff,
  foto_legada: History,
};

// foto_legada é informativo (não é um problema a resolver com urgência), então
// usa tom neutro; o resto usa o tom de aviso (warning) reservado a pendência.
const TOM: Record<PendenciaGaveta, string> = {
  sem_gaveta: 'bg-warning-bg text-warning',
  ficha_pendente: 'bg-warning-bg text-warning',
  sem_preco: 'bg-warning-bg text-warning',
  com_avaria: 'bg-warning-bg text-warning',
  sem_foto: 'bg-warning-bg text-warning',
  foto_legada: 'bg-surface-inset text-text-muted',
};

function Chip({
  tipo,
  quantidade,
  className,
}: {
  key?: Key;
  tipo: PendenciaGaveta;
  /** número mostrado; null = só o nome do tipo (chips de variante). */
  quantidade: number | null;
  className?: string;
}) {
  const Icone = ICONE[tipo];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap',
        TOM[tipo],
        className,
      )}
    >
      <Icone size={11} aria-hidden />
      {quantidade === null ? nomePendencia(tipo) : rotuloPendencia(tipo, quantidade)}
    </span>
  );
}

/**
 * Chips agregados de uma lista de peças (usado na linha da gaveta e no
 * cabeçalho do detalhe). Mostra até `maxChips` tipos; o resto vira "+N".
 */
export function ResumoPendenciasChips({
  itens,
  maxChips = 3,
  className,
}: {
  itens: Estoque[];
  maxChips?: number;
  className?: string;
}) {
  const resumo = resumirPendenciasEstoque(itens);
  if (resumo.total === 0) return null;

  const presentes = ORDEM_PENDENCIAS.filter((tipo) => resumo.porTipo[tipo] > 0);
  const visiveis = presentes.slice(0, maxChips);
  const ocultos = presentes.length - visiveis.length;

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {visiveis.map((tipo) => (
        <Chip key={tipo} tipo={tipo} quantidade={resumo.porTipo[tipo]} />
      ))}
      {ocultos > 0 && (
        <span className="text-[10px] font-semibold text-text-muted">+{ocultos}</span>
      )}
    </span>
  );
}

/**
 * Chips dos TIPOS de pendência de uma variante (sem contagem — a variante é
 * uma peça só; o número aparece nas unidades). Ordem estável.
 */
export function PendenciaVarianteChips({ item, className }: { item: Estoque; className?: string }) {
  const tipos = pendenciasDaVariante(item);
  if (tipos.length === 0) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {tipos.map((tipo) => (
        <Chip key={tipo} tipo={tipo} quantidade={null} />
      ))}
    </span>
  );
}

export { Chip as PendenciaChip };
