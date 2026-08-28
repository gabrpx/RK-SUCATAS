import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from './Input';
import { formatBrl, parseBrl } from './masks/brl';

type BaseProps = React.ComponentProps<typeof Input>;
interface CurrencyInputProps extends Omit<BaseProps, 'value' | 'onChange'> {
  value: number;
  onChange: (cents: number) => void;
  showStepper?: boolean;
  stepCents?: number;
}

export function CurrencyInput({
  value, onChange, showStepper, stepCents = 100, inputMode, iconRight, ...rest
}: CurrencyInputProps) {
  const stepper = showStepper ? (
    <span className="flex gap-1">
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => onChange(Math.max(0, value - stepCents))}
        className="p-1 text-text-muted hover:text-text-primary"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(value + stepCents)}
        className="p-1 text-text-muted hover:text-text-primary"
      >
        <Plus size={14} />
      </button>
    </span>
  ) : null;

  return (
    <Input
      {...rest}
      inputMode={inputMode ?? 'decimal'}
      value={formatBrl(value)}
      onChange={(e) => onChange(parseBrl(e.target.value))}
      iconRight={stepper ?? iconRight}
    />
  );
}
