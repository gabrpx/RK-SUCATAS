import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET, SPRING_MICRO } from './motion';

interface SelectOption { value: string; label: string }
interface SelectProps {
  label?: string; helper?: string; error?: string; placeholder?: string;
  options: SelectOption[];
  value: string; onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg' | 'mobile';
}

const heights = { sm: 'h-8', md: 'h-9', lg: 'h-11', mobile: 'h-11' } as const;

export function Select({ label, helper, error, placeholder, options, value, onChange, size = 'md' }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();
  const hlId = React.useRef(`sel-hl-${Math.random().toString(36).slice(2)}`).current;

  React.useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const current = options.find((o) => o.value === value);
  const highlight = hover ?? value;

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && <label id={uid} className="text-xs font-medium text-text-secondary">{label}</label>}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? uid : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between rounded-control border bg-surface-inset px-3 text-sm text-text-primary transition-colors',
          heights[size],
          error ? 'border-danger' : open ? 'border-accent' : 'border-border-default'
        )}
      >
        <span className={cn(!current && 'text-text-faint')}>{current?.label ?? placeholder ?? 'Selecione…'}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING_MICRO}>
          <ChevronDown size={14} className="text-text-muted" />
        </motion.span>
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
            className="absolute mt-14 min-w-[180px] max-h-60 overflow-y-auto rounded-modal border border-border-default bg-surface-raised/95 backdrop-blur-xl shadow-elevation-3 py-2"
            onMouseLeave={() => setHover(null)}
          >
            {options.map((o) => {
              const active = o.value === value;
              const hi = highlight === o.value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHover(o.value)}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cn(
                    'relative flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                    active ? 'text-accent font-medium' : 'text-text-secondary'
                  )}
                >
                  {hi && (
                    <motion.span
                      layoutId={hlId}
                      transition={SPRING_MICRO}
                      className={cn('absolute inset-x-1 inset-y-0.5 rounded-md -z-0', active ? 'bg-accent/10' : 'bg-surface-inset')}
                    />
                  )}
                  <span className="relative z-10">{o.label}</span>
                  {active && <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-accent" />}
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
