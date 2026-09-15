// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstoqueItemExpandido } from './EstoqueItemExpandido';
import type { Estoque } from './types';
import type { Categoria } from '../../types/catalog';

function criarItem(overrides: Partial<Estoque> & Pick<Estoque, 'id' | 'nome'>): Estoque {
  return {
    codigo: `RK-${overrides.id}`,
    categoria_id: null,
    modelo_moto_id: null,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    ...overrides,
  };
}

describe('EstoqueItemExpandido', () => {
  afterEach(() => cleanup());

  it('mostra o caminho completo da categoria', () => {
    const categorias: Categoria[] = [
      { id: 'raiz', nome: 'Elétrica', parent_id: null, ordem: 0 },
      { id: 'filha', nome: 'CDI', parent_id: 'raiz', ordem: 0 },
    ];
    const item = criarItem({ id: 'a', nome: 'CDI Titan', categoria_id: 'filha' });
    render(<EstoqueItemExpandido item={item} categorias={categorias} />);
    expect(screen.getByText('Elétrica › CDI')).toBeTruthy();
  });

  it('lista avarias das unidades marcadas, com nome e descrição', () => {
    const item = criarItem({
      id: 'a',
      nome: 'TBI',
      unidades: [
        { id: 'u1', estoque_id: 'a', nome: 'A amassada', avaria: true, avaria_descricao: 'Bico torto', descricao: null, fotos: [], valor: null, condicao_nota: null, criado_em: '', atualizado_em: '' },
        { id: 'u2', estoque_id: 'a', nome: null, avaria: false, avaria_descricao: null, descricao: null, fotos: [], valor: null, condicao_nota: null, criado_em: '', atualizado_em: '' },
      ],
    });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    expect(screen.getByText('A amassada: Bico torto')).toBeTruthy();
  });

  it('mostra "Nenhum anúncio vinculado" quando não há ML nem Facebook', () => {
    const item = criarItem({ id: 'a', nome: 'Peça sem anúncio' });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: /anúncios/i }));
    expect(screen.getByText('Nenhum anúncio vinculado.')).toBeTruthy();
  });

  it('lista o link do Mercado Livre quando existe', () => {
    const item = criarItem({
      id: 'a',
      nome: 'Peça com ML',
      links_ml: [{ id: 'l1', estoque_id: 'a', url: 'https://ml/1', mlb_id: 'MLB1', criado_em: '', atualizado_em: '' }],
    });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    fireEvent.click(screen.getByRole('tab', { name: /anúncios/i }));
    expect(screen.getByText(/Mercado Livre/)).toBeTruthy();
  });

  it('mostra "Sem fotos" quando a peça não tem nenhuma imagem', () => {
    const item = criarItem({ id: 'a', nome: 'Peça sem foto', imagens: [] });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    expect(screen.getByText('Sem fotos de referência')).toBeTruthy();
  });

  it('abre e permite editar uma ficha individual pela aba Unidades', () => {
    const item = criarItem({
      id: 'a',
      nome: 'Mesa completa CG 125',
      quantidade: 1,
      unidades: [
        {
          id: 'u1', estoque_id: 'a', nome: null, avaria: false, avaria_descricao: null,
          descricao: null, fotos: [], valor: null, condicao_nota: null, vendida_em: null,
          criado_em: '', atualizado_em: '',
        },
      ],
    });

    render(<EstoqueItemExpandido item={item} categorias={[]} />);

    fireEvent.click(screen.getByRole('tab', { name: /unidades/i }));
    fireEvent.click(screen.getByRole('button', { name: /ver ficha da unidade 1/i }));
    expect(screen.getByRole('heading', { name: /ficha da unidade 1/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /editar unidade/i }));
    expect(screen.getByRole('heading', { name: /editar unidade/i })).toBeTruthy();
  });
});
