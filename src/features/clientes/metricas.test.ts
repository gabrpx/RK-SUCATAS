import { describe, it, expect } from 'vitest';
import { calcularSegmento, calcularHistoricoCliente, type HistoricoCliente } from './metricas';
import type { Venda } from '../vendas/types';
import type { Orcamento } from '../orcamentos/types';

function vendaFake(over: Partial<Venda> = {}): Venda {
  return {
    id: 'v1',
    estoque_id: null,
    nome_item: 'Peça',
    quantidade: 1,
    valor_unitario: 1000,
    valor_total: 1000,
    forma_pagamento_id: null,
    modelo_moto_id: null,
    cliente_nome: 'Fulano',
    cliente_id: 'c1',
    observacoes: null,
    componente_vendido: null,
    unidade_id: null,
    data: '2026-08-10',
    criado_em: '2026-08-10T12:00:00Z',
    canal: 'balcao',
    ml_order_id: null,
    ml_item_id: null,
    ml_shipping_id: null,
    ...over,
  };
}

function hist(over: Partial<HistoricoCliente> = {}): HistoricoCliente {
  return {
    vendas: [],
    orcamentosAbertos: [],
    totalGasto: 0,
    quantidadeCompras: 0,
    ticketMedio: 0,
    ultimaCompraEm: null,
    diasDesdeUltimaCompra: null,
    ...over,
  };
}

const agora = new Date('2026-08-27T12:00:00Z');

describe('calcularSegmento', () => {
  it('cliente sem compras = sem_compras', () => {
    expect(calcularSegmento(hist(), null, agora)).toBe('sem_compras');
  });

  it('cliente com 1 compra recente de valor alto NÃO é "novo" se cadastro é antigo', () => {
    const h = hist({
      quantidadeCompras: 1,
      totalGasto: 1500,
      diasDesdeUltimaCompra: 16,
      ultimaCompraEm: '2026-08-11',
    });
    const criadoEm = '2026-06-01T00:00:00Z';
    const segmento = calcularSegmento(h, criadoEm, agora);
    expect(segmento).not.toBe('novo');
    expect(segmento).toBe('campeao');
  });

  it('cliente cadastrado há 10 dias com 1 compra pequena é "novo"', () => {
    const h = hist({
      quantidadeCompras: 1,
      totalGasto: 50,
      diasDesdeUltimaCompra: 10,
      ultimaCompraEm: '2026-08-17',
    });
    const criadoEm = '2026-08-17T00:00:00Z';
    expect(calcularSegmento(h, criadoEm, agora)).toBe('novo');
  });

  it('cliente com totalGasto >= 500 é campeão mesmo com poucas compras', () => {
    const h = hist({
      quantidadeCompras: 2,
      totalGasto: 800,
      diasDesdeUltimaCompra: 10,
      ultimaCompraEm: '2026-08-17',
    });
    expect(calcularSegmento(h, '2026-07-01T00:00:00Z', agora)).toBe('campeao');
  });

  it('cliente com 5+ compras é campeão', () => {
    const h = hist({
      quantidadeCompras: 6,
      totalGasto: 300,
      diasDesdeUltimaCompra: 10,
      ultimaCompraEm: '2026-08-17',
    });
    expect(calcularSegmento(h, '2026-01-01T00:00:00Z', agora)).toBe('campeao');
  });

  it('cliente com 90+ dias desde última compra é sumido', () => {
    const h = hist({
      quantidadeCompras: 3,
      totalGasto: 200,
      diasDesdeUltimaCompra: 100,
      ultimaCompraEm: '2026-05-19',
    });
    expect(calcularSegmento(h, '2026-01-01T00:00:00Z', agora)).toBe('sumido');
  });

  it('cliente com 45-89 dias desde última compra é em_risco', () => {
    const h = hist({
      quantidadeCompras: 2,
      totalGasto: 200,
      diasDesdeUltimaCompra: 60,
      ultimaCompraEm: '2026-06-28',
    });
    expect(calcularSegmento(h, '2026-01-01T00:00:00Z', agora)).toBe('em_risco');
  });

  it('cliente ativo normal: compras recentes, cadastro antigo, gasto moderado', () => {
    const h = hist({
      quantidadeCompras: 3,
      totalGasto: 200,
      diasDesdeUltimaCompra: 10,
      ultimaCompraEm: '2026-08-17',
    });
    expect(calcularSegmento(h, '2026-03-01T00:00:00Z', agora)).toBe('ativo');
  });

  it('sem criadoEm: cliente com 1 compra recente e valor baixo é ativo (não novo)', () => {
    const h = hist({
      quantidadeCompras: 1,
      totalGasto: 50,
      diasDesdeUltimaCompra: 5,
      ultimaCompraEm: '2026-08-22',
    });
    expect(calcularSegmento(h, undefined, agora)).toBe('ativo');
  });
});

describe('calcularHistoricoCliente', () => {
  it('calcula totalGasto e ticketMedio corretamente', () => {
    const vendas = [
      vendaFake({ id: 'v1', valor_total: 1000, data: '2026-08-10' }),
      vendaFake({ id: 'v2', valor_total: 500, data: '2026-08-05' }),
    ];
    const h = calcularHistoricoCliente('c1', vendas, [] as Orcamento[], agora);
    expect(h.totalGasto).toBe(1500);
    expect(h.quantidadeCompras).toBe(2);
    expect(h.ticketMedio).toBe(750);
    expect(h.diasDesdeUltimaCompra).toBe(17);
  });
});
