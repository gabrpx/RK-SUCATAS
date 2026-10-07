// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClienteDrawer } from './ClienteDrawer';
import type { Cliente } from '../types';

const cliente: Cliente = {
  id: 'cliente-ana',
  nome: 'Ana Souza',
  telefone: '83999990000',
  instagram_usuario: 'ana.motos',
  preferencia_contato: 'whatsapp',
  documento: null,
  data_nascimento: null,
  origem: 'instagram',
  tags: ['frequente'],
  observacoes: 'Prefere peças originais.',
  ativo: true,
  banido: false,
  cidade: 'João Pessoa',
  estado: 'PB',
  criado_em: '2026-10-01T12:00:00.000Z',
  atualizado_em: '2026-10-01T12:00:00.000Z',
  motos: [{
    id: 'moto-1',
    cliente_id: 'cliente-ana',
    modelo_moto_id: 'cg-160',
    modelo_texto: null,
    modelo_moto: { id: 'cg-160', nome: 'Honda CG 160', ano: null },
    placa: null,
    chassi: null,
    ano: '2022',
    cor: 'Vermelha',
    observacoes: null,
    principal: true,
    criado_em: '2026-10-01T12:00:00.000Z',
  }],
  pecas_procuradas: [{
    id: 'pedido-1',
    cliente_id: 'cliente-ana',
    cliente_nome: 'Ana Souza',
    descricao: 'Farol dianteiro',
    categoria_id: null,
    categoria: null,
    modelo_moto_id: 'cg-160',
    modelo_moto: { id: 'cg-160', nome: 'Honda CG 160', ano: null },
    status: 'em_busca',
    criado_por: 'atendente-1',
    criado_em: '2026-10-01T12:00:00.000Z',
    atendida_em: null,
  }],
  notas: [{
    id: 'nota-1', cliente_id: 'cliente-ana', texto: 'Ligou hoje.', criado_por: null,
    autor: null, criado_em: '2026-10-01T12:00:00.000Z',
  }],
  comprovantes_pix: [{
    id: 'pix-1', venda_id: 'venda-1', cliente_id: 'cliente-ana', nome_arquivo: 'pix.png',
    tipo_mime: 'image/png', tamanho_bytes: 1234, url: null, criado_por: null,
    autor: null, criado_em: '2026-10-01T12:00:00.000Z', removido_em: null,
    venda: { id: 'venda-1', nome_item: 'Carenagem', data: '2026-09-30' },
  }],
};

function renderDrawer(overrides: Partial<React.ComponentProps<typeof ClienteDrawer>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    cliente,
    onRegistrarPedido: vi.fn(),
    onAgendarVisita: vi.fn(),
    onEdit: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ClienteDrawer {...props} />) };
}

describe('ClienteDrawer', () => {
  afterEach(cleanup);

  it('organiza o perfil em seções úteis e preserva os registros existentes em leitura', () => {
    renderDrawer();

    const dialog = screen.getByRole('dialog', { name: 'Ana Souza' });
    expect(dialog.querySelector('main')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Contato' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Motos' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pedidos' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Anotações' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Comprovantes de PIX' })).toBeTruthy();
    expect(screen.getAllByText('Honda CG 160').length).toBeGreaterThan(0);
    expect(screen.getByText('Farol dianteiro')).toBeTruthy();
    expect(screen.getByText('Ligou hoje.')).toBeTruthy();
    expect(screen.getByText(/carenagem/i)).toBeTruthy();
  });

  it('mostra o contato preferido e o canal secundário em links seguros', () => {
    renderDrawer();

    const whatsapp = screen.getByRole('link', { name: /whatsapp.*contato preferido/i });
    const instagram = screen.getByRole('link', { name: /instagram.*outro contato/i });
    expect(whatsapp.getAttribute('href')).toContain('https://wa.me/5583999990000');
    expect(instagram.getAttribute('href')).toBe('https://www.instagram.com/ana.motos/');
    expect(instagram.getAttribute('target')).toBe('_blank');
  });

  it('omite blocos sem dados, explica a próxima etapa indisponível e mantém o rodapé fixo', () => {
    renderDrawer({
      cliente: {
        ...cliente,
        telefone: null,
        instagram_usuario: null,
        preferencia_contato: null,
        motos: [],
        pecas_procuradas: [],
        notas: [],
        comprovantes_pix: [],
        observacoes: null,
      },
    });

    expect(screen.queryByRole('heading', { name: 'Motos' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pedidos' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Anotações' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Comprovantes de PIX' })).toBeNull();
    expect(screen.getByText(/visitas e reservas serão integradas/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Contato indisponível' }).getAttribute('aria-describedby')).toBe('cliente-contato-indisponivel');
    expect(screen.getByText('Cadastre um WhatsApp ou Instagram para abrir o contato.')).toBeTruthy();
    const dialog = screen.getByRole('dialog', { name: 'Ana Souza' });
    const footer = dialog.querySelector('[data-operational-drawer-footer]');
    expect(footer).toBeTruthy();
    expect(footer?.contains(screen.getByRole('button', { name: 'Registrar pedido' }))).toBe(true);
  });

  it('mantém contato, agendamento, edição e pedido na barra fixa com uma única ação preenchida', () => {
    const { props } = renderDrawer();
    const dialog = screen.getByRole('dialog', { name: 'Ana Souza' });
    const footer = dialog.querySelector('[data-operational-drawer-footer]');
    const abrirContato = screen.getByRole('link', { name: 'Abrir WhatsApp' });
    const agendarVisita = screen.getByRole('button', { name: 'Agendar visita' });
    const registrarPedido = screen.getByRole('button', { name: 'Registrar pedido' });

    expect(footer?.contains(abrirContato)).toBe(true);
    expect(footer?.contains(agendarVisita)).toBe(true);
    expect(footer?.querySelectorAll('.bg-accent')).toHaveLength(1);
    expect(registrarPedido.className).toContain('text-white');

    fireEvent.click(agendarVisita);
    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }));
    fireEvent.click(registrarPedido);

    expect(props.onAgendarVisita).toHaveBeenCalledWith(cliente);
    expect(props.onEdit).toHaveBeenCalledWith(cliente);
    expect(props.onRegistrarPedido).toHaveBeenCalledWith(cliente);
  });

  it('explica por que o agendamento está indisponível antes da integração de visitas', () => {
    renderDrawer({ onAgendarVisita: undefined });

    const agendarVisita = screen.getByRole('button', { name: 'Agendar visita' });
    expect((agendarVisita as HTMLButtonElement).disabled).toBe(true);
    expect(agendarVisita.getAttribute('title')).toBe('Agenda de visitas ainda não está disponível');
  });
});
