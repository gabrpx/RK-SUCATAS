// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClientesPainel } from './ClientesPainel';
import type { ClientesResumoOperacional, ClienteOperacaoListaItem } from '../operacaoTypes';

const resumo: ClientesResumoOperacional = {
  total_clientes: 28,
  pedidos_por_status: { em_busca: 5, aguardando: 2, peca_disponivel: 3, nova: 1 },
  pendencias_por_idade: { ate_2_dias: 4, de_3_a_7_dias: 2, mais_de_7_dias: 1 },
  respostas_acima_48h: 1,
  reservas_sem_decisao: 0,
  visitas_vencidas: 0,
  decisoes_duplicidade: 0,
  capabilities: { base: true, visitas: false, reservas: false, matches: false },
  visitas: [],
  reservas: [],
  matches: [],
};

const itens: ClienteOperacaoListaItem[] = [
  {
    id: 'cliente-1', nome: 'Ana Souza', telefone: '83999999999', instagram_usuario: null,
    preferencia_contato: 'whatsapp', origem: 'whatsapp', cidade: 'Campina Grande', estado: 'PB',
    ativo: true, banido: false, criado_em: '2026-10-01T12:00:00.000Z', atualizado_em: '2026-10-01T12:00:00.000Z',
    motos: [{ id: 'moto-1', principal: true, modelo_moto: { nome: 'Honda CG 160' } }], pedidos: [{ id: 'pedido-1', status: 'peca_disponivel', descricao: 'Par de rodas', criado_em: '2026-10-01T12:00:00.000Z' }],
  },
];

describe('ClientesPainel', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('mostra o resumo da encomenda em tooltip claro posicionado acima da badge', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const criadoEm = new Date(Date.now() - 3 * 86_400_000).toISOString();
    render(<ClientesPainel resumo={resumo} itens={[{ ...itens[0], pedidos: [{ id: 'pedido-1', status: 'em_busca', descricao: 'Par de rodas', criado_em: criadoEm }] }]} onRetry={() => {}} onSelectMetric={() => {}} onSelectCliente={() => {}} />);

    fireEvent.mouseEnter(screen.getByText('Com encomenda'));
    await act(async () => { vi.advanceTimersByTime(130); });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Par de rodas');
    expect(tooltip.textContent).toContain('Honda CG 160');
    expect(tooltip.textContent).toContain('há 3 dias');
    expect(tooltip.className).toContain('!bg-white');
    expect(tooltip.parentElement?.style.transform).toContain('translateY(-100%)');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('exibe os indicadores cotidianos e envia o filtro correspondente', () => {
    const onSelectMetric = vi.fn();
    render(<ClientesPainel resumo={resumo} itens={itens} onRetry={() => {}} onSelectMetric={onSelectMetric} onSelectCliente={() => {}} />);

    expect(screen.getByRole('button', { name: /Pedidos em busca/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Peças disponíveis/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Próximas visitas/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reservas vencendo/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Peças disponíveis/i }));
    expect(onSelectMetric).toHaveBeenCalledWith('peca_disponivel');
  });

  it('lista o cliente, sua moto e os status em badges, incluindo clientes sem pedido ativo', () => {
    const onSelectCliente = vi.fn();
    const { rerender } = render(<ClientesPainel resumo={resumo} itens={itens} onRetry={() => {}} onSelectMetric={() => {}} onSelectCliente={onSelectCliente} />);
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeTruthy();
    expect(screen.getByText('Honda CG 160')).toBeTruthy();
    expect(screen.getByText('Com encomenda')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ana Souza/i }));
    expect(onSelectCliente).toHaveBeenCalledWith('cliente-1');
    expect(screen.getAllByText(/Ative a etapa de visitas/i).length).toBeGreaterThan(0);

    rerender(<ClientesPainel resumo={resumo} itens={[{ ...itens[0], pedidos: [], motos: [], id: 'cliente-2', nome: 'Bia Lima' }]} onRetry={() => {}} onSelectMetric={() => {}} onSelectCliente={() => {}} />);
    expect(screen.getByText('Bia Lima')).toBeTruthy();
    expect(screen.getByText('Moto não informada')).toBeTruthy();
    expect(screen.getByText('Sem pendências')).toBeTruthy();
  });

  it('mantém todos os clientes na lista rolável em vez de truncar a fila', () => {
    const lista = Array.from({ length: 10 }, (_, index) => ({
      ...itens[0], id: `cliente-${index}`, nome: `Cliente ${index}`, pedidos: [], motos: [],
    }));
    render(<ClientesPainel resumo={resumo} itens={lista} onRetry={() => {}} onSelectMetric={() => {}} onSelectCliente={() => {}} />);
    expect(screen.getByRole('list', { name: 'Lista de clientes' }).className).toContain('overflow-y-auto');
    expect(screen.getByText('Cliente 9')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('preserva um erro recuperável com botão de tentar novamente', () => {
    const onRetry = vi.fn();
    render(<ClientesPainel resumo={null} itens={[]} error="Não foi possível carregar" onRetry={onRetry} onSelectMetric={() => {}} onSelectCliente={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('mantém a fila visível quando apenas os indicadores não puderam ser carregados', () => {
    render(<ClientesPainel resumo={null} itens={itens} onRetry={() => {}} onSelectMetric={() => {}} onSelectCliente={() => {}} />);

    expect(screen.getByText('Indicadores operacionais indisponíveis')).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
  });

  it('mantém as métricas e a fila junto do mapa de cidades com dados operacionais', async () => {
    render(<ClientesPainel resumo={resumo} itens={itens} onRetry={() => {}} onSelectMetric={() => {}} onSelectCliente={() => {}} />);

    expect(screen.getByRole('button', { name: /Pedidos em busca/i })).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(await screen.findByRole('group', { name: 'Mapa de clientes por cidade' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Campina Grande, PB: 1 cliente/i })).toBeTruthy();
  });

  it('mantém a fila e o mapa na mesma altura-base em desktop', async () => {
    render(<ClientesPainel resumo={resumo} itens={itens} onRetry={() => {}} onSelectMetric={() => {}} onSelectCliente={() => {}} />);

    const fila = screen.getByRole('heading', { name: 'Clientes' }).closest('section');
    const mapa = (await screen.findByRole('heading', { name: 'Clientes por cidade' })).closest('section');
    expect(fila?.className).toContain('lg:h-[512px]');
    expect(mapa?.className).toContain('lg:h-[512px]');
  });
});
