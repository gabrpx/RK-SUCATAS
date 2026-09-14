// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ItensNaoAgrupadosFila } from './ItensNaoAgrupadosFila';
import type { Estoque, Gaveta } from '../types';

afterEach(cleanup);

const moverEmLote = vi.fn(async () => ({ sucesso: ['p1', 'p2'], falhas: [] as { id: string; error: string }[] }));
vi.mock('./hooks', () => ({
  useMoverPecasGaveta: () => ({ moverEmLote, loading: false }),
  useCriarGaveta: () => ({ criar: vi.fn(), loading: false, error: null }),
}));
vi.mock('../../../hooks/useCatalogos', () => ({ useCatalogos: () => ({ categorias: [] }) }));

const item = (id: string, nome: string): Estoque => ({
  id, codigo: id.toUpperCase(), nome, categoria_id: null, modelo_moto_id: null,
  condicao: 'original', condicao_nota: null, nota_cadastro: null, ano: null,
  valor: 10, quantidade: 1, imagens: [], descricao: null, ativo: true,
  criado_em: '', atualizado_em: '', anuncio_ml_url: null, anuncio_fb_url: null,
  componentes: null, unidades_incompletas: [], gaveta_id: null, unidades: [],
});

const gaveta = (id: string, nome: string): Gaveta => ({
  id, nome, categoria_id: null, icone: null, criado_em: '', atualizado_em: '',
});

describe('ItensNaoAgrupadosFila', () => {
  const itens = [item('p1', 'CAIXA DE MARCHA CG 160'), item('p2', 'ARANHA XTZ 125X')];
  const gavetas = [gaveta('g1', 'Rodas'), gaveta('g2', 'Tanques')];

  it('mostra o contador de itens aguardando organização', () => {
    render(<ItensNaoAgrupadosFila itens={itens} gavetas={gavetas} />);
    expect(screen.getByText(/itens não agrupados/i)).toBeTruthy();
    expect(screen.getByText(/2 aguardando organização/i)).toBeTruthy();
  });

  it('permite selecionar vários e mover para uma gaveta existente em lote', async () => {
    render(<ItensNaoAgrupadosFila itens={itens} gavetas={gavetas} />);

    fireEvent.click(screen.getByLabelText(/selecionar CAIXA DE MARCHA CG 160/i));
    fireEvent.click(screen.getByLabelText(/selecionar ARANHA XTZ 125X/i));

    // Barra de ação com contador.
    expect(screen.getByText(/2 selecionad/i)).toBeTruthy();

    // Abre o seletor de destino e escolhe uma gaveta.
    fireEvent.click(screen.getByRole('button', { name: /mover para gaveta/i }));
    const dialogo = screen.getByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: /Tanques/i }));

    expect(moverEmLote).toHaveBeenCalledWith(['p1', 'p2'], 'g2');
  });
});
