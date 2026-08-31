// Tabs com indicator elástico: o fundo ativo "desliza" entre as abas via
// layoutId do Motion, em vez de aparecer/sumir seco. Uso simples e
// controlado (value/onChange) — o consumidor decide o estado.
import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../utils';
import { SPRING_MICRO } from './motion';

interface TabsProps<K extends string> {
  value: K;
  onChange: (v: K) => void;
  items: Array<{ key: K; label: string; content: React.ReactNode }>;
}

export function Tabs<K extends string>({ value, onChange, items }: TabsProps<K>) {
  const layoutId = React.useRef(`tabs-${Math.random().toString(36).slice(2)}`).current;
  return (
    <div>
      <div role="tablist" className="flex gap-1 p-1 rounded-control bg-surface-inset border border-border-subtle w-max">
        {items.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className={cn(
                'relative px-4 py-1.5 text-sm font-medium transition-colors',
                active ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={SPRING_MICRO}
                  className="absolute inset-0 rounded-control bg-surface-raised shadow-elevation-1 -z-0"
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        {items.find((t) => t.key === value)?.content}
      </div>
    </div>
  );
}
