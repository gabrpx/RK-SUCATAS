// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EstoqueFundirFamiliasModal } from './EstoqueFundirFamiliasModal';
import type { Estoque } from './types';

afterEach(cleanup);

vi.mock('./api', () => ({
  estoqueApi: { atualizar: vi.fn() },
  estoqueFamiliasApi: { criar: vi.fn() },
}));

vi.mock('../../components/animate-ui/components/radix/dialog', () => ({
  DialogContent: ({ open, children }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogCloseButton: () => null,
}));

vi.mock('../../components/ui/hooks/useConfirm', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

function mockItem(overrides: Partial<Estoque> = {}): Estoque {
  return {
    id: 'e1', codigo: 'RK-001', nome: 'Tanque CG 150 Carburada',
    categoria_id: null, modelo_moto_id: null, condicao: 'original',
    condicao_nota: null, nota_cadastro: null, ano: null, valor: 400,
    quantidade: 1, imagens: [], descricao: null, ativo: true,
    criado_em: '2026-01-01T00:00:00Z', atualizado_em: '2026-01-01T00:00:00Z',
    anuncio_ml_url: null, anuncio_fb_url: null, componentes: null,
    unidades_incompletas: [], familia_id: null, unidades: [],
    ...overrides,
  };
}

describe('EstoqueFundirFamiliasModal', () => {
  it('mostra mensagem quando não há sugestões', () => {
    render(<EstoqueFundirFamiliasModal itensAvulsos={[mockItem()]} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(/Nenhuma sugestão de fusão/)).toBeTruthy();
  });

  it('sugere grupo para nomes similares', () => {
    const a = mockItem({ id: 'a', nome: 'Tanque CG 150 Carburada' });
    const b = mockItem({ id: 'b', nome: 'Tanque CG 150 Injetada' });
    render(<EstoqueFundirFamiliasModal itensAvulsos={[a, b]} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    // Deve exibir pelo menos um grupo sugerido (botão de fundir visível)
    expect(screen.getByRole('button', { name: /Criar famílias/i })).toBeTruthy();
  });

  it('não sugere grupo para nomes muito distintos', () => {
    const a = mockItem({ id: 'a', nome: 'Tanque CG 150' });
    const b = mockItem({ id: 'b', nome: 'Farol Titan 160' });
    render(<EstoqueFundirFamiliasModal itensAvulsos={[a, b]} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(/Nenhuma sugestão/)).toBeTruthy();
  });

  it('exibe nomes dos itens nos grupos sugeridos', () => {
    const a = mockItem({ id: 'a', nome: 'Tanque CG 150 Carburada' });
    const b = mockItem({ id: 'b', nome: 'Tanque CG 150 Injetada' });
    render(<EstoqueFundirFamiliasModal itensAvulsos={[a, b]} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('Tanque CG 150 Carburada')).toBeTruthy();
    expect(screen.getByText('Tanque CG 150 Injetada')).toBeTruthy();
  });

  it('sugere o prefixo comum como nome do grupo, não o nome mais longo/sujo', () => {
    // Caso real reportado: pegar o nome mais longo puxava "(Avaria)"/"MIX"
    // pro nome da família — o prefixo comum às 3 fichas é o nome limpo.
    const a = mockItem({ id: 'a', nome: 'TANQUE DE COMBUSTÍVEL CG 150 CARBURADA' });
    const b = mockItem({ id: 'b', nome: 'TANQUE DE COMBUSTÍVEL CG 150 MIX (Avaria)' });
    const c = mockItem({ id: 'c', nome: 'TANQUE DE COMBUSTÍVEL CG 150 START' });
    render(<EstoqueFundirFamiliasModal itensAvulsos={[a, b, c]} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByDisplayValue('TANQUE DE COMBUSTÍVEL CG 150')).toBeTruthy();
  });

  it('cai pro nome mais longo quando não há prefixo comum suficiente', () => {
    const a = mockItem({ id: 'a', nome: 'Guidão Completo Traxx Star' });
    const b = mockItem({ id: 'b', nome: 'Escapamento Completo Traxx Star' });
    render(<EstoqueFundirFamiliasModal itensAvulsos={[a, b]} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByDisplayValue('Escapamento Completo Traxx Star')).toBeTruthy();
  });
});
