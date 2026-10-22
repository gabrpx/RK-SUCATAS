// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UnidadeForm } from './UnidadeForm';
import type { EstoqueUnidade } from '../types';

const { atualizarUnidade } = vi.hoisted(() => ({ atualizarUnidade: vi.fn() }));
vi.mock('../api', () => ({ estoqueApi: { atualizarUnidade }, uploadImagemEstoque: vi.fn() }));
afterEach(() => { cleanup(); atualizarUnidade.mockReset(); });

describe('edição de unidade', () => {
  it('salva nota com preço e foto herdados e aceita Enter', async () => {
    const unidade = { id: 'u1', estoque_id: 'e1', nome: null, condicao_nota: null, avaria: false, avaria_descricao: null, descricao: null, fotos: [], valor: null } as EstoqueUnidade;
    atualizarUnidade.mockResolvedValue({ success: true, data: unidade });
    render(<UnidadeForm estoqueId="e1" unidade={unidade} onSalvar={vi.fn()} onCancelar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar' }).closest('form')!);
    await waitFor(() => expect(atualizarUnidade).toHaveBeenCalledWith('e1', 'u1', expect.objectContaining({ valor: null, condicao_nota: 8 })));
  });
});
