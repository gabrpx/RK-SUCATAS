import * as React from 'react';
import { cn } from '@/src/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
  autoResize?: boolean;
  showCount?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, autoResize, showCount, id, className, defaultValue, value, onChange, maxLength, ...rest },
  ref
) {
  const uid = React.useId();
  const inputId = id ?? uid;
  const [internal, setInternal] = React.useState((defaultValue as string) ?? '');
  const controlled = value !== undefined;
  const current = controlled ? (value as string) : internal;
  const localRef = React.useRef<HTMLTextAreaElement | null>(null);
  React.useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

  const handle = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!controlled) setInternal(e.target.value);
    if (autoResize && localRef.current) {
      localRef.current.style.height = 'auto';
      localRef.current.style.height = localRef.current.scrollHeight + 'px';
    }
    onChange?.(e);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        ref={localRef}
        id={inputId}
        value={controlled ? (value as string) : undefined}
        defaultValue={!controlled ? (defaultValue as string) : undefined}
        onChange={handle}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full min-h-[80px] rounded-control border bg-surface-inset px-3 py-2 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors',
          error ? 'border-danger' : 'border-border-default focus-within:border-accent',
          className
        )}
        {...rest}
      />
      <div className="flex justify-between text-2xs">
        <span className={error ? 'text-danger' : 'text-text-faint'}>{error ?? helper ?? ''}</span>
        {showCount && (
          <span className="text-text-faint">
            {current.length} {maxLength ? `/ ${maxLength}` : ''}
          </span>
        )}
      </div>
    </div>
  );
});
