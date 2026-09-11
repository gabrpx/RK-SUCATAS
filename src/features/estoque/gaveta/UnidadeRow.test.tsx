// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  it('mostra a peça legada como unidade real, com nome, foto e preço herdados', () => {
    const { container } = render(
      <UnidadeRow
        unidade={unidadeEmBranco()}
        numero={1}
        nomePadrao="Tanque CG 150 Carburada"
        valorPadrao={350}
        notaPadrao={4}
        fotoPadrao="https://exemplo/tanque.jpg"
        onEditar={vi.fn()}
      />
    );

    expect(screen.getByText(/Tanque CG 150 Carburada/i)).toBeTruthy();
    expect(screen.queryByText(/Cadastro mínimo/i)).toBeNull();
    expect(screen.getByText(/R\$\s*350,00/)).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://exemplo/tanque.jpg');
  });

  it('mantém cadastro mínimo para unidade rápida criada apenas com preço', () => {
    render(
      <UnidadeRow
        unidade={unidadeEmBranco({ valor: 275 })}
        numero={1}
        nomePadrao="Tanque CG 150"
        valorPadrao={350}
        notaPadrao={null}
        fotoPadrao="https://exemplo/tanque.jpg"
        onEditar={vi.fn()}
      />
    );

    expect(screen.getByText(/Cadastro mínimo/i)).toBeTruthy();
  });

  it('prioriza os dados próprios da unidade sobre os herdados', () => {
    const { container } = render(
      <UnidadeRow
        unidade={unidadeEmBranco({ nome: 'Vermelho', fotos: ['https://exemplo/propria.jpg'], valor: 400 })}
        numero={2}
        nomePadrao="Tanque CG 150"
        valorPadrao={350}
        notaPadrao={8}
        fotoPadrao="https://exemplo/padrao.jpg"
        onEditar={vi.fn()}
      />
    );

    expect(screen.getByText(/Vermelho/i)).toBeTruthy();
    expect(screen.getByText(/R\$\s*400,00/)).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://exemplo/propria.jpg');
  });
});
