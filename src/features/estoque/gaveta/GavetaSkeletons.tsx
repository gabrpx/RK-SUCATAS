// Skeletons de carregamento (T09, docs/mockups/T09-skeleton-loading.png): só a
// área de dados é substituída por shimmer — header ("Estoque" + "+ Nova
// Gaveta") e busca continuam reais, então esses skeletons cobrem apenas
// StatsRow + FilterChips + linhas de gaveta (GavetaListSkeleton), ou o bloco
// de VarianteCard (GavetaDetailSkeleton). Reusa o componente Skeleton
// existente (src/components/ui/Skeleton.tsx) — não reinventa shimmer.
import { Skeleton } from '../../../components/ui/Skeleton';

function GavetaRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-3">
      <Skeleton shimmer className="flex-none size-11 rounded-control" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton shimmer className="h-3.5 w-2/3 rounded-badge" />
        <Skeleton shimmer className="h-3 w-1/3 rounded-badge" />
      </div>
    </div>
  );
}

/** Skeleton da GavetaList (T01) enquanto `useGavetas` está `isLoading`. */
export function GavetaListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando gavetas">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton shimmer className="flex-none min-w-[104px] h-[60px] rounded-card" />
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton shimmer className="flex-none h-9 w-20 rounded-pill" />
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <GavetaRowSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton da GavetaDetail (T02) enquanto `useGavetas` está `isLoading`. */
export function GavetaDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando gaveta">
      <div className="flex flex-col gap-2">
        <Skeleton shimmer className="h-6 w-1/2 rounded-badge" />
        <Skeleton shimmer className="h-3 w-2/3 rounded-badge" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton shimmer className="h-20 w-full rounded-card" />
          </div>
        ))}
      </div>
    </div>
  );
}
