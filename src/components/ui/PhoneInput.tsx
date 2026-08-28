import * as React from 'react';
import { Input } from './Input';
import { formatPhoneBr, stripPhone } from './masks/phone-br';

type BaseProps = React.ComponentProps<typeof Input>;
interface PhoneInputProps extends Omit<BaseProps, 'value' | 'onChange'> {
  value: string;
  onChange: (digits: string) => void;
}

export function PhoneInput({ value, onChange, inputMode, ...rest }: PhoneInputProps) {
  return (
    <Input
      {...rest}
      inputMode={inputMode ?? 'tel'}
      value={formatPhoneBr(value)}
      onChange={(e) => onChange(stripPhone(e.target.value))}
    />
  );
}
