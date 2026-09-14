// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GavetaList } from './GavetaList';

let gavetasMock = [{ id: 'g1', nome: 'Tanques', categoria_id: null, icone: null }];

afterEach(() => {
  cleanup();
  gavetasMock = [{ id: 'g1', nome: 'Tanques', categoria_id: null, icone: null }];
});

vi.mock('../../../context/DataContext', () => ({
  useData: () => ({ estoque: [], estoqueError: null }),
}));
vi.mock('../../../hooks/useCatalogos', () => ({ useCatalogos: () => ({ categorias: [] }) }));
vi.mock('./hooks', () => ({
  useGavetas: () => ({
    gavetas: gavetasMock,
    loading: false,
    refetch: vi.fn(),
  }),
  useCriarGaveta: () => ({ criar: vi.fn(), loading: false, error: null }),
}));
vi.mock('./EstadosGaveta', () => ({
  AlertaDuplicataGaveta: () => null,
  EmptyGavetas: () => null,
  OfflineBar: () => null,
  encontrarGavetaSemelhante: () => null,
}));

describe('GavetaList — superfície principal do estoque por gavetas', () => {
  it('renderiza o único cabeçalho compacto da visualização', () => {
    render(<GavetaList resumoDoDia={{ itens: 3, valorTotal: 440, semValor: 0 }} />);
    expect(screen.getAllByRole('heading', { name: 'Estoque' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /nova gaveta/i })).toBeTruthy();
    expect(screen.getByText(/hoje: 3 peças/i)).toBeTruthy();
    expect(screen.getByText(/r\$\s*440,00/i)).toBeTruthy();
  });

  it('mantém Nova Gaveta como única ação primária no estado vazio', () => {
    gavetasMock = [];
    render(<GavetaList />);
    expect(screen.getByRole('button', { name: /nova gaveta/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /criar gaveta/i })).toBeNull();
  });
});
