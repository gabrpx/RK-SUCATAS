import { describe, it, expect } from 'vitest';
import { formatarMomentoRelativo, progressoChecklist } from './tarefaUtils';
import type { TarefaItem } from './types';

const AGORA = new Date('2026-08-24T18:00:00').getTime();
const isoAtras = (ms: number) => new Date(AGORA - ms).toISOString();
const min = 60_000, hora = 60 * min, dia = 24 * hora;

describe('formatarMomentoRelativo', () => {
  it('retorna null quando não há data', () => {
    expect(formatarMomentoRelativo(null, AGORA)).toBeNull();
  });
  it('mostra "agora" abaixo de 1 minuto', () => {
    expect(formatarMomentoRelativo(isoAtras(30_000), AGORA)).toContain('agora');
  });
  it('mostra minutos', () => {
    expect(formatarMomentoRelativo(isoAtras(5 * min), AGORA)).toContain('5min atrás');
  });
  it('mostra horas', () => {
    expect(formatarMomentoRelativo(isoAtras(2 * hora), AGORA)).toContain('2h atrás');
  });
  it('mostra "ontem"', () => {
    expect(formatarMomentoRelativo(isoAtras(28 * hora), AGORA)).toContain('ontem');
  });
  it('mostra dias', () => {
    expect(formatarMomentoRelativo(isoAtras(3 * dia), AGORA)).toContain('3d atrás');
  });
  it('inclui a data/hora antes do relativo', () => {
    const out = formatarMomentoRelativo(isoAtras(2 * hora), AGORA)!;
    expect(out).toMatch(/\d{2}\/\d{2}.*·/); // "24/08 às 16:00 · 2h atrás"
  });
});

const item = (concluido: boolean): TarefaItem => ({
  id: crypto.randomUUID(), texto: 'x', concluido, ordem: 0, concluido_em: null, concluido_por: null,
});

describe('progressoChecklist', () => {
  it('retorna null sem itens', () => {
    expect(progressoChecklist({ itens: [] })).toBeNull();
  });
  it('conta feitos e total', () => {
    expect(progressoChecklist({ itens: [item(true), item(false), item(true)] })).toEqual({ feitos: 2, total: 3 });
  });
});
