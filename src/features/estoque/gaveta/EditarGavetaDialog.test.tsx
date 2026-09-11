// @vitest-environment jsdom
// EditarGavetaDialog (Fase 2A): pré-preenche os dados; bloqueia salvar com
// nome vazio; salvar manda o payload certo (categoria/ícone -> null quando
// vazios); excluir exige confirmação antes de chamar excluir().
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { EditarGavetaDialog } from './EditarGavetaDialog';
import type { Gaveta } from '../types';

afterEach(cleanup);

const atualizar = vi.fn();
const excluir = vi.fn();

vi.mock('../../../hooks/useCatalogos', () => ({
  useCatalogos: () => ({ categorias: [{ id: 'cat-1', nome: 'Tanques' }] }),
}));
vi.mock('./hooks', () => ({
  useAtualizarGaveta: () => ({ atualizar, loading: false, error: null }),
  useExcluirGaveta: () => ({ excluir, loading: false, error: null }),
}));

const gaveta: Gaveta = {
  id: 'g1',
  nome: 'Gaveta A',
  categoria_id: null,
  icone: null,
} as Gaveta;

beforeEach(() => {
  atualizar.mockReset().mockResolvedValue({ ...gaveta, nome: 'Gaveta A2' });
  excluir.mockReset().mockResolvedValue(undefined);
});

describe('EditarGavetaDialog', () => {
  it('pré-preenche o nome da gaveta', () => {
    render(<EditarGavetaDialog gaveta={gaveta} qtdPecas={0} onFechar={() => {}} />);
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Gaveta A');
  });

  it('bloqueia salvar quando o nome fica vazio', () => {
    render(<EditarGavetaDialog gaveta={gaveta} qtdPecas={0} onFechar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  ' } });
    const salvar = screen.getByRole('button', { name: /salvar alterações/i }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(true);
    expect(atualizar).not.toHaveBeenCalled();
  });

  it('salvar envia nome/categoria/ícone (vazios viram null)', async () => {
    const onFechar = vi.fn();
    render(<EditarGavetaDialog gaveta={gaveta} qtdPecas={0} onFechar={onFechar} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Gaveta A2' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar alterações/i }));
    await vi.waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1));
    expect(atualizar).toHaveBeenCalledWith('g1', { nome: 'Gaveta A2', categoria_id: null, icone: null });
  });

  it('excluir só dispara depois da confirmação', async () => {
    render(<EditarGavetaDialog gaveta={gaveta} qtdPecas={3} onFechar={() => {}} />);
    // 1º clique: abre confirmação, não chama excluir
    fireEvent.click(screen.getByRole('button', { name: /excluir gaveta/i }));
    expect(excluir).not.toHaveBeenCalled();
    // a confirmação explica que as peças voltam pra "Itens não agrupados"
    expect(screen.getByText(/voltam para "Itens não agrupados"/i)).toBeTruthy();
    // 2º clique: confirma
    fireEvent.click(screen.getByRole('button', { name: /excluir gaveta/i }));
    await vi.waitFor(() => expect(excluir).toHaveBeenCalledWith('g1'));
  });
});
