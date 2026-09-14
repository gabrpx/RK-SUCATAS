// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdicionarPecasGaveta } from './AdicionarPecasGaveta';

afterEach(cleanup);

vi.mock('../../../context/DataContext', () => ({
  useData: () => ({
    estoque: [
      {
        id: 'p1',
        ativo: true,
        gaveta_id: null,
        nome: 'TAMPA DO CUBO TRASEIRO YES 125 ESPELHO DE FREIO',
        codigo: 'RK-0276',
        categoria: { nome: 'Tampa do cubo traseiro' },
        imagens: [],
        valor: 65,
      },
      {
        id: 'p2',
        ativo: true,
        gaveta_id: null,
        nome: 'RODA DIANTEIRA CG 125',
        codigo: 'RK-0277',
        categoria: { nome: 'Roda' },
        imagens: [],
        valor: 150,
      },
    ],
  }),
}));

vi.mock('./hooks', () => ({
  useMoverPecasGaveta: () => ({ moverEmLote: vi.fn(), loading: false }),
}));

describe('AdicionarPecasGaveta', () => {
  it('mantém o nome completo da peça e permite quebra de linha', () => {
    render(<AdicionarPecasGaveta gavetaId="g1" gavetaNome="Gaveta teste" onFechar={() => {}} />);

    const nome = screen.getByText('TAMPA DO CUBO TRASEIRO YES 125 ESPELHO DE FREIO');
    expect(nome.className).not.toContain('truncate');
    expect(nome.className).toContain('break-words');
  });

  it('seleciona todos os resultados de uma vez e mostra o contador', () => {
    render(<AdicionarPecasGaveta gavetaId="g1" gavetaNome="Gaveta teste" onFechar={() => {}} />);

    const selecionarTodos = screen.getByLabelText(/selecionar todos/i);
    fireEvent.click(selecionarTodos);

    // Botão de confirmar reflete o total selecionado (2 peças).
    expect(screen.getByRole('button', { name: /adicionar 2 peças/i })).toBeTruthy();
  });

  it('exibe um resumo do destino antes de mover', () => {
    render(<AdicionarPecasGaveta gavetaId="g1" gavetaNome="Gaveta teste" onFechar={() => {}} />);

    fireEvent.click(screen.getByLabelText(/selecionar todos/i));
    // Resumo cita a quantidade e o nome da gaveta destino (texto quebrado em
    // spans estilizados — casa pelo conteúdo normalizado do documento).
    const texto = document.body.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toMatch(/2 peças.*Gaveta teste/i);
  });
});
