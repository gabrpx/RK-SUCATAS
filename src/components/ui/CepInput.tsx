import * as React from 'react';
import { Input } from './Input';

interface CepAutoFill {
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
}

interface CepInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: string;
  onChange: (digits: string) => void;
  onAutoFill?: (data: CepAutoFill) => void;
}

function fmtCep(d: string) {
  const clean = d.replace(/\D/g, '').slice(0, 8);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

export function CepInput({ value, onChange, onAutoFill, ...rest }: CepInputProps) {
  const [loading, setLoading] = React.useState(false);
  const lastQueried = React.useRef<string>('');

  React.useEffect(() => {
    if (!onAutoFill) return;
    if (value.length !== 8) return;
    if (lastQueried.current === value) return;
    lastQueried.current = value;
    setLoading(true);
    fetch(`https://viacep.com.br/ws/${value}/json/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        if (json.erro) return;
        onAutoFill({
          estado: json.uf ?? '',
          cidade: json.localidade ?? '',
          bairro: json.bairro ?? '',
          rua: json.logradouro ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [value, onAutoFill]);

  return (
    <Input
      {...rest}
      inputMode="numeric"
      state={loading ? 'loading' : rest.state}
      value={fmtCep(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
    />
  );
}
