// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiMocks = vi.hoisted(() => ({
  buscarDuplicidades: vi.fn(),
  registrarPedido: vi.fn(),
}));

vi.mock('../api', () => ({ clientesApi: apiMocks }));
vi.mock('../../../components/ui/OperationalDrawer', () => ({
  OperationalDrawer: ({ open, title, children, footer }: any) => open ? <section role="dialog" aria-label={title}>{children}{footer}</section> : null,
}));
vi.mock('./ClienteFormDrawer', () => ({
  EMPTY_CLIENTE_FORM_VALUES: {
    nome: '', telefone: '', instagram_usuario: '', preferencia_contato: 'whatsapp', origem: 'balcao',
    cidade: '', estado: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '',
  },
  ClienteFormFields: ({ value, onChange }: any) => <div>
    <label>Nome do cliente<input aria-label="Nome do cliente" value={value.nome} onChange={(event) => onChange({ ...value, nome: event.target.value })} /></label>
    <label>WhatsApp<input aria-label="WhatsApp" value={value.telefone} onChange={(event) => onChange({ ...value, telefone: event.target.value })} /></label>
    <label>Cidade<input aria-label="Cidade" value={value.cidade} onChange={(event) => onChange({ ...value, cidade: event.target.value })} /></label>
    <label>UF<input aria-label="UF" value={value.estado} onChange={(event) => onChange({ ...value, estado: event.target.value })} /></label>
  </div>,
  validarClienteForm: (value: any) => value.nome && value.telefone && value.cidade && value.estado ? {} : { cliente: 'Complete os dados do cliente' },
  toClienteOperacionalInput: (value: any) => value,
}));

import { RegistrarPedidoDrawer } from './RegistrarPedidoDrawer';

const props = {
  open: true,
  onOpenChange: vi.fn(),
  responsaveis: [{ id: '11111111-1111-4111-8111-111111111111', nome: 'Carlos' }],
  categorias: [{ id: 'cat-1', nome: 'Iluminação' }],
  modelos: [{ id: 'modelo-1', nome: 'CG 160' }],
  onSaved: vi.fn(),
  onRefresh: vi.fn(),
};

function preencherCliente() {
  fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Ana Souza' } });
  fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '83999999999' } });
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Campina Grande' } });
  fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'PB' } });
}

function iniciarNovoCliente() {
  fireEvent.click(screen.getByRole('button', { name: /Novo cliente \+ pedido/ }));
}

function selecionarResponsavel() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Responsável' }));
  fireEvent.click(screen.getByRole('option', { name: 'Carlos' }));
}

describe('RegistrarPedidoDrawer', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.buscarDuplicidades.mockResolvedValue({ success: true, data: [] });
    apiMocks.registrarPedido.mockResolvedValue({
      success: true,
      data: { cliente: { id: 'cliente-1' }, pedido: { id: 'pedido-1', status: 'nova' } },
    });
  });

  it('exige peça, moto e responsável; data só é obrigatória quando combinada', async () => {
    render(<RegistrarPedidoDrawer {...props} />);
    iniciarNovoCliente();
    preencherCliente();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Dados do pedido');

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/peça|moto|responsável/i);

    fireEvent.change(screen.getByLabelText('Peça procurada'), { target: { value: 'Farol' } });
    fireEvent.change(screen.getByLabelText('Moto em texto livre'), { target: { value: 'CG 160' } });
    selecionarResponsavel();
    fireEvent.click(screen.getByLabelText('Data combinada com o cliente'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/data combinada/i);
  });

  it('permite escolher cliente existente após o preflight de duplicidade', async () => {
    apiMocks.buscarDuplicidades.mockResolvedValue({
      success: true,
      data: [{ id: 'cliente-existente', nome: 'Ana Souza', telefone: '83999999999', instagram_usuario: null, cidade: 'Campina Grande', estado: 'PB', ativo: true, criterios: ['whatsapp'] }],
    });
    render(<RegistrarPedidoDrawer {...props} />);
    iniciarNovoCliente();
    preencherCliente();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Cadastro parecido encontrado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Usar Ana Souza/ }));
    expect(await screen.findByText('Dados do pedido')).toBeTruthy();
  });

  it('reutiliza o cliente aberto no drawer sem rodar um novo preflight de duplicidade', async () => {
    render(<RegistrarPedidoDrawer {...props} initialCliente={{
      id: 'cliente-existente', nome: 'Ana Souza', telefone: '83999999999', instagram_usuario: null,
      preferencia_contato: 'whatsapp', origem: 'whatsapp', cidade: 'Campina Grande', estado: 'PB',
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Dados do pedido')).toBeTruthy();
    expect(apiMocks.buscarDuplicidades).not.toHaveBeenCalled();
  });

  it('deixa o operador escolher entre cadastro existente e novo antes de iniciar o pedido', async () => {
    render(<RegistrarPedidoDrawer {...props} clientes={[{
      id: 'cliente-existente', nome: 'Ana Souza', telefone: '83999999999', instagram_usuario: null,
      preferencia_contato: 'whatsapp', origem: 'balcao', cidade: 'Campina Grande', estado: 'PB', ativo: true, banido: false,
      criado_em: '2026-10-01T12:00:00.000Z', atualizado_em: '2026-10-01T12:00:00.000Z', motos: [], pedidos: [],
    }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Cliente já cadastrado/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar cliente' }), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: /Ana Souza.*Selecionar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Dados do pedido')).toBeTruthy();
    expect(apiMocks.buscarDuplicidades).not.toHaveBeenCalled();
  });

  it('exige confirmação explícita para manter um cadastro separado', async () => {
    apiMocks.buscarDuplicidades.mockResolvedValue({
      success: true,
      data: [{ id: 'cliente-existente', nome: 'Ana Souza', telefone: '83999999999', instagram_usuario: null, cidade: 'Campina Grande', estado: 'PB', ativo: true, criterios: ['whatsapp'] }],
    });
    render(<RegistrarPedidoDrawer {...props} />);
    iniciarNovoCliente();
    preencherCliente();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    const separar = await screen.findByRole('button', { name: 'Cadastrar separado' });
    expect((separar as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/É outra pessoa/));
    expect((separar as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(separar);
    expect(await screen.findByText('Dados do pedido')).toBeTruthy();
  });

  it('reutiliza a chave de idempotência no retry e atualiza o painel uma vez no sucesso', async () => {
    apiMocks.registrarPedido
      .mockResolvedValueOnce({ success: false, error: 'Falha temporária' })
      .mockResolvedValueOnce({ success: true, data: { cliente: { id: 'cliente-1' }, pedido: { id: 'pedido-1', status: 'nova' } } });
    render(<RegistrarPedidoDrawer {...props} />);
    iniciarNovoCliente();
    preencherCliente();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Dados do pedido');
    fireEvent.change(screen.getByLabelText('Peça procurada'), { target: { value: 'Farol' } });
    fireEvent.change(screen.getByLabelText('Moto em texto livre'), { target: { value: 'CG 160' } });
    selecionarResponsavel();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Falha temporária');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));

    await waitFor(() => expect(apiMocks.registrarPedido).toHaveBeenCalledTimes(2));
    const primeiraChave = apiMocks.registrarPedido.mock.calls[0][0].pedido.idempotency_key;
    const segundaChave = apiMocks.registrarPedido.mock.calls[1][0].pedido.idempotency_key;
    expect(segundaChave).toBe(primeiraChave);
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    expect(props.onSaved).toHaveBeenCalledWith({ clienteId: 'cliente-1', pedidoId: 'pedido-1' });
    expect(JSON.stringify(apiMocks.registrarPedido.mock.calls[1][0])).not.toMatch(/venda|reserva/);
  });

  it('bloqueia envios duplicados enquanto a operação está em andamento', async () => {
    let concluir!: (value: unknown) => void;
    apiMocks.registrarPedido.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    render(<RegistrarPedidoDrawer {...props} />);
    iniciarNovoCliente();
    preencherCliente();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Dados do pedido');
    fireEvent.change(screen.getByLabelText('Peça procurada'), { target: { value: 'Farol' } });
    fireEvent.change(screen.getByLabelText('Moto em texto livre'), { target: { value: 'CG 160' } });
    selecionarResponsavel();

    const enviar = screen.getByRole('button', { name: 'Registrar pedido' });
    fireEvent.click(enviar);
    fireEvent.click(enviar);
    expect(apiMocks.registrarPedido).toHaveBeenCalledTimes(1);
    concluir({ success: false, error: 'Encerrando teste' });
    expect((await screen.findByRole('alert')).textContent).toContain('Encerrando teste');
  });
});
