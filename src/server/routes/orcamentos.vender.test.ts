import { describe, it, expect } from 'vitest';
import { montarParamsRegistrarVenda } from './orcamentos';

const PARAMS_BASE = { forma_pagamento_id: 'fp-1', cliente_nome: 'Cliente X', cliente_id: null, data: null };

describe('montarParamsRegistrarVenda', () => {
  it('item avulso (sem estoque_id) manda p_estoque_id null e p_nome_item preenchido', () => {
    const item = { id: 'i1', estoque_id: null, nome_item: 'Peça avulsa digitada', quantidade: 2, valor_unitario: 50, componente: null };
    const out = montarParamsRegistrarVenda(item, PARAMS_BASE);
    expect(out.p_estoque_id).toBeNull();
    expect(out.p_nome_item).toBe('Peça avulsa digitada');
    expect(out.p_quantidade).toBe(2);
  });

  it('item vinculado ao estoque não manda p_nome_item (backend tira o nome do estoque)', () => {
    const item = { id: 'i2', estoque_id: 'est-1', nome_item: 'Motor CG', quantidade: 1, valor_unitario: 900, componente: null };
    const out = montarParamsRegistrarVenda(item, PARAMS_BASE);
    expect(out.p_estoque_id).toBe('est-1');
    expect(out.p_nome_item).toBeNull();
  });

  it('vendendo um componente específico, quantidade vai sempre 1 mesmo se a linha tem mais', () => {
    const item = { id: 'i3', estoque_id: 'est-2', nome_item: 'Motor', quantidade: 3, valor_unitario: 100, componente: null };
    const out = montarParamsRegistrarVenda(item, { ...PARAMS_BASE, componente: 'cabeçote' });
    expect(out.p_componente).toBe('cabeçote');
    expect(out.p_quantidade).toBe(1);
  });
});
