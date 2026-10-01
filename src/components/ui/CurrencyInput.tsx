import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from './Input';
import { formatBrl, parseBrl } from './masks/brl';

type BaseProps = React.ComponentProps<typeof Input>;
interface CurrencyInputProps extends Omit<BaseProps, 'value' | 'onChange'> {
  value: number | null;
  onChange: (cents: number | null) => void;
  showStepper?: boolean;
  stepCents?: number;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput({
  value, onChange, showStepper, stepCents = 100, inputMode, iconRight, onBlur, className, ...rest
}, ref) {
  const [draft, setDraft] = React.useState(() => value == null ? '' : formatBrl(value).replace(/^R\$\s*/, ''));
  const editing = React.useRef(false);
  React.useEffect(() => {
    if (!editing.current) setDraft(value == null ? '' : formatBrl(value).replace(/^R\$\s*/, ''));
  }, [value]);
  const stepper = showStepper ? (
    <span className="flex gap-1">
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => onChange(Math.max(0, (value ?? 0) - stepCents))}
        className="p-1 text-text-muted hover:text-text-primary"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange((value ?? 0) + stepCents)}
        className="p-1 text-text-muted hover:text-text-primary"
      >
        <Plus size={14} />
      </button>
    </span>
  ) : null;

  return (
    <Input
      {...rest}
      ref={ref}
      inputMode={inputMode ?? 'decimal'}
      className={`min-w-0 ${className ?? ''}`}
      iconLeft={<span aria-hidden="true" className="whitespace-nowrap font-semibold text-text-secondary">R$</span>}
      value={draft}
      onFocus={() => { editing.current = true; }}
      onChange={(e) => {
        const text = e.target.value.replace(/[^\d,.]/g, '');
        setDraft(text);
        onChange(/\d/.test(text) ? parseBrl(text) : null);
      }}
      onBlur={(event) => {
        editing.current = false;
        setDraft(value == null ? '' : formatBrl(value).replace(/^R\$\s*/, ''));
        onBlur?.(event);
      }}
      iconRight={stepper ?? iconRight}
    />
  );
});
