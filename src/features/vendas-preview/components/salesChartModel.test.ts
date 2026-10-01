import { describe, expect, it } from 'vitest';
import { getSalesChartPresentation } from './salesChartModel';

describe('getSalesChartPresentation', () => {
  it('reduces visual density for a 30-day chart', () => {
    expect(getSalesChartPresentation(30)).toEqual({
      tickCount: 5,
      showMarkers: false,
      height: 240,
    });
  });

  it('keeps detail visible for a short period', () => {
    expect(getSalesChartPresentation(7)).toEqual({
      tickCount: 7,
      showMarkers: true,
      height: 232,
    });
  });
});
