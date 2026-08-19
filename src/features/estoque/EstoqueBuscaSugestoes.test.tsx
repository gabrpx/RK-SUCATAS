// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstoqueBuscaSugestoes } from './EstoqueBuscaSugestoes';
import type { Estoque } from './types';

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

describe('EstoqueBuscaSugestoes', () => {
  afterEach(() => cleanup());

  it('não mostra sugestões enquanto o campo não está focado', () => {
    const item = criarItem({ id: 'a', nome: 'CDI Titan 150' });
    render(<EstoqueBuscaSugestoes value="cdi" onChange={() => {}} sugestoes={[item]} onSelecionar={() => {}} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('mostra sugestões ao focar o campo com texto e itens disponíveis', () => {
    const item = criarItem({ id: 'a', nome: 'CDI Titan 150' });
    render(<EstoqueBuscaSugestoes value="cdi" onChange={() => {}} sugestoes={[item]} onSelecionar={() => {}} />);

    fireEvent.focus(screen.getByRole('combobox'));

    expect(screen.getByText('CDI Titan 150')).toBeTruthy();
  });

  it('não mostra sugestões se o campo estiver vazio, mesmo focado', () => {
    render(<EstoqueBuscaSugestoes value="" onChange={() => {}} sugestoes={[]} onSelecionar={() => {}} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clicar numa sugestão chama onSelecionar com a peça', () => {
    const item = criarItem({ id: 'a', nome: 'CDI Titan 150' });
    const onSelecionar = vi.fn();
    render(<EstoqueBuscaSugestoes value="cdi" onChange={() => {}} sugestoes={[item]} onSelecionar={onSelecionar} />);
    fireEvent.focus(screen.getByRole('combobox'));

    fireEvent.mouseDown(screen.getByText('CDI Titan 150'));

    expect(onSelecionar).toHaveBeenCalledWith(item);
  });

  it('digitar chama onChange com o novo valor', () => {
    const onChange = vi.fn();
    render(<EstoqueBuscaSugestoes value="" onChange={onChange} sugestoes={[]} onSelecionar={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'farol' } });
    expect(onChange).toHaveBeenCalledWith('farol');
  });
});
