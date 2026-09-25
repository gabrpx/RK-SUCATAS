// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryComposer } from './InventoryComposer';

vi.mock('@/src/components/ui/Combobox', () => ({
  Combobox: ({ label, options, value, onChange }: any) => (
    <label>{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Selecione</option>
      {options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
  ),
}));

vi.mock('./InventoryDrawer', () => ({
  InventoryDrawer: ({ isOpen, title, children }: any) => isOpen ? <section role="dialog" aria-label={title}>{children}</section> : null,
}));

vi.mock('../estoque/EstoqueUploadFotos', () => ({ EstoqueUploadFotos: () => null }));

describe('cadastro operacional de estoque', () => {
  it('salva a primeira unidade sem preço e deixa o valor para preencher depois', async () => {
    const onSalvar = vi.fn().mockResolvedValue({ completo: true, mensagem: 'Unidade cadastrada.' });
    render(<InventoryComposer
      aberto
      categorias={[{ id: 'cat-1', nome: 'Peças' }] as any}
      pecas={[]}
      onFechar={vi.fn()}
      onSalvar={onSalvar}
      operacional
    />);

    fireEvent.change(screen.getByLabelText('Nome da Peça'), { target: { value: 'Farol CG 150' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar unidade' }));

    await waitFor(() => expect(onSalvar).toHaveBeenCalledOnce());
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ preco: null, novaPeca: { nome: 'Farol CG 150', categoriaId: 'cat-1' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('não sugere outra peça quando só o modelo da moto coincide', () => {
    render(<InventoryComposer
      aberto
      categorias={[{ id: 'cat-1', nome: 'Peças' }] as any}
      pecas={[{ id: 'p-1', codigoLegado: 'RK-1', nome: 'Tampa do cubo traseiro CBX Twister 250', categoriaId: 'cat-1', compatibilidades: ['CBX Twister 250'], detalhes: '' }] as any}
      onFechar={vi.fn()}
      onSalvar={vi.fn()}
    />);

    fireEvent.change(screen.getAllByLabelText('Nome da Peça')[0], { target: { value: 'Suporte de pedaleiras CBX Twister 250' } });

    expect(screen.queryByText('Já existe uma peça parecida')).toBeNull();
  });

  it('preenche a referência de moto reconhecida no nome da peça', () => {
    render(<InventoryComposer
      aberto
      categorias={[{ id: 'cat-1', nome: 'Peças' }] as any}
      pecas={[{ id: 'p-1', codigoLegado: 'RK-1', nome: 'Suporte de placa CBX Twister 250', categoriaId: 'cat-1', compatibilidades: ['CBX Twister 250'], detalhes: '' }] as any}
      onFechar={vi.fn()}
      onSalvar={vi.fn()}
    />);

    for (const input of screen.getAllByLabelText('Nome da Peça')) {
      fireEvent.change(input, { target: { value: 'Suporte de pedaleiras CBX Twister 250' } });
    }

    expect(screen.getAllByLabelText(/Referência de moto/).some((input) => (input as HTMLInputElement).value === 'CBX Twister 250')).toBe(true);
  });
});
