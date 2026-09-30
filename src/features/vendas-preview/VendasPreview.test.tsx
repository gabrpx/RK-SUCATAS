// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  vendas: vi.fn(),
  caixa: vi.fn(),
  pendencias: vi.fn(),
  recebimentosPendencia: vi.fn(),
  fiado: vi.fn(),
  pode: vi.fn(() => true),
}));

vi.mock('@/src/hooks/usePermissao', () => ({ podeAtual: mocks.pode }));
vi.mock('@/src/features/vendas/api', () => ({ vendasApi: { listar: mocks.vendas } }));
vi.mock('@/src/features/caixa/api', () => ({
  caixaApi: { listar: mocks.caixa },
  caixaPendenciasApi: { listar: mocks.pendencias, listarRecebimentos: mocks.recebimentosPendencia },
}));
vi.mock('@/src/features/fiado/api', () => ({ fiadoApi: { listarRecebimentos: mocks.fiado } }));
vi.mock('@/src/features/vendas/VendasView', () => ({ NovaVendaDrawer: () => null }));
vi.mock('./components/SalesCharts', () => ({
  SalesTrendChart: () => <div data-testid="sales-chart" />,
  CashFlowChart: () => <div data-testid="cash-chart" />,
}));
vi.mock('./components/OverviewMetrics', () => ({ OverviewMetrics: () => <div data-testid="overview-metrics" /> }));
vi.mock('./components/SaleDetailDrawer', () => ({
  SaleDetailDrawer: ({ sale }: { sale: { id: string } | null }) => sale ? <div role="dialog">Detalhe {sale.id}</div> : null,
}));
vi.mock('./components/PendingEditDrawer', () => ({
  PendingEditDrawer: ({ pending }: { pending: { id: string } | null }) => pending ? <div role="dialog">Editar {pending.id}</div> : null,
}));
vi.mock('dot-anime-react', () => ({ DotMatrix: () => <span data-testid="dot-matrix" /> }));
vi.mock('animejs', () => ({ animate: () => ({ pause: vi.fn() }), stagger: () => 0 }));
vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: (_target, tag: string) => {
    const Component = ({ children, initial, animate, exit, transition, layout, layoutId, ...props }: any) => {
      const Tag = tag as any;
      return <Tag {...props}>{children}</Tag>;
    };
    return Component;
  } }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  MotionConfig: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

import { VendasPreview } from './VendasPreview';

const ok = <T,>(data: T) => Promise.resolve({ success: true, data });
const dateAt = (daysAgo: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const venda = (extra: Record<string, unknown> = {}) => ({
  id: 'venda-1', estoque_id: 'estoque-1', nome_item: 'Farol CG 160', quantidade: 1,
  valor_unitario: 100, valor_total: 100, forma_pagamento_id: 'pix',
  forma_pagamento: { id: 'pix', nome: 'Pix', natureza: 'avista' }, modelo_moto_id: null,
  modelo_moto: null, cliente_nome: 'Ana', cliente_id: null, cliente: null, observacoes: null,
  componente_vendido: null, unidade_id: 'unidade-1',
  unidade: { id: 'unidade-1', estoque_id: 'estoque-1', sku: 101, nome: 'Boa', avaria: false, avaria_descricao: null, descricao: null, fotos: [], valor: 100, condicao_nota: 8, criado_em: dateAt(5), atualizado_em: dateAt(5) },
  data: dateAt(2), criado_em: dateAt(2), canal: 'balcao', ml_order_id: null, ml_item_id: null, ml_shipping_id: null,
  ...extra,
});

const movimento = (id: string, valor: number, daysAgo: number) => ({
  id, tipo: 'entrada', descricao: `Entrada ${id}`, valor, forma_pagamento_id: 'pix',
  forma_pagamento: { id: 'pix', nome: 'Pix', natureza: 'avista' }, venda_id: null,
  data: dateAt(daysAgo), criado_em: dateAt(daysAgo),
});

function renderVendasPreview() {
  return render(<VendasPreview embutido />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pode.mockReturnValue(true);
  mocks.vendas.mockImplementation(() => ok([venda()]));
  mocks.caixa.mockImplementation(() => ok([movimento('atual', 100, 2), movimento('antigo', 900, 45)]));
  mocks.pendencias.mockImplementation(() => ok([]));
  mocks.recebimentosPendencia.mockImplementation(() => ok([]));
  mocks.fiado.mockImplementation(() => ok([]));
});

afterEach(cleanup);

describe('VendasPreview', () => {
  it('abre na visão geral e navega pelas quatro tabs', async () => {
    renderVendasPreview();
    expect(await screen.findByRole('heading', { name: 'Vendas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /^Vendas$/ }));
    expect(await screen.findByText('Vendas recentes')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: /^Vendas$/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Movimentações' })).toHaveAttribute('aria-selected', 'true');
  });

  it('abre o drawer ao selecionar uma venda', async () => {
    renderVendasPreview();
    fireEvent.click(screen.getByRole('tab', { name: /^Vendas$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Abrir detalhes da venda venda-1/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Detalhe venda-1');
  });

  it('calcula o saldo sobre o mesmo período mostrado na lista', async () => {
    renderVendasPreview();
    fireEvent.click(await screen.findByRole('tab', { name: 'Movimentações' }));
    fireEvent.click(screen.getByRole('tab', { name: '30 dias' }));
    const resumo = screen.getByText('Saldo líquido dos lançamentos filtrados').parentElement;
    expect(resumo).toHaveTextContent(/R\$\s*100,00/);
    expect(resumo).not.toHaveTextContent(/R\$\s*1\.000,00/);
  });

  it('sinaliza conciliação necessária quando a venda imediata não tem entrada de caixa', async () => {
    mocks.caixa.mockImplementation(() => ok([]));
    renderVendasPreview();
    fireEvent.click(await screen.findByRole('tab', { name: /^Vendas$/ }));
    await waitFor(() => expect(screen.getByText('Conciliação necessária')).toBeInTheDocument());
    expect(screen.queryByText('Saldo R$ 100,00')).not.toBeInTheDocument();
  });

  it('abre o drawer de edição a partir de uma pendência manual', async () => {
    mocks.pendencias.mockImplementation(() => ok([{
      id: 'pendencia-1', descricao: 'Peça encomendada', valor_total: 200, status: 'aberta',
      data: dateAt(35).slice(0, 10), criado_por: 'usuario-1', cliente_id: null,
      cliente: null, criador: null, criado_em: dateAt(35), atualizado_em: dateAt(2),
    }]));
    renderVendasPreview();
    fireEvent.click(await screen.findByRole('tab', { name: /Pendências/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Editar pendência' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Editar pendencia-pendencia-1');
  });
});
