import * as React from 'react';
import { Input } from './Input';

interface TimePickerProps {
  label?: string; helper?: string; error?: string;
  value: string;
  onChange: (v: string) => void;
}

function fmt(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function TimePicker({ value, onChange, ...rest }: TimePickerProps) {
  return (
    <Input
      {...rest}
      inputMode="numeric"
      value={fmt(value)}
      onChange={(e) => onChange(fmt(e.target.value))}
      placeholder="HH:mm"
    />
  );
}
