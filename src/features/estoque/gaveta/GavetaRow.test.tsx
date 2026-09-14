// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GavetaRow } from './GavetaRow';

afterEach(() => cleanup());

describe('GavetaRow — nomes responsivos', () => {
  it('mantém o nome completo disponível para quebra no mobile', () => {
    render(
      <GavetaRow
        gaveta={{
          id: 'g1',
          nome: 'TAMPA DO CUBO TRASEIRO CBX TWISTER 250 COM ESPELHO DE FREIO',
          categoria_id: null,
          icone: null,
          criado_em: '',
          atualizado_em: '',
        }}
        itens={[]}
        onClick={vi.fn()}
      />,
    );

    const nome = screen.getByText('TAMPA DO CUBO TRASEIRO CBX TWISTER 250 COM ESPELHO DE FREIO');
    expect(nome.className).toContain('break-words');
    expect(nome.className).not.toContain('truncate');
  });
});
