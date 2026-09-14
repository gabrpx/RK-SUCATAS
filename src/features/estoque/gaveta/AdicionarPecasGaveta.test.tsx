// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AdicionarPecasGaveta } from './AdicionarPecasGaveta';

afterEach(cleanup);

vi.mock('../../../context/DataContext', () => ({
  useData: () => ({
    estoque: [{
      id: 'p1',
      ativo: true,
      gaveta_id: null,
      nome: 'TAMPA DO CUBO TRASEIRO YES 125 ESPELHO DE FREIO',
      codigo: 'RK-0276',
      categoria: { nome: 'Tampa do cubo traseiro' },
      imagens: [],
      valor: 65,
    }],
  }),
}));

vi.mock('./hooks', () => ({
  useMoverPecasGaveta: () => ({ moverEmLote: vi.fn(), loading: false }),
}));

describe('AdicionarPecasGaveta', () => {
  it('mantém o nome completo da peça e permite quebra de linha', () => {
    render(<AdicionarPecasGaveta gavetaId="g1" gavetaNome="Gaveta teste" onFechar={() => {}} />);

    const nome = screen.getByText('TAMPA DO CUBO TRASEIRO YES 125 ESPELHO DE FREIO');
    expect(nome.className).not.toContain('truncate');
    expect(nome.className).toContain('break-words');
  });
});
