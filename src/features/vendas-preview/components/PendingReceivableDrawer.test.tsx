// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  receberManual: vi.fn(),
  reverterManual: vi.fn(),
  sucesso: vi.fn(),
  atencao: vi.fn(),
  falha: vi.fn(),
}));

vi.mock('@/src/features/caixa/api', () => ({ caixaPendenciasApi: { registrarRecebimento: mocks.receberManual, removerRecebimento: mocks.reverterManual } }));
vi.mock('@/src/features/fiado/api', () => ({ fiadoApi: { registrarRecebimento: vi.fn(), removerRecebimento: vi.fn() } }));
vi.mock('@/src/hooks/useCatalogos', () => ({ useCatalogos: () => ({ formasPagamento: [{ id: 'pix', nome: 'Pix', natureza: 'avista' }] }) }));
vi.mock('@/src/components/ui/toast', () => ({ aviso: mocks }));
vi.mock('../../estoque-preview/InventoryDrawer', () => ({
  InventoryDrawer: ({ isOpen, title, children, footer }: any) => isOpen ? <section role="dialog" aria-label={title}>{children}{footer}</section> : null,
}));
vi.mock('@/src/components/ui/Select', () => ({
  Select: ({ label, value, onChange, options }: any) => <label>{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>,
}));

import { PendingReceivableDrawer } from './PendingReceivableDrawer';

const pending = {
  id: 'pendencia-1', tipo: 'A receber' as const, nome: 'Ana', origem: 'Peça reservada', total: 220, pago: 20,
  pagamentos: [{ id: 'recebimento-1', meio: 'Pix', valor: 20, ocorridoEm: '2026-10-01T12:00:00Z' }],
  venceEm: null, criadaEm: '2026-10-01', source: { kind: 'caixa' as const, pendenciaId: 'pendencia-1' }, clienteId: 'cliente-1', observacoes: null,
};

describe('PendingReceivableDrawer', () => {
  it('registra o saldo restante e permite reverter um recebimento manual', async () => {
    mocks.receberManual.mockResolvedValue({ success: true, data: {} });
    mocks.reverterManual.mockResolvedValue({ success: true, data: null });
    const onSaved = vi.fn();
    render(<PendingReceivableDrawer pending={pending} canReceive onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByLabelText('Valor do recebimento')).toHaveValue('200,00');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
    await waitFor(() => expect(mocks.receberManual).toHaveBeenCalledWith('pendencia-1', { valor: 200, forma_pagamento_id: 'pix' }));
    expect(onSaved).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Reverter recebimento recebimento-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reversão' }));
    await waitFor(() => expect(mocks.reverterManual).toHaveBeenCalledWith('pendencia-1', 'recebimento-1'));
  });
});
