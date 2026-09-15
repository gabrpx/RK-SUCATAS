// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UnidadeRow } from './UnidadeRow';
import type { Estoque, EstoqueUnidade } from '../types';

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

  it('sem foto própria e sem foto legada da variante: marca "Sem foto" e não mostra imagem', () => {
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

    expect(screen.getByText(/Sem foto/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('sem foto própria mas com foto de referência na variante: continua sem imagem da unidade', () => {
    const variante = { imagens: ['legada.jpg'], valor: 350 } as Estoque;
    render(
      <UnidadeRow
        unidade={unidadeEmBranco()}
        numero={1}
        nomePadrao="Tanque CG 150"
        valorPadrao={350}
        notaPadrao={4}
        variante={variante}
        onAbrirFicha={vi.fn()}
      />
    );

    expect(screen.queryByRole('img', { name: /foto da unidade 1/i })).toBeNull();
    expect(screen.getByText(/Sem foto/)).toBeTruthy();
    expect(screen.getByText(/Foto de referência/)).toBeTruthy();
    expect(screen.getByText(/Ficha incompleta/)).toBeTruthy();
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
