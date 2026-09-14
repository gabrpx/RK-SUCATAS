// Máscara de moeda pt-BR pro preço da unidade: dígitos preenchem da direita
// pra esquerda (estilo "digitar centavos"), igual formatCurrencyInput de
// src/utils/formatters.ts. Reaproveita a máscara/parse de lá — valor emitido
// pra fora é sempre em REAIS (não centavos), diferente de src/components/ui/CurrencyInput.tsx.
import { useEffect, useState, type ComponentPropsWithoutRef } from 'react';
import { formatCurrencyInput, parseCurrencyInput } from '../../../utils/formatters';
import { cn } from '../../../utils';

interface CurrencyInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange' | 'type'> {
  value: number | null;
  onChange: (reais: number | null) => void;
}

// Controlado por dígitos digitados, não pelo valor formatado — assim o
// cursor não pula no meio da digitação (padrão comum de máscara "centavos").
// `value` externo só re-sincroniza o display quando muda por fora (edição
// carregando um registro, reset do form etc), não a cada re-render.
export function CurrencyInput({ value, onChange, className, ...rest }: CurrencyInputProps) {
  const [digits, setDigits] = useState(() => (value === null || value === undefined ? '' : String(Math.round(value * 100))));

  useEffect(() => {
    setDigits(value === null || value === undefined ? '' : String(Math.round(value * 100)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const display = digits ? formatCurrencyInput(digits) : '';

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const novosDigitos = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        setDigits(novosDigitos);
        onChange(novosDigitos ? parseCurrencyInput(novosDigitos) : null);
      }}
      className={cn(
        'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-accent text-text-primary placeholder:text-text-faint',
        className
      )}
      {...rest}
    />
  );
}
