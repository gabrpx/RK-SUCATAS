// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClientesLista } from './ClientesLista';
import type { ClienteOperacaoListaItem } from '../operacaoTypes';

const itens: ClienteOperacaoListaItem[] = [
  {
    id: 'ana', nome: 'Ana Ávila', telefone: '(83) 99999-0000', instagram_usuario: 'ana.moto', preferencia_contato: 'whatsapp', origem: 'instagram', cidade: 'João Pessoa', estado: 'PB', ativo: true, banido: false,
    criado_em: '2026-10-01T12:00:00.000Z', atualizado_em: '2026-10-01T12:00:00.000Z',
    motos: [
      { id: 'moto-ana', modelo_texto: 'Honda CG 160', principal: false },
      { id: 'moto-ana-principal', modelo_texto: 'Honda Bros 160', principal: true },
    ], pedidos: [{ id: 'pedido-ana', status: 'em_busca', criado_em: '2026-10-01T12:00:00.000Z' }],
  },
  {
    id: 'bruno', nome: 'Bruno Lima', telefone: null, instagram_usuario: null, preferencia_contato: null, origem: null, cidade: null, estado: null, ativo: true, banido: false,
    criado_em: '2026-10-02T12:00:00.000Z', atualizado_em: '2026-10-02T12:00:00.000Z',
    motos: [], pedidos: [],
  },
];

describe('ClientesLista', () => {
  afterEach(cleanup);

  it('busca sem depender de acento, máscara de telefone, @, moto e cidade', () => {
    const { rerender } = render(<ClientesLista itens={itens} onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);
    const busca = screen.getByRole('searchbox', { name: /buscar cliente/i });

    for (const termo of ['ana avila', '83999990000', '@ana.moto', 'cg 160', 'joao pessoa']) {
      fireEvent.change(busca, { target: { value: termo } });
      expect(screen.getAllByText('Ana Ávila').length).toBeGreaterThan(0);
      expect(screen.queryByText('Bruno Lima')).toBeNull();
    }

    rerender(<ClientesLista itens={itens} onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);
  });

  it('prioriza a moto marcada como principal na listagem', () => {
    render(<ClientesLista itens={itens} onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);

    expect(screen.getAllByText('Honda Bros 160').length).toBeGreaterThan(0);
    expect(screen.queryByText('Honda CG 160')).toBeNull();
  });

  it('mostra a última compra e o total reais, sem placeholders', () => {
    render(
      <ClientesLista
        itens={itens}
        vendas={[{ cliente_id: 'ana', data: '2026-10-02', valor_total: 120 } as any]}
        orcamentos={[]}
        onOpenCliente={() => {}}
        onRegistrarPedido={() => {}}
        onAgendarVisita={() => {}}
      />
    );

    expect(screen.getAllByText('02/10/2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/120,00/).length).toBeGreaterThan(0);
  });

  it('mostra chips removíveis, limpa filtros e explica resultado vazio', () => {
    render(<ClientesLista itens={itens} onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox', { name: /buscar cliente/i }), { target: { value: 'inexistente' } });
    expect(screen.getByText(/nenhum cliente encontrado/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /remover filtro.*inexistente/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));
    expect(screen.getAllByText('Ana Ávila').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bruno Lima').length).toBeGreaterThan(0);
  });

  it('filtra cadastro incompleto e dispara ações rápidas sem abrir contato externo', () => {
    const onOpenCliente = vi.fn();
    const onRegistrarPedido = vi.fn();
    const onAgendarVisita = vi.fn();
    render(<ClientesLista itens={itens} onOpenCliente={onOpenCliente} onRegistrarPedido={onRegistrarPedido} onAgendarVisita={onAgendarVisita} />);
    fireEvent.click(screen.getByRole('button', { name: /^Filtros$/ }));

    fireEvent.click(screen.getByRole('button', { name: /cadastro incompleto/i }));
    expect(screen.queryByText('Ana Ávila')).toBeNull();
    expect(screen.getAllByText('Bruno Lima').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /abrir cadastro de ana ávila/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /registrar pedido para ana ávila/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /agendar visita para ana ávila/i })[0]);

    expect(onOpenCliente).toHaveBeenCalledWith('ana');
    expect(onRegistrarPedido).toHaveBeenCalledWith(itens[0]);
    expect(onAgendarVisita).toHaveBeenCalledWith(itens[0]);
  });

  it('abre o deep-link de clientes sem pendências no layout novo', () => {
    render(<ClientesLista itens={itens} initialSemPendencias onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);

    expect(screen.getByRole('button', { name: /^Sem pendências$/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Ana Ávila')).toBeNull();
    expect(screen.getAllByText('Bruno Lima').length).toBeGreaterThan(0);
  });

  it('explica que a agenda ainda não está disponível sem simular um agendamento', () => {
    render(
      <ClientesLista
        itens={itens}
        onOpenCliente={() => {}}
        onRegistrarPedido={() => {}}
        {...({ onAgendarVisita: undefined } as any)}
      />
    );

    const acao = screen.getAllByRole('button', { name: /agenda de visitas ainda não está disponível/i })[0];
    expect((acao as HTMLButtonElement).disabled).toBe(true);
  });

  it('mostra carregamento em vez de confundir a primeira busca com uma lista vazia', () => {
    render(
      <ClientesLista
        itens={[]}
        onOpenCliente={() => {}}
        onRegistrarPedido={() => {}}
        onAgendarVisita={() => {}}
        {...({ loading: true } as any)}
      />
    );

    expect(screen.getByRole('status', { name: /carregando clientes/i })).toBeTruthy();
    expect(screen.queryByText(/nenhum cliente encontrado/i)).toBeNull();
  });

  it('expõe erro recuperável sem apagar os controles da lista', () => {
    const onRetry = vi.fn();
    render(
      <ClientesLista
        itens={[]}
        onOpenCliente={() => {}}
        onRegistrarPedido={() => {}}
        onAgendarVisita={() => {}}
        {...({ error: 'Falha temporária', onRetry } as any)}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('Falha temporária');
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('searchbox', { name: /buscar cliente/i })).toBeTruthy();
  });

  it('permite carregar os próximos clientes quando a API informa mais resultados', () => {
    const onLoadMore = vi.fn();
    render(
      <ClientesLista
        itens={itens}
        onOpenCliente={() => {}}
        onRegistrarPedido={() => {}}
        onAgendarVisita={() => {}}
        {...({ hasMore: true, onLoadMore } as any)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /carregar mais clientes/i }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('aplica e permite limpar o recorte vindo de um indicador operacional', () => {
    const onClearPedidoStatus = vi.fn();
    render(
      <ClientesLista
        itens={[
          ...itens,
          { ...itens[1], id: 'carla', nome: 'Carla Santos', pedidos: [{ id: 'pedido-carla', status: 'peca_disponivel', criado_em: '2026-10-03T12:00:00.000Z' }] },
        ]}
        pedidoStatuses={['peca_disponivel']}
        pedidoStatusLabel="Peças disponíveis"
        onClearPedidoStatus={onClearPedidoStatus}
        onOpenCliente={() => {}}
        onRegistrarPedido={() => {}}
        onAgendarVisita={() => {}}
      />
    );

    expect(screen.queryByText('Ana Ávila')).toBeNull();
    expect(screen.getAllByText('Carla Santos').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /remover filtro.*peças disponíveis/i }));
    expect(onClearPedidoStatus).toHaveBeenCalledOnce();
  });

  it('prioriza a busca e expande os filtros avançados somente quando solicitados no mobile', () => {
    render(<ClientesLista itens={itens} onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);

    const filtros = screen.getByTestId('clientes-filtros');
    const trigger = screen.getByRole('button', { name: /^Filtros$/i });
    expect(filtros.className).toContain('grid-cols-2');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(filtros.className).toContain('overflow-visible');
    expect(screen.getByRole('searchbox', { name: /buscar cliente/i })).toBeTruthy();
  });

  it('distribui ações rápidas do cartão em uma grade de toque', () => {
    render(<ClientesLista itens={itens} onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);

    expect(screen.getAllByTestId('cliente-acoes-rapidas')[0].className).toContain('grid-cols-3');
    expect(screen.getAllByRole('button', { name: /abrir contato de ana ávila/i })[0].textContent).toContain('Contato');
    expect(screen.getAllByRole('button', { name: /registrar pedido para ana ávila/i })[0].textContent).toContain('Pedido');
    expect(screen.getAllByRole('button', { name: /agendar visita para ana ávila/i })[0].textContent).toContain('Visita');
  });

  it('usa filtros customizados e indica visualmente os clientes clicáveis', () => {
    render(<ClientesLista itens={itens} onOpenCliente={() => {}} onRegistrarPedido={() => {}} onAgendarVisita={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Filtros$/ }));

    expect(screen.getByRole('combobox', { name: 'Filtrar por origem' }).getAttribute('aria-haspopup')).toBe('listbox');
    expect(screen.getByRole('combobox', { name: 'Filtrar por cidade' }).getAttribute('aria-haspopup')).toBe('listbox');
    expect(screen.getAllByRole('button', { name: /abrir cadastro de ana ávila/i })[0].className).toContain('cursor-pointer');
  });
});
