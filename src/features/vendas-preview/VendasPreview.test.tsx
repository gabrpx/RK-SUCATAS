// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  vendas: vi.fn(),
  caixa: vi.fn(),
  lancarCaixa: vi.fn(),
  excluirCaixa: vi.fn(),
  pendencias: vi.fn(),
  criarPendencia: vi.fn(),
  recebimentosPendencia: vi.fn(),
  fiado: vi.fn(),
  clientes: vi.fn(),
  pode: vi.fn(() => true),
}));

vi.mock('@/src/hooks/usePermissao', () => ({ podeAtual: mocks.pode }));
vi.mock('@/src/features/vendas/api', () => ({ vendasApi: { listar: mocks.vendas } }));
vi.mock('@/src/features/caixa/api', () => ({
  caixaApi: { listar: mocks.caixa, lancar: mocks.lancarCaixa, excluir: mocks.excluirCaixa },
  caixaPendenciasApi: { listar: mocks.pendencias, listarRecebimentos: mocks.recebimentosPendencia, criar: mocks.criarPendencia },
}));
vi.mock('@/src/features/clientes/api', () => ({ clientesApi: { listar: mocks.clientes } }));
vi.mock('@/src/hooks/useCatalogos', () => ({ useCatalogos: () => ({ formasPagamento: [{ id: 'pix', nome: 'Pix', natureza: 'avista' }] }) }));
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
  mocks.lancarCaixa.mockImplementation((payload) => ok({ ...movimento('novo', payload.valor, 0), ...payload }));
  mocks.excluirCaixa.mockImplementation(() => ok(null));
  mocks.pendencias.mockImplementation(() => ok([]));
  mocks.criarPendencia.mockImplementation((payload) => ok({ id: 'pendencia-nova', ...payload, status: 'aberta', cliente: payload.cliente_id ? { id: payload.cliente_id, nome: 'Cliente 1', telefone: null } : null }));
  mocks.recebimentosPendencia.mockImplementation(() => ok([]));
  mocks.fiado.mockImplementation(() => ok([]));
  mocks.clientes.mockImplementation(() => ok([{ id: 'cliente-1', nome: 'Cliente 1', ativo: true, banido: false }]));
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

  it('não exibe o filtro de vendas com saldo', async () => {
    renderVendasPreview();
    fireEvent.click(await screen.findByRole('tab', { name: /^Vendas$/ }));
    expect(screen.queryByRole('button', { name: 'Com saldo' })).not.toBeInTheDocument();
  });

  it('não exibe avisos de dados reais ou modo somente leitura', async () => {
    renderVendasPreview();
    expect(await screen.findByRole('heading', { name: 'Vendas' })).toBeInTheDocument();
    expect(screen.queryByText(/dados reais|dados atuais|somente leitura/i)).not.toBeInTheDocument();
  });

  it('cria e exclui uma movimentação manual pela aba Movimentações', async () => {
    renderVendasPreview();
    fireEvent.click(await screen.findByRole('tab', { name: 'Movimentações' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nova saída' }));
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Conta de luz' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '150,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lançamento' }));
    await waitFor(() => expect(mocks.lancarCaixa).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'saida', descricao: 'Conta de luz', valor: 150 })));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Excluir movimentação Entrada atual' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Excluir movimentação Entrada atual' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(mocks.excluirCaixa).toHaveBeenCalledWith('atual'));
  });

  it('cria uma pendência já vinculada a um cliente', async () => {
    renderVendasPreview();
    fireEvent.click(await screen.findByRole('tab', { name: /Pendências/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Nova pendência' }));
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Peça reservada' } });
    fireEvent.change(screen.getByLabelText('Valor total'), { target: { value: '220' } });
    await waitFor(() => expect(mocks.clientes).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('combobox', { name: /Cliente/ }));
    fireEvent.click(await screen.findByText('Cliente 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar pendência' }));
    await waitFor(() => expect(mocks.criarPendencia).toHaveBeenCalledWith(expect.objectContaining({ descricao: 'Peça reservada', valor_total: 220, cliente_id: 'cliente-1' })));
  });
});
