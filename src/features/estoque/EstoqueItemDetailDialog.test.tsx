// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EstoqueItemDetailDialog } from './EstoqueItemDetailDialog';
import type { Estoque } from './types';

afterEach(cleanup);

const item = {
  id: 'e1', codigo: 'RK-1', nome: 'Discos de embreagem CG 150', categoria_id: null,
  modelo_moto_id: null, condicao: 'original', condicao_nota: 8, nota_cadastro: null,
  ano: '2004-2015', valor: 60, quantidade: 8, imagens: [], descricao: 'Peça revisada',
  ativo: true, criado_em: '', atualizado_em: '', unidades: [], links_ml: [],
} as Estoque;

describe('EstoqueItemDetailDialog', () => {
  it('abre uma ficha nova para item não agrupado, sem usar o modal legado', () => {
    render(<EstoqueItemDetailDialog aberto item={item} categorias={[]} onFechar={vi.fn()} onEditar={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /detalhes do item/i })).toBeTruthy();
    expect(screen.getByText(/item não agrupado/i)).toBeTruthy();
    expect(screen.getByText('Discos de embreagem CG 150')).toBeTruthy();
    expect(screen.getByRole('button', { name: /editar item/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /whatsapp/i })).toBeNull();
  });
});
