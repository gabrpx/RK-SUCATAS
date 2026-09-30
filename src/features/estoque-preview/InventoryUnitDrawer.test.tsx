// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryUnitDrawer } from './InventoryUnitDrawer';

vi.mock('./InventoryDrawer', () => ({
  InventoryDrawer: ({ isOpen, children }: any) => isOpen ? <section>{children}</section> : null,
}));
vi.mock('./InventoryPhotoGallery', () => ({ InventoryPhotoGallery: () => null }));
vi.mock('../estoque/EstoqueUploadFotos', () => ({ EstoqueUploadFotos: () => null }));

describe('InventoryUnitDrawer', () => {
  it('mostra modelo e ano uma única vez na ficha da unidade', () => {
    render(<InventoryUnitDrawer
      unidade={{ id: 'u-1', pecaId: 'p-1', codigoLegado: 'RK-1', sku: 'RK-1-01', grau: 'B', preco: 180, fotoUrl: null, origem: null, endereco: 'P01-S01', estado: 'disponivel' }}
      peca={{ id: 'p-1', codigoLegado: 'RK-1', nome: 'Balança CG 125 Titan', categoriaId: 'cat-1', compatibilidades: ['CG 125 Titan · 94 a 99'], detalhes: '' }}
      onFechar={vi.fn()}
      onSalvar={vi.fn()}
      onArquivar={vi.fn()}
    />);

    expect(screen.getAllByText('CG 125 Titan · 94 a 99')).toHaveLength(1);
  });
});
