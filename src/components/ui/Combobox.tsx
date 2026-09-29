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
  buttonRef?: React.Ref<HTMLButtonElement>;
  disabled?: boolean;
  virtualizeThreshold?: number;
  renderOption?: (option: ComboboxOption, selected: boolean) => React.ReactNode;
  renderValue?: (option: ComboboxOption) => React.ReactNode;
  /** `lg` = alvo de toque de 44 px e texto de 16 px no mobile (formulários operacionais). */
  size?: 'md' | 'lg';
}

const WINDOW = 60;  // itens renderizados por vez quando threshold estourado

export function Combobox({ label, helper, error, placeholder, options, value, onChange, buttonRef, disabled = false, virtualizeThreshold = 100, renderOption, renderValue, size = 'md' }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [visible, setVisible] = React.useState(WINDOW);
  const [active, setActive] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const labelId = React.useId();
  const valueId = React.useId();
  const listId = React.useId();

  const setTriggerRef = React.useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof buttonRef === 'function') buttonRef(node);
    else if (buttonRef) (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
  }, [buttonRef]);

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

  const close = React.useCallback((devolverFoco: boolean) => {
    setOpen(false);
    setQuery('');
    setVisible(WINDOW);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  const selectOption = (option: ComboboxOption) => {
    onChange(option.value);
    close(true);
  };

  const abrir = () => {
    const indiceAtual = options.findIndex((o) => o.value === value);
    setActive(indiceAtual >= 0 ? indiceAtual : 0);
    if (indiceAtual >= WINDOW) setVisible(indiceAtual + 1);
    setOpen(true);
  };

  // Escape em camadas: com a lista aberta dentro de um drawer/modal, a tecla
  // fecha SÓ a lista e devolve o foco ao campo. O listener fica em `window`
  // na fase de captura — antes do listener de Escape do Radix (document) —
  // e interrompe a propagação para que a camada de baixo continue aberta.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open, close]);

  React.useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, listId]);

  const mover = (delta: number) => {
    if (!filtered.length) return;
    setActive((atual) => {
      const proximo = Math.max(0, Math.min(filtered.length - 1, atual + delta));
      if (shouldVirtualize && proximo >= visible - 1) setVisible((v) => Math.min(v + WINDOW, filtered.length));
      return proximo;
    });
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); mover(8); }
    else if (e.key === 'PageUp') { e.preventDefault(); mover(-8); }
    else if (e.key === 'Home' && !query) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && !query) { e.preventDefault(); if (shouldVirtualize) setVisible(filtered.length); setActive(filtered.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const opcao = filtered[active]; if (opcao) selectOption(opcao); }
    else if (e.key === 'Tab') { close(false); }
  };

  const activeOption = open && filtered[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="relative flex flex-col gap-1.5" ref={ref}>
      {label && <label id={labelId} className={cn('text-text-secondary', size === 'lg' ? 'text-sm font-semibold' : 'text-xs font-medium')}>{label}</label>}
      <div className="relative">
        <button
          ref={setTriggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
          disabled={disabled}
          onClick={() => { if (disabled) return; if (open) close(false); else abrir(); }}
          onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); abrir(); } }}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between gap-2 rounded-control border bg-surface-inset px-3 text-left text-text-primary transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60',
            size === 'lg' ? 'min-h-11 text-base sm:text-sm' : 'h-9 text-sm',
            error ? 'border-danger' : open ? 'border-accent' : 'border-border-default'
          )}
        >
          <span id={valueId} className={cn('flex min-w-0 flex-1 items-center gap-2', !current && 'text-text-faint')}>
            {current ? renderValue?.(current) ?? <span className="truncate">{current.label}</span> : placeholder ?? 'Selecione…'}
          </span>
          <ChevronDown size={14} className={cn('shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={SPRING_SHEET}
              style={{ transformOrigin: 'top', zIndex: 'var(--z-dropdown)' as unknown as number }}
              className="absolute left-0 top-full mt-1 w-full min-w-[220px] rounded-modal border border-border-default bg-surface-raised/95 backdrop-blur-xl shadow-elevation-3"
            >
              <input
                autoFocus
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeOption}
                aria-label={label ? `Buscar em ${label}` : 'Buscar opção'}
                placeholder="Buscar…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setVisible(WINDOW); setActive(0); }}
                onKeyDown={onSearchKeyDown}
                className={cn('w-full px-3 py-2 bg-transparent border-b border-border-subtle outline-none text-text-primary placeholder:text-text-faint', size === 'lg' ? 'text-base sm:text-sm' : 'text-sm')}
              />
              <ul
                id={listId}
                role="listbox"
                className="no-scrollbar max-h-60 overflow-y-auto overscroll-contain py-1"
                onScroll={(e) => {
                  if (!shouldVirtualize) return;
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                    setVisible((v) => Math.min(v + WINDOW, filtered.length));
                  }
                }}
              >
                {shown.map((o, indice) => (
                  <li
                    key={o.value}
                    id={`${listId}-opt-${indice}`}
                    role="option"
                    aria-selected={o.value === value}
                    data-active={indice === active || undefined}
                    tabIndex={-1}
                    onMouseEnter={() => setActive(indice)}
                    onClick={() => selectOption(o)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOption(o); } }}
                    className={cn(
                      'cursor-pointer px-3 outline-none',
                      size === 'lg' ? 'py-2.5 text-base sm:text-sm' : 'py-2 text-sm',
                      indice === active && 'bg-surface-inset',
                      o.value === value ? 'text-accent font-medium' : 'text-text-secondary'
                    )}
                  >
                    {renderOption ? renderOption(o, o.value === value) : o.label}
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-text-faint">Sem resultados</li>
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {(helper || error) && <p className={cn('text-2xs', error ? 'text-danger' : 'text-text-faint')}>{error ?? helper}</p>}
    </div>
  );
}
