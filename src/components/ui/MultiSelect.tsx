import * as React from 'react';
import { X, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';

interface Opt { value: string; label: string }
interface MultiSelectProps {
  label?: string; helper?: string; error?: string; placeholder?: string;
  options: Opt[];
  value: string[]; onChange: (values: string[]) => void;
}

export function MultiSelect({ label, helper, error, placeholder, options, value, onChange }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();

  React.useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <div className="relative flex flex-col gap-1.5" ref={ref}>
      {label && <label id={uid} className="text-xs font-medium text-text-secondary">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'min-h-9 rounded-control border bg-surface-inset px-2 py-1 flex flex-wrap items-center gap-1 text-left transition-colors',
          error ? 'border-danger' : open ? 'border-accent' : 'border-border-default'
        )}
      >
        {value.length === 0 ? (
          <span className="text-sm text-text-faint px-1">{placeholder ?? 'Selecione…'}</span>
        ) : (
          value.map((v) => {
            const o = options.find((x) => x.value === v);
            if (!o) return null;
            return (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-badge bg-accent-soft-bg text-accent-soft-fg text-xs">
                {o.label}
                <button
                  type="button"
                  aria-label={`Remover ${o.label}`}
                  onClick={(e) => { e.stopPropagation(); toggle(v); }}
                  className="hover:text-danger"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })
        )}
        <ChevronDown size={14} className="ml-auto text-text-muted shrink-0" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={SPRING_SHEET}
            style={{ transformOrigin: 'top', zIndex: 'var(--z-dropdown)' as unknown as number }}
            className="absolute mt-14 max-h-60 overflow-y-auto rounded-modal border border-border-default bg-surface-raised/95 backdrop-blur-xl shadow-elevation-3 py-1 min-w-[200px]"
          >
            {options.map((o) => {
              const active = value.includes(o.value);
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  onClick={() => toggle(o.value)}
                  className={cn('px-3 py-2 text-sm cursor-pointer hover:bg-surface-inset', active ? 'text-accent' : 'text-text-secondary')}
                >
                  {o.label}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      {(helper || error) && <p className={cn('text-2xs', error ? 'text-danger' : 'text-text-faint')}>{error ?? helper}</p>}
    </div>
  );
}
