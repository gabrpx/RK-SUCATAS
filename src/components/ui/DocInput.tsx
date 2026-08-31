import * as React from 'react';
import { Input } from './Input';
import { formatCpf, isValidCpf, stripCpf } from './masks/cpf';
import { formatCnpj, isValidCnpj, stripCnpj } from './masks/cnpj';

type BaseProps = React.ComponentProps<typeof Input>;
interface DocInputProps extends Omit<BaseProps, 'value' | 'onChange'> {
  value: string;
  onChange: (digits: string) => void;
  onValidityChange?: (valid: boolean, kind: 'cpf' | 'cnpj' | 'unknown') => void;
}

export function DocInput({ value, onChange, onValidityChange, inputMode, ...rest }: DocInputProps) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  const isCnpj = digits.length > 11;
  const formatted = isCnpj ? formatCnpj(digits) : formatCpf(digits);

  React.useEffect(() => {
    if (!onValidityChange) return;
    if (digits.length === 11) onValidityChange(isValidCpf(digits), 'cpf');
    else if (digits.length === 14) onValidityChange(isValidCnpj(digits), 'cnpj');
    else onValidityChange(false, 'unknown');
  }, [digits, onValidityChange]);

  return (
    <Input
      {...rest}
      inputMode={inputMode ?? 'numeric'}
      value={formatted}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
        onChange(raw);
      }}
    />
  );
}
