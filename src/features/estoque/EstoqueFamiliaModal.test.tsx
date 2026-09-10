// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EstoqueFamiliaModal } from './EstoqueFamiliaModal';
import type { EstoqueLinha } from './familiaEstoque';
import type { Estoque, EstoqueFamilia, EstoqueUnidade } from './types';

afterEach(cleanup);

vi.mock('../../components/ui/image-zoom', () => ({
  ImageZoom: ({ src, alt }: any) => <img src={src} alt={alt} data-testid="image-zoom" />,
}));

vi.mock('./RegistrarUnidadeDialog', () => ({
  RegistrarUnidadeDialog: ({ open }: any) => (open ? <div data-testid="registrar-dialog" /> : null),
}));

function mockUnidade(overrides: Partial<EstoqueUnidade> = {}): EstoqueUnidade {
  return {
    id: 'u1', estoque_id: 'e1', nome: null, avaria: false, avaria_descricao: null,
    fotos: [], valor: null, condicao_nota: null, vendida_em: null,
    criado_em: '2026-01-01T00:00:00Z', atualizado_em: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockItem(overrides: Partial<Estoque> = {}): Estoque {
  return {
    id: 'e1', codigo: 'RK-0001', nome: 'Tanque de Combustível CG 150',
    categoria_id: null, modelo_moto_id: 'm1', condicao: 'original',
    condicao_nota: null, nota_cadastro: null, ano: null, valor: 400,
    quantidade: 2, imagens: [], descricao: null, ativo: true,
    criado_em: '2026-01-01T00:00:00Z', atualizado_em: '2026-01-01T00:00:00Z',
    anuncio_ml_url: null, anuncio_fb_url: null, componentes: null,
    unidades_incompletas: [], familia_id: 'f1', unidades: [],
    modelo_moto: { id: 'm1', nome: 'CG 150 Carburada', parent_id: null, ordem: 0, ano: '2004-2008', criado_em: '' } as any,
    ...overrides,
  };
}

const familia: EstoqueFamilia = {
  id: 'f1', nome: 'Tanque de Combustível CG 150',
  categoria_id: null, descricao: null, imagem_url: null,
  criado_em: '2026-01-01T00:00:00Z', atualizado_em: '2026-01-01T00:00:00Z',
};

describe('EstoqueFamiliaModal', () => {
  it('renders the family name as title', () => {
    const carb = mockItem({ id: 'a', quantidade: 2, unidades: [mockUnidade({ id: 'u1' }), mockUnidade({ id: 'u2' })] });
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [carb] };
    render(<EstoqueFamiliaModal linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('Tanque de Combustível CG 150')).toBeTruthy();
  });

  it('renders accordion groups ordered oldest first', () => {
    const titan = mockItem({ id: 'a', nome: 'Tanque CG 150 Titan 99',
      modelo_moto_id: 'm-titan',
      modelo_moto: { id: 'm-titan', nome: 'CG 150 Titan 99', parent_id: null, ordem: 0, ano: '1999', criado_em: '' } as any,
      quantidade: 1, unidades: [mockUnidade({ id: 'u-titan' })],
    });
    const inj = mockItem({ id: 'b', nome: 'Tanque CG 150 Injetada',
      modelo_moto_id: 'm-inj',
      modelo_moto: { id: 'm-inj', nome: 'CG 150 Injetada', parent_id: null, ordem: 0, ano: '2013-2015', criado_em: '' } as any,
      quantidade: 1, unidades: [mockUnidade({ id: 'u-inj' })],
    });
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [inj, titan] };
    render(<EstoqueFamiliaModal linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);

    const triggers = screen.getAllByRole('button', { name: /CG 150/ });
    expect(triggers.length).toBeGreaterThanOrEqual(2);
    // Titan 99 (1999) deve aparecer antes de Injetada (2013) no DOM
    const triggerTexts = triggers.map((t) => t.textContent ?? '');
    const idxTitan = triggerTexts.findIndex((t) => t.includes('Titan'));
    const idxInj = triggerTexts.findIndex((t) => t.includes('Injetada'));
    expect(idxTitan).toBeLessThan(idxInj);
  });

  it('shows "em estoque" metric as sum of child quantities', () => {
    const a = mockItem({ id: 'a', quantidade: 2, unidades: [mockUnidade({ id: 'u1' }), mockUnidade({ id: 'u2' })] });
    const b = mockItem({ id: 'b', modelo_moto_id: 'm2', modelo_moto: { id: 'm2', nome: 'CG 150 MIX', parent_id: null, ordem: 0, ano: '2009', criado_em: '' } as any,
      quantidade: 3, unidades: [mockUnidade({ id: 'u3' }), mockUnidade({ id: 'u4' }), mockUnidade({ id: 'u5' })],
    });
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [a, b] };
    render(<EstoqueFamiliaModal linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    // Em estoque = 2 + 3 = 5
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('renders a standalone item as a single group', () => {
    const item = mockItem({ familia_id: null, familia: null });
    const linha: EstoqueLinha = { tipo: 'avulso', id: item.id, item };
    render(<EstoqueFamiliaModal linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(item.nome)).toBeTruthy();
  });

  it('shows ImageZoom for unit foto when present', () => {
    const item = mockItem({
      id: 'a', quantidade: 1,
      unidades: [mockUnidade({ id: 'u1', fotos: ['https://example.com/peca.jpg'] })],
    });
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<EstoqueFamiliaModal linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    const zooms = screen.getAllByTestId('image-zoom');
    expect(zooms.length).toBeGreaterThanOrEqual(1);
    expect((zooms[0] as HTMLImageElement).src).toContain('peca.jpg');
  });

  it('shows gallery strip for item.imagens', () => {
    const item = mockItem({
      id: 'a', quantidade: 1,
      imagens: ['https://example.com/capa.jpg', 'https://example.com/lateral.jpg'],
      unidades: [mockUnidade({ id: 'u1' })],
    });
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<EstoqueFamiliaModal linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    const zooms = screen.getAllByTestId('image-zoom');
    const srcs = zooms.map((el) => (el as HTMLImageElement).src);
    expect(srcs.some((s) => s.includes('capa.jpg'))).toBe(true);
    expect(srcs.some((s) => s.includes('lateral.jpg'))).toBe(true);
  });
});
