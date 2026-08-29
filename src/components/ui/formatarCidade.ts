import type { CityValue } from './StateCitySelect';

export function formatarCidade(v: CityValue): string {
  if (!v.cidade) return '';
  if (v.estado) return `${v.cidade}, ${v.estado}`;
  return v.cidade;
}
