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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
      <Select
        label={labelEstado}
        options={ufs.map((u) => ({ value: u.sigla, label: u.nome }))}
        value={value.estado}
        onChange={(estado) => onChange({ estado, cidade: '' })}
        placeholder="UF"
        error={error?.estado}
      />
      <Combobox
        label={labelCidade}
        options={cidades.map((c) => ({ value: c, label: c }))}
        value={value.cidade}
        onChange={(cidade) => onChange({ estado: value.estado, cidade })}
        placeholder={loading ? 'Carregando…' : value.estado ? 'Selecione cidade' : 'Escolha uma UF primeiro'}
        error={error?.cidade}
      />
    </div>
  );
}
