import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/utils';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helper?: string;
  error?: string;
  state?: 'default' | 'error' | 'success' | 'loading';
  size?: 'sm' | 'md' | 'lg' | 'mobile';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}

const sizeClass: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'h-8 text-sm',
  md: 'h-9 text-sm',
  lg: 'h-11 text-base',
  mobile: 'h-11 text-base',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, state, size = 'md', iconLeft, iconRight, clearable, onClear, id, className, ...rest },
  ref
) {
  const uid = React.useId();
  const inputId = id ?? uid;
  const describedById = `${inputId}-desc`;
  const effectiveState = error ? 'error' : state ?? 'default';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div
        className={cn(
          'relative flex items-center rounded-control border bg-surface-inset transition-colors',
          effectiveState === 'error' && 'border-danger',
          effectiveState === 'success' && 'border-positive',
          effectiveState === 'default' && 'border-border-default focus-within:border-accent',
          effectiveState === 'loading' && 'border-border-default',
          sizeClass[size]
        )}
      >
        {iconLeft && <span className="pl-3 text-text-muted">{iconLeft}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={helper || error ? describedById : undefined}
          aria-invalid={effectiveState === 'error' || undefined}
          className={cn(
            'flex-1 bg-transparent px-3 outline-none text-text-primary placeholder:text-text-faint',
            iconLeft && 'pl-2',
            (iconRight || clearable) && 'pr-2',
            className
          )}
          {...rest}
        />
        {clearable && (rest.value ?? '').toString().length > 0 && (
          <button
            type="button"
            aria-label="Limpar"
            onClick={onClear}
            className="px-2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
        {iconRight && !clearable && <span className="pr-3 text-text-muted">{iconRight}</span>}
      </div>
      {(helper || error) && (
        <p
          id={describedById}
          className={cn(
            'text-2xs',
            error ? 'text-danger' : 'text-text-faint'
          )}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
});
