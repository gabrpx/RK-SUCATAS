import { describe, it, expect } from 'vitest';
import { formatarMomentoRelativo, formatarTempoRelativoCurto } from './tempoRelativo';

const BASE = new Date('2026-08-27T14:30:00').getTime();

describe('formatarMomentoRelativo', () => {
  it('returns null for null input', () => {
    expect(formatarMomentoRelativo(null, BASE)).toBeNull();
  });

  it('shows "agora" for less than a minute', () => {
    const iso = new Date(BASE - 30_000).toISOString();
    expect(formatarMomentoRelativo(iso, BASE)).toContain('agora');
  });

  it('shows minutes for less than an hour', () => {
    const iso = new Date(BASE - 15 * 60_000).toISOString();
    expect(formatarMomentoRelativo(iso, BASE)).toContain('15min atrás');
  });

  it('shows hours for less than a day', () => {
    const iso = new Date(BASE - 3 * 3600_000).toISOString();
    expect(formatarMomentoRelativo(iso, BASE)).toContain('3h atrás');
  });

  it('shows "ontem" for 1-2 days', () => {
    const iso = new Date(BASE - 30 * 3600_000).toISOString();
    expect(formatarMomentoRelativo(iso, BASE)).toContain('ontem');
  });

  it('shows days for more than 2 days', () => {
    const iso = new Date(BASE - 5 * 86400_000).toISOString();
    expect(formatarMomentoRelativo(iso, BASE)).toContain('5d atrás');
  });
});

describe('formatarTempoRelativoCurto', () => {
  it('returns null for null input', () => {
    expect(formatarTempoRelativoCurto(null, BASE)).toBeNull();
  });

  it('returns "agora" for less than a minute', () => {
    expect(formatarTempoRelativoCurto(new Date(BASE - 10_000).toISOString(), BASE)).toBe('agora');
  });

  it('returns "há Xmin" for minutes', () => {
    expect(formatarTempoRelativoCurto(new Date(BASE - 25 * 60_000).toISOString(), BASE)).toBe('há 25min');
  });

  it('returns "há Xh" for hours', () => {
    expect(formatarTempoRelativoCurto(new Date(BASE - 7 * 3600_000).toISOString(), BASE)).toBe('há 7h');
  });

  it('returns "ontem" without "há" prefix', () => {
    expect(formatarTempoRelativoCurto(new Date(BASE - 36 * 3600_000).toISOString(), BASE)).toBe('ontem');
  });

  it('returns "há Xd" for multiple days', () => {
    expect(formatarTempoRelativoCurto(new Date(BASE - 10 * 86400_000).toISOString(), BASE)).toBe('há 10d');
  });
});
