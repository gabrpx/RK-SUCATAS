import { useEffect, useState } from 'react';

export type MotionTier = 'reduced' | 'low' | 'standard' | 'showcase';

function compute(): MotionTier {
  if (typeof window === 'undefined') return 'standard';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 4) return 'low';
  if (mem === undefined) return 'standard'; // sem deviceMemory API (Firefox/Safari) → meio-termo seguro
  return 'showcase';
}

export function useMotionTier(): MotionTier {
  const [tier, setTier] = useState<MotionTier>(() => compute());

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setTier(compute());
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return tier;
}
