// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UnidadeRow } from './UnidadeRow';
import type { EstoqueUnidade } from '../types';

afterEach(cleanup);

function unidadeEmBranco(over: Partial<EstoqueUnidade> = {}): EstoqueUnidade {
  return {
    id: 'u1', estoque_id: 'e1', nome: null, avaria: false,
    avaria_descricao: null, descricao: null, fotos: [], valor: null,
    condicao_nota: null, vendida_em: null, criado_em: '', atualizado_em: '', ...over,
  };
}

describe('UnidadeRow — dados herdados da variante', () => {
  it('abre a ficha ao selecionar a unidade, sem disparar edição', () => {
    const abrirFicha = vi.fn();
    render(
      <UnidadeRow
        unidade={unidadeEmBranco()}
        numero={1}
        nomePadrao="Tanque CG 150 Carburada"
        valorPadrao={350}
        notaPadrao={4}
        onAbrirFicha={abrirFicha}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /ver ficha da unidade 1/i }));
    expect(abrirFicha).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
  });

  it('não usa foto da variante como foto da unidade', () => {
    render(
      <UnidadeRow
        unidade={unidadeEmBranco()}
        numero={1}
        nomePadrao="Tanque CG 150"
        valorPadrao={350}
        notaPadrao={4}
        onAbrirFicha={vi.fn()}
      />
    );

    expect(screen.getByText(/Sem fotos/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('mostra a primeira foto própria e o total de fotos da unidade', () => {
    render(
      <UnidadeRow
        unidade={unidadeEmBranco({ fotos: ['a.jpg', 'b.jpg', 'c.jpg'] })}
        numero={1}
        nomePadrao="Tanque CG 150"
        valorPadrao={350}
        notaPadrao={4}
        onAbrirFicha={vi.fn()}
      />
    );

    expect(screen.getByRole('img', { name: /foto da unidade 1/i }).getAttribute('src')).toBe('a.jpg');
    expect(screen.getByText(/3 fotos/)).toBeTruthy();
  });
});
