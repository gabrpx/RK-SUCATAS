import { describe, expect, it } from 'vitest';
import type { CaixaEntry } from '../caixa/types';
import type { FiadoRecebimento } from '../fiado/types';
import type { Venda } from '../vendas/types';
import { buildSaleViewModels } from './salesViewModel';

const venda = (natureza: 'avista' | 'fiado', extra: Partial<Venda> = {}): Venda => ({
  id: 'venda-1', estoque_id: 'estoque-1', nome_item: 'Farol CG 160', quantidade: 1,
  valor_unitario: 100, valor_total: 100, forma_pagamento_id: 'pix',
  forma_pagamento: { id: 'pix', nome: natureza === 'fiado' ? 'Fiado' : 'Pix', natureza },
  modelo_moto_id: null, modelo_moto: null, cliente_nome: 'Ana', cliente_id: null,
  cliente: null, observacoes: 'Entregar amanhã', componente_vendido: null,
  unidade_id: 'unidade-1', unidade: null, data: '2026-09-28T12:00:00-03:00',
  criado_em: '2026-09-28T12:00:00-03:00', canal: 'balcao', ml_order_id: null,
  ml_item_id: null, ml_shipping_id: null, ...extra,
});

const entrada = (valor: number): CaixaEntry => ({
  id: `caixa-${valor}`, tipo: 'entrada', descricao: 'Venda', valor,
  forma_pagamento_id: 'pix', forma_pagamento: { id: 'pix', nome: 'Pix', natureza: 'avista' },
  venda_id: 'venda-1', data: '2026-09-28T12:00:00-03:00', criado_em: '2026-09-28T12:00:00-03:00',
});

const recebimento = (valor: number): FiadoRecebimento => ({
  id: `fiado-${valor}`, venda_id: 'venda-1', valor, forma_pagamento_id: 'pix',
  forma_pagamento: { id: 'pix', nome: 'Pix' }, caixa_id: `caixa-${valor}`,
  recebido_por: 'usuario-1', recebido_em: '2026-09-29T12:00:00-03:00', usuario: null,
});

describe('buildSaleViewModels', () => {
  it('concilia uma venda imediata com entrada equivalente', () => {
    const [result] = buildSaleViewModels([venda('avista')], [entrada(100)], [], { canViewCash: true });
    expect(result.reconciliation).toEqual({ kind: 'settled', received: 100 });
  });

  it('pede revisão quando uma venda imediata não possui entrada vinculada', () => {
    const [result] = buildSaleViewModels([venda('avista')], [], [], { canViewCash: true });
    expect(result.reconciliation).toEqual({ kind: 'needs-review', recordedMethod: 'Pix' });
    expect(result.pagamentos).toEqual([]);
  });

  it('representa fiado parcial como saldo aberto e fiado quitado como liquidado', () => {
    const [partial] = buildSaleViewModels([venda('fiado')], [], [recebimento(40)], { canViewCash: true });
    const [settled] = buildSaleViewModels([venda('fiado')], [], [recebimento(100)], { canViewCash: true });
    expect(partial.reconciliation).toEqual({ kind: 'open', received: 40, outstanding: 60 });
    expect(settled.reconciliation).toEqual({ kind: 'settled', received: 100 });
  });

  it('não infere situação financeira sem permissão de Caixa', () => {
    const immediate = buildSaleViewModels([venda('avista')], [entrada(100)], [], { canViewCash: false })[0];
    const credit = buildSaleViewModels([venda('fiado')], [], [recebimento(40)], { canViewCash: false })[0];
    expect(immediate.reconciliation).toEqual({ kind: 'unavailable' });
    expect(credit.reconciliation).toEqual({ kind: 'unavailable' });
  });
});
