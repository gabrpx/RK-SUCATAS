// Tremor getYAxisDomain — vendorizado sem alteração (github.com/tremorlabs/tremor).
export const getYAxisDomain = (autoMinValue: boolean, minValue: number | undefined, maxValue: number | undefined) => {
  const minDomain = autoMinValue ? 'auto' : (minValue ?? 0);
  const maxDomain = maxValue ?? 'auto';
  return [minDomain, maxDomain];
};
