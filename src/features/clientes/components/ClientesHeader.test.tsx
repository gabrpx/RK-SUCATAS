// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClientesHeader } from './ClientesHeader';

describe('ClientesHeader', () => {
  afterEach(cleanup);

  it('mantém Registrar pedido como CTA principal e troca de aba acessível', () => {
    const onTabChange = vi.fn();
    const onRegistrarPedido = vi.fn();
    render(<ClientesHeader tab="painel" onTabChange={onTabChange} canCreate onNovoCliente={() => {}} onRegistrarPedido={onRegistrarPedido} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Painel' }), { key: 'ArrowRight' });
    expect(onRegistrarPedido).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith('todos');
  });

  it('não mostra ações de criação para quem não tem permissão', () => {
    render(<ClientesHeader tab="painel" onTabChange={() => {}} canCreate={false} onNovoCliente={() => {}} onRegistrarPedido={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Registrar pedido' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Novo cliente' })).toBeNull();
  });

  it('mantém o registro de pedido disponível para quem pode editar, mas não criar clientes', () => {
    render(
      <ClientesHeader
        {...({
          tab: 'painel',
          onTabChange: () => {},
          canCreate: false,
          canRegisterPedido: true,
          onNovoCliente: () => {},
          onRegistrarPedido: () => {},
        } as any)}
      />
    );

    expect(screen.queryByRole('button', { name: 'Novo cliente' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeTruthy();
  });

  it('mantém as ações com largura de conteúdo, sem preencher o cabeçalho', () => {
    render(<ClientesHeader tab="painel" onTabChange={() => {}} canCreate onNovoCliente={() => {}} onRegistrarPedido={() => {}} />);

    const actions = screen.getByRole('group', { name: 'Ações de clientes' });
    expect(actions.className).toContain('flex');
    expect(actions.className).not.toContain('grid-cols-2');
    expect(actions.parentElement?.parentElement?.className).toContain('sticky');
    expect(screen.getByRole('button', { name: 'Novo cliente' }).className).toContain('size-11');
  });

  it('mantém as abas na largura de conteúdo com rolagem contida quando necessário', () => {
    render(<ClientesHeader tab="painel" onTabChange={() => {}} canCreate onNovoCliente={() => {}} onRegistrarPedido={() => {}} />);

    const tabs = screen.getByRole('tablist');
    expect(tabs.className).toContain('max-w-full');
    expect(tabs.className.split(/\s+/)).not.toContain('w-full');
    expect(tabs.parentElement?.parentElement?.className).toContain('lg:justify-end');
  });
});
