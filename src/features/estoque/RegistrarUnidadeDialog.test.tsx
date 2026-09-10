// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { RegistrarUnidadeDialog } from './RegistrarUnidadeDialog';
import type { EstoqueLinha } from './familiaEstoque';
import type { Estoque, EstoqueFamilia, EstoqueUnidade } from './types';

afterEach(cleanup);

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogos: () => ({
    modelos: [],
    criarNoMoto: vi.fn(),
    categorias: [],
    criarCategoria: vi.fn(),
  }),
}));

vi.mock('./api', () => ({
  estoqueApi: {
    criar: vi.fn(),
    listarUnidades: vi.fn(),
    atualizarUnidade: vi.fn(),
  },
  uploadImagemEstoque: vi.fn().mockResolvedValue({ success: true, url: 'https://example.com/foto.jpg' }),
}));

vi.mock('../../utils/comprimirImagem', () => ({
  comprimirImagem: vi.fn().mockImplementation((f: File) =>
    Promise.resolve({ arquivo: f, comprimido: false, bytesAntes: 100, bytesDepois: 100 })
  ),
  formatarBytes: (b: number) => `${b}B`,
}));

vi.mock('./EstoqueUploadFotos', () => ({
  EstoqueUploadFotos: ({ imagens }: any) => (
    <div data-testid="upload-fotos">
      {imagens.map((url: string) => <span key={url}>{url}</span>)}
    </div>
  ),
}));

vi.mock('../../components/animate-ui/components/radix/dialog', () => ({
  DialogContent: ({ open, children }: any) => (open ? <div role="dialog">{children}</div> : null),
  DialogCloseButton: () => null,
}));

vi.mock('../../components/MotoCascadeSelect', () => ({
  MotoCascadeSelect: ({ value, onChange }: any) => (
    <select data-testid="moto-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sem modelo</option>
      <option value="m1">CG 150</option>
    </select>
  ),
}));

function mockItem(overrides: Partial<Estoque> = {}): Estoque {
  return {
    id: 'e1', codigo: 'RK-001', nome: 'Tanque CG 150',
    categoria_id: null, modelo_moto_id: 'm1', condicao: 'original',
    condicao_nota: null, nota_cadastro: null, ano: null, valor: 400,
    quantidade: 1, imagens: [], descricao: null, ativo: true,
    criado_em: '2026-01-01T00:00:00Z', atualizado_em: '2026-01-01T00:00:00Z',
    anuncio_ml_url: null, anuncio_fb_url: null, componentes: null,
    unidades_incompletas: [], familia_id: 'f1', unidades: [],
    modelo_moto: { id: 'm1', nome: 'CG 150 Carburada', parent_id: null, ordem: 0, ano: '2004', criado_em: '' } as any,
    ...overrides,
  };
}

function mockUnidade(overrides: Partial<EstoqueUnidade> = {}): EstoqueUnidade {
  return {
    id: 'u1', estoque_id: 'e1', nome: 'Boa', avaria: false, avaria_descricao: null,
    fotos: ['https://example.com/foto.jpg'], valor: 250, condicao_nota: 8, vendida_em: null,
    criado_em: '2026-01-01T00:00:00Z', atualizado_em: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const familia: EstoqueFamilia = {
  id: 'f1', nome: 'Tanque CG 150', categoria_id: null, descricao: null, imagem_url: null,
  criado_em: '2026-01-01T00:00:00Z', atualizado_em: '2026-01-01T00:00:00Z',
};

describe('RegistrarUnidadeDialog', () => {
  it('renders step 1 with existing group and Novo option', () => {
    const item = mockItem();
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<RegistrarUnidadeDialog linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('Passo 1 — Modelo/ano')).toBeTruthy();
    expect(screen.getByText(/CG 150 Carburada/)).toBeTruthy();
    expect(screen.getByText(/Novo modelo\/ano/)).toBeTruthy();
  });

  it('advances to step 2 with upload area', () => {
    const item = mockItem();
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<RegistrarUnidadeDialog linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Próximo/i }));
    expect(screen.getByText('Passo 2 — Dados da unidade')).toBeTruthy();
    expect(screen.getByTestId('upload-fotos')).toBeTruthy();
  });

  it('shows error if photo is empty on save', async () => {
    const item = mockItem();
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<RegistrarUnidadeDialog linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Próximo/i }));
    fireEvent.click(screen.getByRole('button', { name: /Registrar/i }));
    expect(await screen.findByText(/Foto é obrigatória/)).toBeTruthy();
  });

  it('renders for avulso item as single group', () => {
    const item = mockItem({ familia_id: null, familia: null });
    const linha: EstoqueLinha = { tipo: 'avulso', id: item.id, item };
    render(<RegistrarUnidadeDialog linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText('Passo 1 — Modelo/ano')).toBeTruthy();
  });

  it('edit mode: opens directly at step 2 with pre-filled nome', () => {
    const item = mockItem();
    const unidade = mockUnidade({ nome: 'Com trinca', valor: 250, condicao_nota: 8 });
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<RegistrarUnidadeDialog linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} unidadeParaEditar={unidade} />);
    expect(screen.getByText('Passo 2 — Dados da unidade')).toBeTruthy();
    expect(screen.getByDisplayValue('Com trinca')).toBeTruthy();
  });

  it('edit mode: shows Salvar button instead of Registrar', () => {
    const item = mockItem();
    const unidade = mockUnidade();
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<RegistrarUnidadeDialog linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} unidadeParaEditar={unidade} />);
    expect(screen.queryByRole('button', { name: /^Registrar$/i })).toBeFalsy();
    expect(screen.getByRole('button', { name: /^Salvar$/i })).toBeTruthy();
  });

  it('edit mode: pre-fills fotos in upload area', () => {
    const item = mockItem();
    const unidade = mockUnidade({ fotos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] });
    const linha: EstoqueLinha = { tipo: 'familia', id: 'familia-f1', familia, itens: [item] };
    render(<RegistrarUnidadeDialog linha={linha} open onClose={vi.fn()} onRefresh={vi.fn()} unidadeParaEditar={unidade} />);
    expect(screen.getByText('https://example.com/a.jpg')).toBeTruthy();
    expect(screen.getByText('https://example.com/b.jpg')).toBeTruthy();
  });
});
