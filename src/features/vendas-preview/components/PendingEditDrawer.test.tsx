// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clientes: vi.fn(), atualizarPendencia: vi.fn(), atualizarVenda: vi.fn(),
}));

vi.mock('@/src/features/clientes/api', () => ({ clientesApi: { listar: mocks.clientes } }));
vi.mock('@/src/features/caixa/api', () => ({ caixaPendenciasApi: { atualizar: mocks.atualizarPendencia } }));
vi.mock('@/src/features/vendas/api', () => ({ vendasApi: { atualizarParcial: mocks.atualizarVenda } }));
vi.mock('../../estoque-preview/InventoryDrawer', () => ({
  InventoryDrawer: ({ isOpen, title, children }: any) => isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

import type { PendenciaDemo } from '../data';
import { PendingEditDrawer } from './PendingEditDrawer';

const manual: PendenciaDemo = {
  id: 'pendencia-p1', tipo: 'A receber', nome: 'Ana', origem: 'Peça encomendada',
  total: 200, pago: 100, pagamentos: [], venceEm: null, criadaEm: '2026-09-20',
  source: { kind: 'caixa', pendenciaId: 'p1' }, clienteId: 'c1', observacoes: null,
};

const fiado: PendenciaDemo = {
  ...manual, id: 'venda-v1', origem: 'Farol · v1', total: 300, pago: 40,
  source: { kind: 'fiado', vendaId: 'v1' }, observacoes: 'Ligar sexta',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientes.mockResolvedValue({ success: true, data: [{ id: 'c1', nome: 'Ana', ativo: true, banido: false }] });
  mocks.atualizarPendencia.mockResolvedValue({ success: true, data: {} });
  mocks.atualizarVenda.mockResolvedValue({ success: true, data: {} });
});

afterEach(cleanup);

describe('PendingEditDrawer', () => {
  it('impede que o total manual fique abaixo do valor recebido', async () => {
    render(<PendingEditDrawer pending={manual} canEdit onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText('Valor total'), { target: { value: 'R$ 99,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('R$ 100,00');
    expect(mocks.atualizarPendencia).not.toHaveBeenCalled();
  });

  it('salva descrição, total, data e cliente de uma pendência manual', async () => {
    const onSaved = vi.fn();
    render(<PendingEditDrawer pending={manual} canEdit onClose={() => {}} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Peça revisada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mocks.atualizarPendencia).toHaveBeenCalledWith('p1', expect.objectContaining({ descricao: 'Peça revisada', valor_total: 200, data: '2026-09-20', cliente_id: 'c1' })));
    expect(onSaved).toHaveBeenCalled();
  });

  it('em fiado edita apenas cliente e observações sem expor total e data', async () => {
    render(<PendingEditDrawer pending={fiado} canEdit onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByLabelText('Valor total')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Data da pendência')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Cobrar na segunda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(mocks.atualizarVenda).toHaveBeenCalledWith('v1', expect.objectContaining({ observacoes: 'Cobrar na segunda' })));
  });

  it('fica em consulta quando o perfil não pode editar', () => {
    render(<PendingEditDrawer pending={manual} canEdit={false} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText('Seu perfil pode consultar esta pendência, mas não alterá-la.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
  });
});
