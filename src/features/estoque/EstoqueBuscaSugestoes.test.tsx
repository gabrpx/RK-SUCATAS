// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

// Navegação por teclado: quem não usa mouse precisa percorrer as sugestões e
// escolher a peça sem nunca tirar o foco do input (padrão combobox — o foco
// fica no campo e a opção corrente é anunciada por aria-activedescendant).
describe('EstoqueBuscaSugestoes — teclado', () => {
  afterEach(() => cleanup());

  const sugestoes = [
    criarItem({ id: 'a', nome: 'Cabeçote' }),
    criarItem({ id: 'b', nome: 'Carburador' }),
    criarItem({ id: 'c', nome: 'Cilindro' }),
  ];

  function montar(onSelecionar = vi.fn()) {
    render(<EstoqueBuscaSugestoes value="c" onChange={() => {}} sugestoes={sugestoes} onSelecionar={onSelecionar} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    return { input, onSelecionar };
  }

  it('seta pra baixo aponta o aria-activedescendant pra primeira opção', () => {
    const { input } = montar();
    expect(input.getAttribute('aria-activedescendant')).toBeNull();

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    const ativo = input.getAttribute('aria-activedescendant');
    expect(ativo).toBeTruthy();
    expect(document.getElementById(ativo!)?.textContent).toContain('Cabeçote');
  });

  it('seta pra cima a partir do nada vai pro último item (dá a volta)', () => {
    const { input } = montar();

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    const ativo = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(ativo!)?.textContent).toContain('Cilindro');
  });

  it('Enter escolhe a opção destacada', () => {
    const { input, onSelecionar } = montar();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelecionar).toHaveBeenCalledWith(sugestoes[1]);
  });

  it('Enter sem nada destacado não escolhe peça nenhuma (a busca segue normal)', () => {
    const { input, onSelecionar } = montar();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelecionar).not.toHaveBeenCalled();
  });

  it('Escape fecha a lista', async () => {
    const { input } = montar();
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });

    // waitFor: a lista só sai do DOM quando a animação de saída termina.
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });
});
