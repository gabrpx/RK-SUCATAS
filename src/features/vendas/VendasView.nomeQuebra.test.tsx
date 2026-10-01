// @vitest-environment jsdom
//
// Task 5 (Texto Truncado): nome do item vendido agora quebra em até 2 linhas
// (line-clamp-2) em vez de truncar com "..." no meio da palavra — tanto na
// lista principal de vendas quanto na lista de resultados de busca do modal
// "Nova Venda". Seam mínimo: só o suficiente pra renderizar essas duas
// listas, sem cobrir o fluxo completo de registrar venda (isso já não existe
// hoje e não é o escopo desta task, que é só a troca de classe de truncagem).
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VendasView } from './VendasView';
import type { Venda } from './types';
import type { Estoque } from '../estoque/types';

const mockEstado = vi.hoisted(() => ({
  vendas: [] as Venda[],
  estoque: [] as Estoque[],
}));

vi.mock('./api', () => ({
  vendasApi: {
    registrar: vi.fn(),
    cancelar: vi.fn(),
    cancelarFiadoCompleto: vi.fn(),
  },
}));

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    vendas: mockEstado.vendas,
    setVendas: vi.fn(),
    estoque: mockEstado.estoque,
    clientes: [],
    motosClientes: [],
    fiadoRecebimentos: [],
    refreshData: vi.fn(),
    loading: false,
  }),
}));

vi.mock('../../hooks/usePermissao', () => ({
  usePermissao: () => ({ pode: () => true }),
}));

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogos: () => ({ formasPagamento: [] }),
}));

vi.mock('../mercadolivre/SincronizacaoMlContext', () => ({
  useSincronizacaoMl: () => ({ abrir: vi.fn() }),
}));

function criarVenda(overrides: Partial<Venda> & Pick<Venda, 'id' | 'nome_item'>): Venda {
  return {
    estoque_id: null,
    quantidade: 1,
    valor_unitario: 100,
    valor_total: 100,
    forma_pagamento_id: null,
    forma_pagamento: null,
    modelo_moto_id: null,
    modelo_moto: null,
    cliente_nome: null,
    cliente_id: null,
    cliente: null,
    observacoes: null,
    componente_vendido: null,
    unidade_id: null,
    unidade: null,
    // Dinâmico (não uma data fixa no passado): a lista principal usa o
    // filtro de período padrão "30d" (isDentroDoPeriodo), então uma data
    // fixa ficaria de fora assim que o tempo passasse.
    data: new Date().toISOString().slice(0, 10),
    criado_em: '2026-01-01T00:00:00.000Z',
    canal: 'balcao',
    ml_order_id: null,
    ml_item_id: null,
    ml_shipping_id: null,
    ...overrides,
  };
}

function criarItemEstoque(overrides: Partial<Estoque> & Pick<Estoque, 'id' | 'nome'>): Estoque {
  return {
    codigo: `RK-${overrides.id}`,
    categoria_id: null,
    modelo_moto_id: null,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    ...overrides,
  } as Estoque;
}

describe('VendasView — nome do item quebra em vez de truncar', () => {
  afterEach(() => {
    cleanup();
    mockEstado.vendas = [];
    mockEstado.estoque = [];
  });

  it('lista principal: nome longo tem line-clamp-2 e não tem truncate', () => {
    mockEstado.vendas = [criarVenda({ id: 'v1', nome_item: 'Motor Completo CG 150 Titan Injetado Original Usado' })];

    const { container } = render(<VendasView onSelectItem={() => {}} />);

    const nome = Array.from(container.querySelectorAll('p')).find((el) => el.textContent?.includes('Motor Completo CG 150 Titan Injetado Original Usado'));
    expect(nome).toBeTruthy();
    expect(nome!.className).toContain('line-clamp-2');
    expect(nome!.className).not.toContain('truncate');
  });

  it('modal "Nova Venda": resultado da busca tem line-clamp-2 e não tem truncate', () => {
    mockEstado.estoque = [criarItemEstoque({ id: 'e1', nome: 'Carenagem Lateral Direita Completa Original', quantidade: 3 })];

    render(<VendasView onSelectItem={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova Venda/i }));
    fireEvent.change(screen.getByPlaceholderText('Nome ou código...'), { target: { value: 'Carenagem' } });

    // O modal (Radix Dialog) é renderizado via Portal, fora do `container` do
    // RTL — busca no document inteiro em vez de escopar ao container local.
    const nome = Array.from(document.body.querySelectorAll('p')).find((el) => el.textContent === 'Carenagem Lateral Direita Completa Original');
    expect(nome).toBeTruthy();
    expect(nome!.className).toContain('line-clamp-2');
    expect(nome!.className).not.toContain('truncate');
  });
});
