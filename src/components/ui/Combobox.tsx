import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';

interface ComboboxOption { value: string; label: string }
interface ComboboxProps {
  label?: string; helper?: string; error?: string; placeholder?: string;
  options: ComboboxOption[];
  value: string; onChange: (value: string) => void;
  virtualizeThreshold?: number;
}

const WINDOW = 60;  // itens renderizados por vez quando threshold estourado

export function Combobox({ label, helper, error, placeholder, options, value, onChange, virtualizeThreshold = 100 }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [visible, setVisible] = React.useState(WINDOW);
  const ref = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();

  React.useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const shouldVirtualize = filtered.length > virtualizeThreshold;
  const shown = shouldVirtualize ? filtered.slice(0, visible) : filtered;

  const current = options.find((o) => o.value === value);

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
          'flex items-center justify-between h-9 rounded-control border bg-surface-inset px-3 text-sm text-text-primary transition-colors',
          error ? 'border-danger' : open ? 'border-accent' : 'border-border-default'
        )}
      >
        <span className={cn(!current && 'text-text-faint')}>{current?.label ?? placeholder ?? 'Selecione…'}</span>
        <ChevronDown size={14} className="text-text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={SPRING_SHEET}
            style={{ transformOrigin: 'top', zIndex: 'var(--z-dropdown)' as unknown as number }}
            className="absolute mt-14 min-w-[220px] rounded-modal border border-border-default bg-surface-raised/95 backdrop-blur-xl shadow-elevation-3"
          >
            <input
              autoFocus
              placeholder="Buscar…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setVisible(WINDOW); }}
              className="w-full px-3 py-2 bg-transparent border-b border-border-subtle text-sm outline-none text-text-primary placeholder:text-text-faint"
            />
            <ul
              role="listbox"
              className="max-h-60 overflow-y-auto py-1"
              onScroll={(e) => {
                if (!shouldVirtualize) return;
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                  setVisible((v) => Math.min(v + WINDOW, filtered.length));
                }
              }}
            >
              {shown.map((o) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(''); setVisible(WINDOW); }}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer hover:bg-surface-inset',
                    o.value === value ? 'text-accent font-medium' : 'text-text-secondary'
                  )}
                >
                  {o.label}
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-text-faint">Sem resultados</li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      {(helper || error) && <p className={cn('text-2xs', error ? 'text-danger' : 'text-text-faint')}>{error ?? helper}</p>}
    </div>
  );
}
