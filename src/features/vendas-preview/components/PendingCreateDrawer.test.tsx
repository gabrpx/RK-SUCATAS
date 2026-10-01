// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  criar: vi.fn(),
  listarClientes: vi.fn(),
}));

vi.mock('@/src/features/caixa/api', () => ({ caixaPendenciasApi: { criar: mocks.criar } }));
vi.mock('@/src/features/clientes/api', () => ({ clientesApi: { listar: mocks.listarClientes } }));
vi.mock('../../estoque-preview/InventoryDrawer', () => ({
  InventoryDrawer: ({ isOpen, title, children, footer }: any) => isOpen ? <section role="dialog" aria-label={title}>{children}{footer}</section> : null,
}));
vi.mock('@/src/components/ui/Select', () => ({
  Select: ({ label, value, onChange, options }: any) => <label>{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>,
}));

import { PendingCreateDrawer } from './PendingCreateDrawer';

describe('PendingCreateDrawer', () => {
  it('cria uma pendência vinculada ao cliente selecionado', async () => {
    const onSaved = vi.fn();
    mocks.listarClientes.mockResolvedValue({ success: true, data: [{ id: 'cliente-1', nome: 'Ana', ativo: true, banido: false }] });
    mocks.criar.mockResolvedValue({ success: true, data: { id: 'pendencia-1' } });

    render(<PendingCreateDrawer isOpen onClose={vi.fn()} onSaved={onSaved} />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Peça reservada' } });
    fireEvent.change(screen.getByLabelText('Valor total'), { target: { value: '220,00' } });
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'cliente-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pendência' }));

    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      descricao: 'Peça reservada',
      valor_total: 220,
      cliente_id: 'cliente-1',
    })));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
