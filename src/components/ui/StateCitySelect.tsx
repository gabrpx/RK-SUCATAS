import * as React from 'react';
import { Select } from './Select';
import { Combobox } from './Combobox';
import { useUFs, useCidades } from './hooks/useIBGE';

export interface CityValue { estado: string; cidade: string }

interface StateCitySelectProps {
  value: CityValue;
  onChange: (v: CityValue) => void;
  labelEstado?: string;
  labelCidade?: string;
  error?: { estado?: string; cidade?: string };
}

export function StateCitySelect({
  value, onChange, labelEstado = 'Estado', labelCidade = 'Cidade', error,
}: StateCitySelectProps) {
  const ufs = useUFs();
  const { data: cidades, loading } = useCidades(value.estado);

  // O label é renderizado aqui fora, não repassado como prop `label` para
  // <Select>/<Combobox>: aquele prop liga aria-labelledby ao texto do campo
  // ("Estado"/"Cidade"), o que sobrescreveria o nome acessível do botão e
  // esconderia o valor selecionado (ex: "Paraíba") de getByRole(name: ...).
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">{labelEstado}</span>
        <Select
          options={ufs.map((u) => ({ value: u.sigla, label: u.nome }))}
          value={value.estado}
          onChange={(estado) => onChange({ estado, cidade: '' })}
          placeholder="UF"
          error={error?.estado}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">{labelCidade}</span>
        <Combobox
          options={cidades.map((c) => ({ value: c, label: c }))}
          value={value.cidade}
          onChange={(cidade) => onChange({ estado: value.estado, cidade })}
          placeholder={loading ? 'Carregando…' : value.estado ? 'Selecione cidade' : 'Escolha uma UF primeiro'}
          error={error?.cidade}
        />
      </div>
    </div>
  );
}
