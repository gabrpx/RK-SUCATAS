// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryPieceSummaryDrawer, type PrecosPorGrau } from './InventoryPieceSummaryDrawer';
import type { ResultadoBuscaEstoque } from './inventoryPreviewModel';

vi.mock('./InventoryDrawer', () => ({
  InventoryDrawer: ({ isOpen, children }: any) => isOpen ? <section>{children}</section> : null,
}));

function resultado(): ResultadoBuscaEstoque {
  return {
    categoria: { id: 'cat-1', nome: 'Banco dianteiro' },
    peca: { id: 'peca-1', codigoLegado: 'RK-0553', nome: 'BANCO DIANTEIRO FAZER 250', categoriaId: 'cat-1', compatibilidades: ['FAZER 250 · 2018-2024'], detalhes: '' },
    unidades: [
      { id: 'u-a', pecaId: 'peca-1', codigoLegado: 'RK-0553', sku: '1094', grau: 'A', preco: 0, fotoUrl: null, origem: null, endereco: null, estado: 'organizar' },
      { id: 'u-b', pecaId: 'peca-1', codigoLegado: 'RK-0553', sku: '1099', grau: 'B', preco: 120, fotoUrl: null, origem: null, endereco: null, estado: 'organizar' },
      { id: 'u-c', pecaId: 'peca-1', codigoLegado: 'RK-0553', sku: '1097', grau: 'C', preco: null, fotoUrl: null, origem: null, endereco: null, estado: 'organizar' },
    ],
  };
}

describe('InventoryPieceSummaryDrawer', () => {
  it('mostra somente os graus existentes entre as unidades sem preço e atualiza cada valor', async () => {
    const aplicar = vi.fn<(precos: PrecosPorGrau) => Promise<boolean>>();

    function Harness() {
      const [dados, setDados] = useState(resultado);
      aplicar.mockImplementationOnce(async (precos) => {
        setDados((atual) => ({
          ...atual,
          unidades: atual.unidades.map((unidade) => ({ ...unidade, preco: precos[unidade.grau] ?? unidade.preco })),
        }));
        return true;
      });
      return <InventoryPieceSummaryDrawer resultado={dados} onClose={vi.fn()} onOpenUnit={vi.fn()} podeEditar onApplyPrices={aplicar} />;
    }

    render(<Harness />);
    expect(screen.getByRole('button', { name: /Definir preços em lote/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Definir preços em lote/i }));

    expect(screen.getByLabelText('Preço do Grau A')).toBeTruthy();
    expect(screen.getByLabelText('Preço do Grau C')).toBeTruthy();
    expect(screen.queryByLabelText('Preço do Grau B')).toBeNull();

    fireEvent.change(screen.getByLabelText('Preço do Grau A'), { target: { value: '180,50' } });
    fireEvent.change(screen.getByLabelText('Preço do Grau C'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar em 2 unidades' }));

    await waitFor(() => expect(aplicar).toHaveBeenCalledWith({ A: 180.5, C: 90 }));
    expect(await screen.findByText(/R\$\s*180,50/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*90,00/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*120,00/)).toBeTruthy();
  });

  it('não oferece lote quando só uma unidade está sem preço', () => {
    const dados = resultado();
    dados.unidades[0].preco = 80;
    render(<InventoryPieceSummaryDrawer resultado={dados} onClose={vi.fn()} onOpenUnit={vi.fn()} podeEditar onApplyPrices={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Definir preços em lote/i })).toBeNull();
  });

  it('rejeita valores que arredondariam para zero centavos', () => {
    const aplicar = vi.fn();
    render(<InventoryPieceSummaryDrawer resultado={resultado()} onClose={vi.fn()} onOpenUnit={vi.fn()} podeEditar onApplyPrices={aplicar} />);
    fireEvent.click(screen.getByRole('button', { name: /Definir preços em lote/i }));
    fireEvent.change(screen.getByLabelText('Preço do Grau A'), { target: { value: '0,001' } });
    fireEvent.change(screen.getByLabelText('Preço do Grau C'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar em 2 unidades' }));
    expect(screen.getByText('Informe um valor maior que zero.')).toBeTruthy();
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('expõe a exclusão integral somente quando autorizada', () => {
    const excluir = vi.fn();
    const { rerender } = render(<InventoryPieceSummaryDrawer resultado={resultado()} onClose={vi.fn()} onOpenUnit={vi.fn()} onDeleteItem={excluir} />);
    expect(screen.queryByRole('button', { name: /Excluir item do estoque/i })).toBeNull();

    rerender(<InventoryPieceSummaryDrawer resultado={resultado()} onClose={vi.fn()} onOpenUnit={vi.fn()} podeExcluir onDeleteItem={excluir} />);
    fireEvent.click(screen.getByRole('button', { name: /Excluir item do estoque/i }));
    expect(excluir).toHaveBeenCalledTimes(1);
  });
});
