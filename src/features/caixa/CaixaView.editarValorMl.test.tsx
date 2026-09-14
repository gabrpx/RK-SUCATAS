// @vitest-environment jsdom
//
// Cobre a saída manual pra corrigir a taxa do Mercado Livre em vendas já
// importadas: o VALOR de um lançamento vinculado a uma venda com
// canal 'mercado_livre' fica editável na tela de Caixa; um lançamento vindo
// de qualquer outra venda (loja física/orçamento) continua 100% travado,
// sem botão nenhum — ver comentário de cabeçalho de CaixaView.tsx.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CaixaView } from './CaixaView';
import { caixaApi } from './api';
import type { CaixaEntry } from './types';

const mockEstado = vi.hoisted(() => ({
  caixa: [] as CaixaEntry[],
  vendas: [] as { id: string; canal: 'balcao' | 'mercado_livre' }[],
}));

vi.mock('./api', () => ({
  caixaApi: {
    lancar: vi.fn(),
    atualizar: vi.fn(() => Promise.resolve({ success: true, data: {} })),
    excluir: vi.fn(() => Promise.resolve({ success: true })),
  },
  caixaPendenciasApi: {
    criar: vi.fn(),
  },
}));

vi.mock('../../context/DataContext', () => ({
  useData: () => {
    const [caixa, setCaixa] = React.useState<CaixaEntry[]>(mockEstado.caixa);
    return { caixa, setCaixa, vendas: mockEstado.vendas, showSensitiveInfo: true, setShowSensitiveInfo: vi.fn() };
  },
}));

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogos: () => ({ formasPagamento: [] }),
}));

vi.mock('./PendenciasTab', () => ({ PendenciasTab: () => null }));

vi.mock('../../components/CustomDropdown', () => ({
  CustomDropdown: ({ value, onChange, options }: any) => (
    <select data-testid={`dropdown-${options[0]?.value}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

function criarEntry(overrides: Partial<CaixaEntry> & Pick<CaixaEntry, 'id' | 'descricao'>): CaixaEntry {
  return {
    tipo: 'entrada',
    valor: 750,
    forma_pagamento_id: null,
    forma_pagamento: null,
    venda_id: null,
    data: new Date().toISOString().slice(0, 10),
    criado_em: new Date().toISOString(),
    ...overrides,
  };
}

function tabela() {
  return within(document.querySelector('[data-slot="table-body"]') as HTMLElement);
}

function limpar() {
  mockEstado.caixa = [];
  mockEstado.vendas = [];
  vi.mocked(caixaApi.atualizar).mockClear();
}

describe('CaixaView — corrigir valor de venda do Mercado Livre', () => {
  afterEach(() => {
    cleanup();
    limpar();
  });

  it('lançamento de venda do Mercado Livre mostra botão de editar e salva o valor corrigido', async () => {
    mockEstado.caixa = [criarEntry({ id: 'a', descricao: 'Venda: Módulo ABS', venda_id: 'v1', valor: 750 })];
    mockEstado.vendas = [{ id: 'v1', canal: 'mercado_livre' }];
    vi.mocked(caixaApi.atualizar).mockResolvedValueOnce({
      success: true,
      data: { ...mockEstado.caixa[0], valor: 598.05 },
    });

    render(<CaixaView />);
    const linha = tabela().getByText('Venda: Módulo ABS').closest('tr')!;
    const botaoEditar = within(linha).getByRole('button');
    fireEvent.click(botaoEditar);

    expect(screen.getByRole('heading', { name: 'Corrigir valor recebido' })).toBeTruthy();
    const input = screen.getByDisplayValue('750') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '598.05' } });
    fireEvent.click(screen.getByText('Salvar'));

    await vi.waitFor(() => {
      expect(caixaApi.atualizar).toHaveBeenCalledWith('a', { valor: 598.05 });
    });
  });

  it('lançamento de venda fora do Mercado Livre (ou sem venda vinculada na lista) continua sem nenhum botão', () => {
    mockEstado.caixa = [criarEntry({ id: 'b', descricao: 'Venda: Balcão', venda_id: 'v2' })];
    mockEstado.vendas = [{ id: 'v2', canal: 'balcao' }];

    render(<CaixaView />);
    const linha = tabela().getByText('Venda: Balcão').closest('tr')!;

    expect(within(linha).queryByRole('button')).toBeNull();
  });
});
