// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  EstoqueHeaderComando,
  EstoqueHeaderControle,
  EstoqueHeaderDock,
  EstoqueHeaderEditorial,
  EstoqueHeaderGallery,
  EstoqueHeaderTrilho,
  type EstoqueHeaderProps,
} from './EstoqueHeaderVariants';

afterEach(cleanup);

const props: EstoqueHeaderProps = {
  resumo: { itens: 3, valorTotal: 440, semValor: 1 },
  visualizacao: 'gavetas',
  onVisualizacaoChange: vi.fn(),
  onNovaGaveta: vi.fn(),
};

describe('alternativas do cabeçalho de estoque', () => {
  it.each([
    EstoqueHeaderTrilho,
    EstoqueHeaderDock,
    EstoqueHeaderComando,
    EstoqueHeaderControle,
    EstoqueHeaderEditorial,
  ])('mantém título e ação principal acessíveis', (Header) => {
    render(<Header {...props} />);
    expect(screen.getByRole('heading', { name: 'Estoque' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /nova gaveta/i })).toBeTruthy();
  });

  it('permite comparar as cinco opções sem duplicar o cabeçalho', () => {
    render(<EstoqueHeaderGallery {...props} />);
    expect(screen.getAllByRole('heading', { name: 'Estoque' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /opção 5/i }));
    expect(screen.getAllByRole('heading', { name: 'Estoque' })).toHaveLength(1);
    expect(screen.getByText(/editorial/i)).toBeTruthy();
  });
});
