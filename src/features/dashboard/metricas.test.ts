import { describe, it, expect } from 'vitest';
import { calcularSaldoAcumulado30Dias, compararComMesPassado } from './metricas';
import type { CaixaEntry } from '../caixa/types';

function entry(parcial: Partial<CaixaEntry> & Pick<CaixaEntry, 'tipo' | 'valor' | 'data'>): CaixaEntry {
  return {
    id: Math.random().toString(36),
    descricao: 'teste',
    forma_pagamento_id: null,
    venda_id: null,
    criado_em: `${parcial.data}T00:00:00`,
    ...parcial,
  };
}

// "hoje" fixo pra todos os testes: os 30 dias vão de 2026-07-17 até 2026-08-15.
const HOJE = new Date(2026, 7, 15);
const diaOffset = (offset: number) => {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

describe('calcularSaldoAcumulado30Dias', () => {
  it('sempre devolve 30 pontos, do dia -29 até hoje', () => {
    const pontos = calcularSaldoAcumulado30Dias([], HOJE);
    expect(pontos).toHaveLength(30);
    expect(pontos[0].data).toBe(diaOffset(29));
    expect(pontos[29].data).toBe(diaOffset(0));
  });

  it('sem lançamentos, o saldo fica zerado em todos os dias', () => {
    const pontos = calcularSaldoAcumulado30Dias([], HOJE);
    expect(pontos.every((p) => p.valor === 0)).toBe(true);
  });

  it('ignora lançamentos fora da janela de 30 dias', () => {
    const foraDaJanela = entry({ tipo: 'entrada', valor: 500, data: diaOffset(40) });
    const pontos = calcularSaldoAcumulado30Dias([foraDaJanela], HOJE);
    expect(pontos.every((p) => p.valor === 0)).toBe(true);
  });

  // Este é o teste que a versão antiga (saldo líquido POR DIA, não acumulado)
  // não passava: um lançamento isolado precisa manter o saldo elevado nos
  // dias seguintes, não voltar a zero no dia seguinte — é exatamente esse
  // "zera todo dia sem transação" que desenha o formato de batimento
  // cardíaco no gráfico quando os dados são esparsos.
  it('mantém o saldo acumulado nos dias seguintes a um lançamento isolado, em vez de zerar', () => {
    const entrada = entry({ tipo: 'entrada', valor: 100, data: diaOffset(20) });
    const pontos = calcularSaldoAcumulado30Dias([entrada], HOJE);

    const antes = pontos.find((p) => p.data === diaOffset(21))!;
    const noDia = pontos.find((p) => p.data === diaOffset(20))!;
    const depois = pontos.find((p) => p.data === diaOffset(19))!;
    const ultimo = pontos[pontos.length - 1];

    expect(antes.valor).toBe(0);
    expect(noDia.valor).toBe(100);
    expect(depois.valor).toBe(100);
    expect(ultimo.valor).toBe(100);
  });

  it('acumula entradas e saídas em sequência, deixando o saldo refletir a soma corrida', () => {
    const entrada = entry({ tipo: 'entrada', valor: 100, data: diaOffset(20) });
    const saida = entry({ tipo: 'saida', valor: 30, data: diaOffset(5) });
    const pontos = calcularSaldoAcumulado30Dias([entrada, saida], HOJE);

    expect(pontos.find((p) => p.data === diaOffset(20))!.valor).toBe(100);
    expect(pontos.find((p) => p.data === diaOffset(6))!.valor).toBe(100);
    expect(pontos.find((p) => p.data === diaOffset(5))!.valor).toBe(70);
    expect(pontos[pontos.length - 1].valor).toBe(70);
  });

  it('soma múltiplos lançamentos no mesmo dia antes de acumular', () => {
    const a = entry({ tipo: 'entrada', valor: 200, data: diaOffset(10) });
    const b = entry({ tipo: 'saida', valor: 50, data: diaOffset(10) });
    const pontos = calcularSaldoAcumulado30Dias([a, b], HOJE);

    expect(pontos.find((p) => p.data === diaOffset(10))!.valor).toBe(150);
  });
});

describe('compararComMesPassado', () => {
  it('calcula percentual de alta em relação ao mês anterior', () => {
    const r = compararComMesPassado(1200, 1000);
    expect(r).toEqual({ texto: '20% a mais que o mês passado', positivo: true, pct: 20, subiu: true });
  });

  it('calcula percentual de queda em relação ao mês anterior', () => {
    const r = compararComMesPassado(800, 1000);
    expect(r).toEqual({ texto: '20% a menos que o mês passado', positivo: false, pct: 20, subiu: false });
  });

  it('sem dado do mês anterior mas com valor atual, avisa que não dá pra comparar', () => {
    const r = compararComMesPassado(500, 0);
    expect(r).toEqual({ texto: 'Não dá pra comparar (mês passado não teve nada)', positivo: true, pct: null, subiu: true });
  });

  it('sem dado nem atual nem anterior, avisa que não há comparação', () => {
    const r = compararComMesPassado(0, 0);
    expect(r).toEqual({ texto: 'Sem comparação com o mês passado', positivo: true, pct: null, subiu: true });
  });

  it('com menorEhMelhor, uma queda conta como positivo (ex: saídas de caixa)', () => {
    const r = compararComMesPassado(800, 1000, { menorEhMelhor: true });
    expect(r).toEqual({ texto: '20% a menos que o mês passado', positivo: true, pct: 20, subiu: false });
  });

  it('com menorEhMelhor, uma alta conta como negativo (ex: saídas de caixa)', () => {
    const r = compararComMesPassado(1200, 1000, { menorEhMelhor: true });
    expect(r).toEqual({ texto: '20% a mais que o mês passado', positivo: false, pct: 20, subiu: true });
  });
});
