import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_MICRO } from './motion';

export interface SelectOption { value: string; label: string }
interface SelectProps {
  label?: string; helper?: string; error?: string; placeholder?: string;
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  options: SelectOption[];
  value: string; onChange: (value: string) => void;
  renderOption?: (option: SelectOption, state: { selected: boolean; highlighted: boolean }) => React.ReactNode;
  renderValue?: (option: SelectOption) => React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'mobile';
}

const heights = { sm: 'h-8', md: 'h-9', lg: 'h-11', mobile: 'h-11' } as const;

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select({ label, helper, error, placeholder, ariaLabel, id, disabled = false, className, triggerClassName, options, value, onChange, renderOption, renderValue, size = 'md' }, forwardedRef) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const labelId = React.useId();
  const valueId = React.useId();
  const listboxId = React.useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;
  const current = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  React.useImperativeHandle(forwardedRef, () => triggerRef.current as HTMLButtonElement);

  React.useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const show = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (disabled) return;
    setActiveIndex(options.length ? Math.max(0, Math.min(index, options.length - 1)) : -1);
    setOpen(true);
  };

  const choose = (option: SelectOption) => {
    if (disabled) return;
    onChange(option.value);
    setActiveIndex(options.findIndex((item) => item.value === option.value));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (!options.length) return;
      if (!open) {
        show(selectedIndex >= 0 ? selectedIndex : (event.key === 'ArrowDown' ? 0 : options.length - 1));
        return;
      }
      const start = activeIndex >= 0 ? activeIndex : selectedIndex;
      const next = start < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) :
        (start + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setActiveIndex(next);
      return;
    }
    if ((event.key === 'Home' || event.key === 'End') && open && options.length) {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (!open) show();
      else if (activeOption) choose(activeOption);
    }
  };

  return (
    <div className={cn('relative flex min-w-0 flex-col gap-1.5', className)} ref={rootRef}>
      {label && <label id={labelId} className="text-xs font-medium text-text-secondary">{label}</label>}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={label ? undefined : ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : show()}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between rounded-control border bg-surface-inset px-3 text-sm text-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          heights[size],
          error ? 'border-danger' : open ? 'border-accent' : 'border-border-default',
          triggerClassName,
        )}
      >
        <span id={valueId} className={cn('flex min-w-0 flex-1 items-center gap-2 text-left', !current && 'text-text-faint')}>
          {current ? renderValue?.(current) ?? current.label : placeholder ?? 'Selecione…'}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING_MICRO}>
          <ChevronDown size={14} className="text-text-muted" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={listboxId}
            role="listbox"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.12 }}
            style={{ transformOrigin: 'top', zIndex: 'var(--z-dropdown)' as unknown as number }}
            className="absolute left-0 top-full mt-1 w-full min-w-[180px] max-w-[min(22rem,calc(100vw-2rem))] max-h-60 overflow-y-auto rounded-modal border border-border-default bg-surface-raised/95 py-1 shadow-elevation-3 backdrop-blur-xl"
            onMouseLeave={() => setActiveIndex(-1)}
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              const highlighted = index === activeIndex;
              return (
                <li
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    'relative flex min-h-10 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors',
                    highlighted && 'bg-surface-inset',
                    selected ? 'font-medium text-accent' : 'text-text-secondary'
                  )}
                >
                  <span className="relative z-10 min-w-0">{renderOption ? renderOption(option, { selected, highlighted }) : option.label}</span>
                  {selected && <span aria-hidden="true" className="relative z-10 size-1.5 shrink-0 rounded-full bg-accent" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      {(helper || error) && <p className={cn('text-2xs', error ? 'text-danger' : 'text-text-faint')}>{error ?? helper}</p>}
    </div>
  );
});

Select.displayName = 'Select';
