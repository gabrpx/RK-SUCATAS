// @vitest-environment jsdom
// Badges do VarianteCard (Fase 2A): "Novo" só aparece com item.novo === true,
// e "Paralela" usa o token roxo `info`. Os canais (ML/Shopee) e Original não
// mudaram — cobertos aqui só o suficiente pra garantir que não colidem.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VarianteCard } from './VarianteCard';
import type { Estoque } from '../types';

afterEach(cleanup);

vi.mock('../../../context/DataContext', () => ({
  useData: () => ({ refreshData: vi.fn() }),
}));
vi.mock('./api', () => ({ estoqueApi: { atualizarParcial: vi.fn() } }));
vi.mock('./UnidadeForm', () => ({ UnidadeForm: () => null }));
vi.mock('./UnidadeRow', () => ({ UnidadeRow: () => null }));

function itemBase(over: Partial<Estoque> = {}): Estoque {
  return {
    id: 'e1',
    codigo: 'C1',
    nome: 'Tanque CG 125',
    categoria_id: null,
    modelo_moto_id: null,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 0,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '',
    atualizado_em: '',
    unidades: [],
    ...over,
  } as Estoque;
}

describe('VarianteCard — badges', () => {
  it('não mostra "Novo" quando novo é false/ausente', () => {
    render(<VarianteCard item={itemBase({ novo: false })} />);
    expect(screen.queryByText('Novo')).toBeNull();
  });

  it('mostra "Novo" (azul) quando novo === true', () => {
    render(<VarianteCard item={itemBase({ novo: true })} />);
    const badge = screen.getByText('Novo');
    expect(badge.className).toContain('text-accent-alt');
    expect(badge.className).toContain('bg-accent-alt-bg');
  });

  it('"Paralela" usa o token roxo info', () => {
    render(<VarianteCard item={itemBase({ condicao: 'paralela' })} />);
    const badge = screen.getByText('Paralela');
    expect(badge.className).toContain('text-info');
    expect(badge.className).toContain('bg-info-bg');
  });

  it('"Original" continua no accent, sem roubar info', () => {
    render(<VarianteCard item={itemBase({ condicao: 'original' })} />);
    const badge = screen.getByText('Original');
    expect(badge.className).toContain('text-accent-soft-fg');
    expect(badge.className).not.toContain('text-info');
  });
});
