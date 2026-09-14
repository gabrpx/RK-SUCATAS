// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UnidadeDetailDialog } from './UnidadeDetailDialog';
import type { Estoque, EstoqueUnidade } from '../types';

afterEach(cleanup);

const unidade: EstoqueUnidade = {
  id: 'u2', estoque_id: 'e1', nome: 'A amassada', avaria: true,
  avaria_descricao: 'Amassado no lado esquerdo', descricao: 'Peça retirada de moto',
  fotos: ['a.jpg', 'b.jpg', 'c.jpg'], valor: 275, condicao_nota: 3,
  vendida_em: null, criado_em: '', atualizado_em: '',
};

const variante = {
  nome: 'Tanque CG 150', valor: 350, condicao_nota: 8,
  ano: '2004-2008', imagens: [],
} as Pick<Estoque, 'nome' | 'ano' | 'valor' | 'condicao_nota' | 'imagens'>;

describe('UnidadeDetailDialog', () => {
  it('mostra a ficha de consulta usando apenas as fotos efetivas da unidade', () => {
    render(
      <UnidadeDetailDialog
        aberto
        unidade={unidade}
        numero={2}
        variante={variante}
        onFechar={vi.fn()}
        onEditar={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /ficha da unidade 2/i })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /foto da unidade 2/i })).toHaveLength(3);
    expect(screen.queryByText(/fotos de referência da variante/i)).toBeNull();
    expect(screen.getByRole('button', { name: /editar unidade/i })).toBeTruthy();
  });

  it('lista as pendências da ficha e oferece "Completar ficha"', () => {
    // unidade com avaria => pendência com_avaria.
    render(
      <UnidadeDetailDialog aberto unidade={unidade} numero={2} variante={variante} onFechar={vi.fn()} onEditar={vi.fn()} />
    );
    expect(screen.getByText(/Pendências desta ficha/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /completar ficha/i })).toBeTruthy();
  });

  it('não mostra bloco de pendências para uma ficha completa', () => {
    const completa: EstoqueUnidade = { ...unidade, id: 'u3', avaria: false, avaria_descricao: null, fotos: ['x.jpg'], valor: 275 };
    render(
      <UnidadeDetailDialog aberto unidade={completa} numero={1} variante={variante} onFechar={vi.fn()} onEditar={vi.fn()} />
    );
    expect(screen.queryByText(/Pendências desta ficha/i)).toBeNull();
  });
});
