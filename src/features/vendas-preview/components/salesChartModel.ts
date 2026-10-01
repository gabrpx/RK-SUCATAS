export interface SalesChartPresentation {
  tickCount: number;
  showMarkers: boolean;
  height: number;
}

export function getSalesChartPresentation(days: number): SalesChartPresentation {
  const periodDays = Math.max(1, Math.round(days));
  const isDensePeriod = periodDays > 14;

  return {
    tickCount: Math.min(periodDays, isDensePeriod ? 5 : 7),
    showMarkers: periodDays <= 7,
    height: isDensePeriod ? 240 : 232,
  };
}
