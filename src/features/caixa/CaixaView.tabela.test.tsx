// @vitest-environment jsdom
//
// Cobre a migração da lista de lançamentos do Caixa pra TanStack Table +
// shadcn Table: ordenação por coluna (Data/Valor/Forma de pagamento), os
// filtros de período/tipo e a busca por descrição continuando a funcionar,
// os totais recalculados sobre a lista filtrada (não sobre o que a
// ordenação de coluna reordenou), e o fluxo de excluir um lançamento pela
// tabela nova. Seam: DOM renderizado por <CaixaView /> via
// @testing-library/react, com useData/useCatalogos/./api mockados.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CaixaView } from './CaixaView';
import type { CaixaEntry } from './types';

const mockEstado = vi.hoisted(() => ({
  caixa: [] as CaixaEntry[],
}));

vi.mock('./api', () => ({
  caixaApi: {
    lancar: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(() => Promise.resolve({ success: true })),
  },
  caixaPendenciasApi: {
    criar: vi.fn(),
  },
}));

vi.mock('../../context/DataContext', () => ({
  useData: () => {
    const [caixa, setCaixa] = React.useState<CaixaEntry[]>(mockEstado.caixa);
    // Sem vendas do Mercado Livre nestes testes — o botão de corrigir valor
    // (ligado a vendas.canal === 'mercado_livre') não é o que está sob teste
    // aqui, ver CaixaView.editarValorMl.test.tsx.
    return { caixa, setCaixa, vendas: [], showSensitiveInfo: true, setShowSensitiveInfo: vi.fn() };
  },
}));

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogos: () => ({ formasPagamento: [] }),
}));

vi.mock('./PendenciasTab', () => ({ PendenciasTab: () => null }));

// Dublê simples (native <select>) pro CustomDropdown — essa UI (abrir/clicar
// opção) não muda nesta migração, só a tabela abaixo dela. Cada instância no
// CaixaView usa um conjunto de `options` diferente, então o valor da 1ª
// opção serve pra distinguir período de tipo no teste.
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

function isoDaysAgo(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function criarEntry(overrides: Partial<CaixaEntry> & Pick<CaixaEntry, 'id' | 'descricao'>): CaixaEntry {
  return {
    tipo: 'saida',
    valor: 100,
    forma_pagamento_id: null,
    forma_pagamento: null,
    venda_id: null,
    data: isoDaysAgo(0),
    criado_em: new Date().toISOString(),
    ...overrides,
  };
}

/** Ordem em que as descrições aparecem no corpo da tabela. */
function ordemNaTabela(...descricoes: string[]): boolean {
  const corpo = document.querySelector('[data-slot="table-body"]');
  const texto = corpo?.textContent ?? '';
  const indices = descricoes.map((d) => texto.indexOf(d));
  if (indices.some((i) => i === -1)) return false;
  return indices.every((idx, i) => i === 0 || idx > indices[i - 1]);
}

function tabela() {
  return within(document.querySelector('[data-slot="table-body"]') as HTMLElement);
}

function limpar() {
  mockEstado.caixa = [];
}

describe('CaixaView — tabela (TanStack + shadcn)', () => {
  afterEach(() => {
    cleanup();
    limpar();
  });

  it('ordena por Data ao clicar no cabeçalho: 1º clique descendente (mais recente primeiro), 2º ascendente', () => {
    mockEstado.caixa = [
      criarEntry({ id: 'a', descricao: 'Antiga', data: isoDaysAgo(5) }),
      criarEntry({ id: 'b', descricao: 'Recente', data: isoDaysAgo(0) }),
      criarEntry({ id: 'c', descricao: 'Meio termo', data: isoDaysAgo(2) }),
    ];

    render(<CaixaView />);

    // Ordem padrão (sem coluna clicada) já é mais recente primeiro.
    expect(ordemNaTabela('Recente', 'Meio termo', 'Antiga')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(ordemNaTabela('Recente', 'Meio termo', 'Antiga')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(ordemNaTabela('Antiga', 'Meio termo', 'Recente')).toBe(true);
  });

  it('ordena por Valor ao clicar no cabeçalho: 1º clique descendente, 2º ascendente', () => {
    mockEstado.caixa = [
      criarEntry({ id: 'a', descricao: 'Baixo', valor: 50 }),
      criarEntry({ id: 'b', descricao: 'Alto', valor: 500 }),
      criarEntry({ id: 'c', descricao: 'Medio', valor: 200 }),
    ];

    render(<CaixaView />);

    fireEvent.click(screen.getByRole('button', { name: 'Valor' }));
    expect(ordemNaTabela('Alto', 'Medio', 'Baixo')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Valor' }));
    expect(ordemNaTabela('Baixo', 'Medio', 'Alto')).toBe(true);
  });

  it('ordena por Forma de pagamento ao clicar no cabeçalho (alfabética)', () => {
    mockEstado.caixa = [
      criarEntry({ id: 'a', descricao: 'Pix', forma_pagamento: { id: 'f1', nome: 'Pix', natureza: 'avista' } }),
      criarEntry({ id: 'b', descricao: 'Dinheiro', forma_pagamento: { id: 'f2', nome: 'Dinheiro', natureza: 'avista' } }),
      criarEntry({ id: 'c', descricao: 'Cartao', forma_pagamento: { id: 'f3', nome: 'Cartão', natureza: 'avista' } }),
    ];

    render(<CaixaView />);

    fireEvent.click(screen.getByRole('button', { name: 'Forma de pagamento' }));
    expect(ordemNaTabela('Cartao', 'Dinheiro', 'Pix')).toBe(true);
  });

  it('preserva o filtro de período: por padrão (30 dias) esconde lançamentos com mais de 30 dias, "Tudo" revela', () => {
    mockEstado.caixa = [
      criarEntry({ id: 'a', descricao: 'Recente', data: isoDaysAgo(1) }),
      criarEntry({ id: 'b', descricao: 'Antiquíssima', data: isoDaysAgo(40) }),
    ];

    render(<CaixaView />);

    expect(tabela().queryByText('Recente')).not.toBeNull();
    expect(tabela().queryByText('Antiquíssima')).toBeNull();

    fireEvent.change(screen.getByTestId('dropdown-hoje'), { target: { value: 'tudo' } });

    expect(tabela().queryByText('Recente')).not.toBeNull();
    expect(tabela().queryByText('Antiquíssima')).not.toBeNull();
  });

  it('preserva o filtro de tipo (entrada/saída)', () => {
    mockEstado.caixa = [criarEntry({ id: 'a', descricao: 'Venda balcão', tipo: 'entrada' }), criarEntry({ id: 'b', descricao: 'Conta de luz', tipo: 'saida' })];

    render(<CaixaView />);
    fireEvent.change(screen.getByTestId('dropdown-todos'), { target: { value: 'entrada' } });

    expect(tabela().queryByText('Venda balcão')).not.toBeNull();
    expect(tabela().queryByText('Conta de luz')).toBeNull();
  });

  it('preserva a busca por descrição', () => {
    mockEstado.caixa = [criarEntry({ id: 'a', descricao: 'Conta de luz' }), criarEntry({ id: 'b', descricao: 'Salário Pitoco' })];

    render(<CaixaView />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por descrição...'), { target: { value: 'luz' } });

    expect(tabela().queryByText('Conta de luz')).not.toBeNull();
    expect(tabela().queryByText('Salário Pitoco')).toBeNull();
  });

  it('os totais (Entradas/Saídas/Saldo) refletem a lista filtrada, e não mudam ao ordenar por coluna', () => {
    mockEstado.caixa = [
      criarEntry({ id: 'a', descricao: 'Venda', tipo: 'entrada', valor: 300 }),
      criarEntry({ id: 'b', descricao: 'Conta', tipo: 'saida', valor: 100 }),
    ];

    render(<CaixaView />);

    expect(screen.getByText('R$ 300,00')).toBeTruthy();
    expect(screen.getByText('R$ 100,00')).toBeTruthy();
    expect(screen.getByText('R$ 200,00')).toBeTruthy(); // saldo

    fireEvent.click(screen.getByRole('button', { name: 'Valor' }));

    expect(screen.getByText('R$ 300,00')).toBeTruthy();
    expect(screen.getByText('R$ 100,00')).toBeTruthy();
    expect(screen.getByText('R$ 200,00')).toBeTruthy();
  });

  it('exclui um lançamento pela tabela nova: ícone de lixeira abre confirmação e, ao confirmar, some da lista', () => {
    mockEstado.caixa = [criarEntry({ id: 'a', descricao: 'Retirada de caixa' })];

    render(<CaixaView />);
    expect(tabela().queryByText('Retirada de caixa')).not.toBeNull();

    const linha = tabela().getByText('Retirada de caixa').closest('tr')!;
    fireEvent.click(within(linha).getByRole('button'));

    fireEvent.click(screen.getByText('Excluir'));

    // Era o único lançamento — a lista inteira (não só a linha) vira o
    // empty-state, então não há mais `[data-slot="table-body"]" pra escopar.
    expect(screen.queryByText('Retirada de caixa')).toBeNull();
    expect(screen.getByText('Nenhum lançamento encontrado para este filtro.')).toBeTruthy();
  });

  it('lançamento vinculado a uma venda (venda_id) não mostra botão de excluir', () => {
    mockEstado.caixa = [criarEntry({ id: 'a', descricao: 'Venda #123', venda_id: 'v1' })];

    render(<CaixaView />);
    const linha = tabela().getByText('Venda #123').closest('tr')!;

    expect(within(linha).queryByRole('button')).toBeNull();
  });
});
