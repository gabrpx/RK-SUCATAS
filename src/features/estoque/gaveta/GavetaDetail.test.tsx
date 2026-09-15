// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GavetaDetail } from './GavetaDetail';

vi.mock('../../../context/DataContext', () => ({
  useData: () => ({
    estoque: [
      {
        id: 'e1', codigo: 'RK-1', nome: 'Mesa completa CG 125', categoria_id: null,
        modelo_moto_id: null, condicao: 'original', condicao_nota: null, nota_cadastro: null,
        ano: null, valor: 120, quantidade: 1, imagens: [], descricao: null, ativo: true,
        criado_em: '', atualizado_em: '', anuncio_ml_url: null, anuncio_fb_url: null,
        componentes: null, unidades_incompletas: [], gaveta_id: 'g1', unidades: [],
      },
    ],
  }),
}));

vi.mock('./hooks', () => ({
  useGavetas: () => ({
    gavetas: [{ id: 'g1', nome: 'Mesa CG 125', categoria_id: null, icone: null, criado_em: '', atualizado_em: '' }],
    setGavetas: vi.fn(),
    loading: false,
  }),
  useAtualizarGaveta: () => ({ atualizar: vi.fn(), loading: false }),
  useMoverPecaGaveta: () => ({ mover: vi.fn() }),
}));

vi.mock('./VarianteCard', () => ({ VarianteCard: () => <div>Variante</div> }));
vi.mock('./AdicionarPecasGaveta', () => ({ AdicionarPecasGaveta: () => null }));
vi.mock('./EditarGavetaDialog', () => ({ EditarGavetaDialog: () => null }));
vi.mock('./GavetaSkeletons', () => ({ GavetaDetailSkeleton: () => null }));
vi.mock('./EstadosGaveta', () => ({ OfflineBar: () => null }));
vi.mock('./PendenciaBadges', () => ({ ResumoPendenciasChips: () => null }));
vi.mock('./FilterChips', () => ({ FiltrosRapidosChips: () => null }));

afterEach(cleanup);

describe('GavetaDetail — ordenação', () => {
  it('substitui o select nativo por DropdownMenu animado', async () => {
    render(<GavetaDetail gavetaId="g1" />);

    expect(screen.queryByRole('combobox', { name: /ordenar variantes/i })).toBeNull();
    const trigger = screen.getByRole('button', { name: /ordenar variantes/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Quantidade' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ordenar variantes/i }).textContent).toContain('Quantidade');
    });
  });
});
