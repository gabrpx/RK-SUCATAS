// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lancar: vi.fn(),
  sucesso: vi.fn(),
  atencao: vi.fn(),
  falha: vi.fn(),
}));

vi.mock('@/src/features/caixa/api', () => ({ caixaApi: { lancar: mocks.lancar } }));
vi.mock('@/src/hooks/useCatalogos', () => ({ useCatalogos: () => ({ formasPagamento: [{ id: 'pix', nome: 'Pix', natureza: 'avista' }] }) }));
vi.mock('@/src/components/ui/toast', () => ({ aviso: mocks }));
vi.mock('../../estoque-preview/InventoryDrawer', () => ({
  InventoryDrawer: ({ isOpen, title, children, footer }: any) => isOpen ? <section role="dialog" aria-label={title}>{children}{footer}</section> : null,
}));

import { MovementActionDrawer } from './MovementActionDrawer';

describe('MovementActionDrawer', () => {
  it('registra uma saída manual e informa o pai para atualizar a lista', async () => {
    const onSaved = vi.fn();
    mocks.lancar.mockResolvedValue({ success: true, data: { id: 'caixa-1' } });

    render(<MovementActionDrawer isOpen initialTipo="saida" onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Conta de energia' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '410,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lançamento' }));

    await waitFor(() => expect(mocks.lancar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'saida',
      descricao: 'Conta de energia',
      valor: 410,
      forma_pagamento_id: null,
      data: expect.any(String),
    })));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
