// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstoqueFiltrosPopover } from './EstoqueFiltrosPopover';

function baseProps(overrides: Partial<ComponentProps<typeof EstoqueFiltrosPopover>> = {}): ComponentProps<typeof EstoqueFiltrosPopover> {
  return {
    categoriaFiltro: 'Todas',
    onCategoriaChange: vi.fn(),
    categoriaNodes: [],
    modeloFiltro: 'Todas',
    onModeloChange: vi.fn(),
    modeloNodes: [],
    soEstoqueBaixo: false,
    onToggleEstoqueBaixo: vi.fn(),
    itensEstoqueBaixo: 0,
    soSemPreco: false,
    onToggleSemPreco: vi.fn(),
    soComAvaria: false,
    onToggleComAvaria: vi.fn(),
    mostrarFiltroAvaria: false,
    itensComAvaria: 0,
    soSemFoto: false,
    onToggleSemFoto: vi.fn(),
    soSemLinkMl: false,
    onToggleSemLinkMl: vi.fn(),
    ...overrides,
  };
}

describe('EstoqueFiltrosPopover', () => {
  afterEach(() => cleanup());

  it('esconde os filtros até clicar em "Filtros", e mostra ao clicar', () => {
    render(<EstoqueFiltrosPopover {...baseProps()} />);
    expect(screen.queryByText('Estoque baixo')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));

    expect(screen.getByText('Estoque baixo')).toBeTruthy();
    expect(screen.getByText('Sem preço')).toBeTruthy();
    expect(screen.getByText('Sem foto')).toBeTruthy();
    expect(screen.getByText('Sem link ML')).toBeTruthy();
  });

  it('só mostra "Com avaria" quando mostrarFiltroAvaria é true', () => {
    render(<EstoqueFiltrosPopover {...baseProps({ mostrarFiltroAvaria: true, itensComAvaria: 3 })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    expect(screen.getByText('Com avaria')).toBeTruthy();
  });

  it('não mostra "Com avaria" quando mostrarFiltroAvaria é false', () => {
    render(<EstoqueFiltrosPopover {...baseProps({ mostrarFiltroAvaria: false })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    expect(screen.queryByText('Com avaria')).toBeNull();
  });

  it('clicar no checkbox de um filtro chama o callback correspondente', () => {
    const onToggleSemFoto = vi.fn();
    render(<EstoqueFiltrosPopover {...baseProps({ onToggleSemFoto })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Sem foto' }));

    expect(onToggleSemFoto).toHaveBeenCalledTimes(1);
  });

  it('mostra a contagem de filtros ativos no botão "Filtros"', () => {
    render(<EstoqueFiltrosPopover {...baseProps({ soSemFoto: true, soSemLinkMl: true })} />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
