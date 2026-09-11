// @vitest-environment jsdom
// Badges do VarianteCard (Fase 2A): "Novo" só aparece com item.novo === true,
// e "Paralela" usa o token roxo `info`. Os canais (ML/Shopee) e Original não
// mudaram — cobertos aqui só o suficiente pra garantir que não colidem.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VarianteCard } from './VarianteCard';
import type { Estoque } from '../types';

const { atualizarParcial, refreshData } = vi.hoisted(() => ({
  atualizarParcial: vi.fn(),
  refreshData: vi.fn(),
}));

afterEach(() => {
  cleanup();
  atualizarParcial.mockReset();
  refreshData.mockReset();
});

vi.mock('../../../context/DataContext', () => ({
  useData: () => ({ refreshData }),
}));
vi.mock('../api', () => ({ estoqueApi: { atualizarParcial } }));
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

describe('VarianteCard — nome organizacional', () => {
  it('permite corrigir o nome da variante sem enviar outros campos da peça', async () => {
    atualizarParcial.mockResolvedValue({ success: true, data: {} });
    refreshData.mockResolvedValue(undefined);
    render(<VarianteCard item={itemBase({ nome: 'Tanque CG 150 Mix (Avaria)' })} />);

    fireEvent.click(screen.getByRole('button', { name: /editar nome da variante/i }));
    const input = screen.getByRole('textbox', { name: /nome da variante/i });
    expect((input as HTMLInputElement).value).toBe('Tanque CG 150 Mix');
    fireEvent.change(input, { target: { value: 'Tanque CG 150 MIX' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar nome da variante/i }));

    await vi.waitFor(() => expect(atualizarParcial).toHaveBeenCalledWith('e1', { nome: 'Tanque CG 150 MIX' }));
    expect(refreshData).toHaveBeenCalledTimes(1);
  });
});
