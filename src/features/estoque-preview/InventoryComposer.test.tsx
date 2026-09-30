// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(cleanup);

describe('cadastro operacional de estoque', () => {
  it('salva a primeira unidade sem preço e deixa o valor para preencher depois', async () => {
    const onSalvar = vi.fn().mockResolvedValue({ completo: true, mensagem: 'Unidade cadastrada.' });
    const tela = render(<InventoryComposer
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
      modelos={[{ id: 'm-1', nome: 'CBX Twister 250', parent_id: null, ordem: 0, ano: '2001 a 2008', imagem_url: null }]}
      onFechar={vi.fn()}
      onSalvar={vi.fn()}
    />);

    for (const input of screen.getAllByLabelText('Nome da Peça')) {
      fireEvent.change(input, { target: { value: 'Suporte de pedaleiras CBX Twister 250' } });
    }

    expect((screen.getByLabelText('Modelo e ano compatíveis') as HTMLSelectElement).value).toBe('m-1');
    expect((screen.getByLabelText('Ano compatível') as HTMLInputElement).value).toBe('2001 a 2008');
  });

  it('salva o modelo e o ano escolhidos de forma estruturada', async () => {
    const onSalvar = vi.fn().mockResolvedValue({ completo: true, mensagem: 'Unidade cadastrada.' });
    const modelos = [{ id: 'moto-titan', nome: 'CG 125 Titan', parent_id: null, ordem: 0, ano: '94 a 99', imagem_url: null }];
    const tela = render(<InventoryComposer
      aberto
      categorias={[{ id: 'cat-1', nome: 'Balanças' }] as any}
      pecas={[]}
      modelos={modelos}
      onFechar={vi.fn()}
      onSalvar={onSalvar}
    />);

    fireEvent.change(tela.getByLabelText('Nome da Peça'), { target: { value: 'Balança CG 125 Titan' } });
    fireEvent.change(tela.getByLabelText('Categoria'), { target: { value: 'cat-1' } });
    fireEvent.change(tela.getByLabelText('Modelo e ano compatíveis'), { target: { value: 'moto-titan' } });

    expect((tela.getByLabelText('Ano compatível') as HTMLInputElement).value).toBe('94 a 99');

    fireEvent.click(tela.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(tela.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(tela.getByRole('button', { name: /Próximo/ }));
    fireEvent.click(tela.getByRole('button', { name: 'Salvar unidade' }));

    await waitFor(() => expect(onSalvar).toHaveBeenCalledOnce());
    expect(onSalvar.mock.calls[0][0].novaPeca).toMatchObject({
      modeloMotoId: 'moto-titan',
      ano: '94 a 99',
      compatibilidades: ['CG 125 Titan · 94 a 99'],
    });
  });

  it('preenche o preço normal da peça e permite editar antes de salvar', async () => {
    const tela = render(<InventoryComposer
      aberto
      pecaInicialId="p-1"
      categorias={[{ id: 'cat-1', nome: 'Balanças' }] as any}
      pecas={[{ id: 'p-1', codigoLegado: 'RK-1', nome: 'Balança CG 125 Titan', categoriaId: 'cat-1', compatibilidades: ['CG 125 Titan · 94 a 99'], detalhes: '' }] as any}
      unidades={[
        { id: 'u-1', pecaId: 'p-1', preco: 180, estado: 'disponivel' },
        { id: 'u-2', pecaId: 'p-1', preco: 180, estado: 'disponivel' },
        { id: 'u-3', pecaId: 'p-1', preco: 130, estado: 'disponivel' },
      ] as any}
      onFechar={vi.fn()}
      onSalvar={vi.fn()}
    />);

    fireEvent.click(tela.getByRole('button', { name: 'Próximo' }));
    const preco = await tela.findByLabelText('Preço da unidade');
    expect((preco as HTMLInputElement).value).toBe('180');

    fireEvent.change(preco, { target: { value: '150' } });
    expect((preco as HTMLInputElement).value).toBe('150');
  });
});
