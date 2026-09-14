import * as React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';
import { Kbd } from './Kbd';

interface CommandItem {
  key: string;
  label: string;
  hint?: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
}

function highlightMatch(label: string, q: string) {
  if (!q) return label;
  const i = label.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <span className="bg-accent-soft-bg text-accent-soft-fg">{label.slice(i, i + q.length)}</span>
      {label.slice(i + q.length)}
    </>
  );
}

export function CommandPalette({ open, onOpenChange, items, placeholder = 'Digite pra buscar…' }: CommandPaletteProps) {
  const [q, setQ] = React.useState('');
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => it.label.toLowerCase().includes(s));
  }, [items, q]);

  React.useEffect(() => { if (!open) setQ(''); }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-overlay-scrim backdrop-blur-sm" style={{ zIndex: 'var(--z-modal)' as unknown as number }} />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -10 }}
                transition={SPRING_SHEET}
                className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl rounded-modal border border-border-default bg-surface-raised shadow-elevation-4 overflow-hidden outline-none"
                style={{ zIndex: 'var(--z-modal)' as unknown as number }}
              >
                <VisuallyHidden.Root asChild><DialogPrimitive.Title>Command Palette</DialogPrimitive.Title></VisuallyHidden.Root>
                <VisuallyHidden.Root asChild><DialogPrimitive.Description>Busca global</DialogPrimitive.Description></VisuallyHidden.Root>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
                  <Search size={16} className="text-text-muted" />
                  <input
                    autoFocus
                    role="textbox"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filtered[0]) {
                        filtered[0].onSelect();
                        onOpenChange(false);
                      }
                    }}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
                  />
                </div>
                <ul className="max-h-80 overflow-y-auto py-2">
                  {filtered.length === 0 && <li className="px-4 py-6 text-sm text-text-faint text-center">Sem resultados</li>}
                  {filtered.map((it) => (
                    <li key={it.key}>
                      <button
                        className={cn('w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-surface-inset text-text-primary')}
                        onClick={() => { it.onSelect(); onOpenChange(false); }}
                      >
                        <span>{highlightMatch(it.label, q)}</span>
                        {it.shortcut && <span className="flex gap-1">{it.shortcut.split(' ').map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
