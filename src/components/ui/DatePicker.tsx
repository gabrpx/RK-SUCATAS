import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Calendar } from 'lucide-react';
import { Input } from './Input';

interface DatePickerProps {
  label?: string;
  helper?: string;
  error?: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
}

export function DatePicker({ label, helper, error, value, onChange }: DatePickerProps) {
  const [text, setText] = React.useState(value ? format(value, 'dd/MM/yyyy') : '');
  React.useEffect(() => {
    setText(value ? format(value, 'dd/MM/yyyy') : '');
  }, [value]);

  const commit = (t: string) => {
    if (!t) {
      onChange(null);
      return;
    }
    const parsed = parse(t, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) onChange(parsed);
  };

  return (
    <PopoverPrimitive.Root>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={label}
            helper={helper}
            error={error}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => commit(text)}
            iconRight={
              <PopoverPrimitive.Trigger asChild>
                <button type="button" aria-label="Abrir calendário" className="text-text-muted">
                  <Calendar size={16} />
                </button>
              </PopoverPrimitive.Trigger>
            }
          />
        </div>
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="rounded-modal border border-border-default bg-surface-raised p-2 shadow-elevation-3"
          style={{ zIndex: 'var(--z-dropdown)' as unknown as number }}
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={value ?? undefined}
            onSelect={(d) => {
              onChange(d ?? null);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
