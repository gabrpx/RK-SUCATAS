// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ClienteFormDrawer,
  ClienteFormFields,
  EMPTY_CLIENTE_FORM_VALUES,
  type ClienteFormValues,
} from './ClienteFormDrawer';

const apiMocks = vi.hoisted(() => ({
  buscarDuplicidades: vi.fn(),
  criarCliente: vi.fn(),
  editarCliente: vi.fn(),
}));

vi.mock('../api', () => ({
  clientesApi: apiMocks,
}));

const clienteCriado = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Ana Souza',
};

const dadosValidos: ClienteFormValues = {
  ...EMPTY_CLIENTE_FORM_VALUES,
  nome: 'Ana Souza',
  telefone: '83999999999',
  preferencia_contato: 'whatsapp',
  origem: 'balcao',
  cidade: 'Juazeirinho',
  estado: 'PB',
};

function renderCreate(overrides: Partial<React.ComponentProps<typeof ClienteFormDrawer>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    mode: 'create' as const,
    initialValue: dadosValidos,
    onSaved: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof ClienteFormDrawer>;
  return { ...render(<ClienteFormDrawer {...props} />), props };
}

describe('ClienteFormDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.buscarDuplicidades.mockResolvedValue({ success: true, data: [] });
    apiMocks.criarCliente.mockResolvedValue({ success: true, data: clienteCriado });
    apiMocks.editarCliente.mockResolvedValue({ success: true, data: clienteCriado });
    global.fetch = vi.fn().mockRejectedValue(new Error('ViaCEP indisponível'));
  });

  afterEach(() => cleanup());

  it('alterna WhatsApp e Instagram por teclado com uma transição de painel e valida o contato escolhido', async () => {
    renderCreate({ initialValue: { ...dadosValidos, telefone: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    const whatsapp = screen.getByLabelText('Número do WhatsApp');
    expect(whatsapp.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText('Informe um WhatsApp válido com DDD.').length).toBeGreaterThan(0);
    await waitFor(() => expect(document.activeElement).toBe(whatsapp));

    const whatsappTab = screen.getByRole('tab', { name: 'WhatsApp' });
    whatsappTab.focus();
    fireEvent.keyDown(whatsappTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Instagram' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(screen.getByTestId('cliente-form-content').querySelector('[data-contact-panel="instagram"]')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    const instagram = screen.getByLabelText('Usuário do Instagram');
    expect(instagram.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText('Informe um usuário válido do Instagram.').length).toBeGreaterThan(0);
  });

  it('sugere origem Instagram sem sobrescrever uma origem confirmada', async () => {
    renderCreate({
      initialValue: {
        ...dadosValidos,
        telefone: '',
        instagram_usuario: 'rk.sucatas',
        preferencia_contato: 'instagram',
        origem: '',
      },
    });

    const origem = screen.getByRole('combobox', { name: 'De onde veio' });
    expect(origem.getAttribute('aria-haspopup')).toBe('listbox');
    expect(origem.textContent).toContain('Instagram');

    fireEvent.click(screen.getByRole('tab', { name: 'WhatsApp' }));
    await waitFor(() => expect(origem.textContent).toContain('Selecione…'));
    fireEvent.click(screen.getByRole('tab', { name: 'Instagram' }));
    await waitFor(() => expect(origem.textContent).toContain('Instagram'));

    fireEvent.click(origem);
    fireEvent.click(screen.getByRole('option', { name: 'Indicação' }));
    fireEvent.click(screen.getByRole('tab', { name: 'WhatsApp' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Instagram' }));
    await waitFor(() => expect(origem.textContent).toContain('Indicação'));
  });

  it('mantém cidade e UF manuais quando o ViaCEP falha', async () => {
    const onChange = vi.fn();
    const value = { ...dadosValidos, cep: '', cidade: 'Juazeirinho', estado: 'PB' };
    const { rerender } = render(<ClienteFormFields value={value} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '99999999' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      cep: '99999999',
      cidade: 'Juazeirinho',
      estado: 'PB',
    }));

    rerender(<ClienteFormFields value={{ ...value, cep: '99999999' }} onChange={onChange} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ cidade: '', estado: '' }));
  });

  it('preenche e persiste o endereço opcional retornado pelo ViaCEP', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uf: 'PB', localidade: 'Juazeirinho', bairro: 'Centro', logradouro: 'Rua da Matriz' }),
    });
    const onSaved = vi.fn();
    renderCreate({
      initialValue: { ...dadosValidos, cidade: '', estado: '', cep: '58660000' },
      onSaved,
    });

    await waitFor(() => expect((screen.getByLabelText('Logradouro') as HTMLInputElement).value).toBe('Rua da Matriz'));
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Complemento'), { target: { value: 'Fundos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    await waitFor(() => expect(apiMocks.criarCliente).toHaveBeenCalledWith(expect.objectContaining({
      cep: '58660000',
      logradouro: 'Rua da Matriz',
      numero: '45',
      complemento: 'Fundos',
      bairro: 'Centro',
      cidade: 'Juazeirinho',
      estado: 'PB',
    })));
    expect(onSaved).toHaveBeenCalledWith({ clienteId: clienteCriado.id });
  });

  it('exige confirmação explícita antes de cadastrar separado quando encontra duplicidade', async () => {
    apiMocks.buscarDuplicidades.mockResolvedValue({
      success: true,
      data: [{
        id: 'cliente-existente',
        nome: 'Ana Souza',
        telefone: '83999999999',
        instagram_usuario: null,
        cidade: 'Juazeirinho',
        estado: 'PB',
        ativo: true,
        criterios: ['whatsapp'],
      }],
    });
    renderCreate();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    expect(await screen.findByRole('heading', { name: 'Cadastro parecido encontrado' })).toBeTruthy();
    expect(apiMocks.criarCliente).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/É outra pessoa/));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    await waitFor(() => expect(apiMocks.criarCliente).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Ana Souza',
      telefone: '83999999999',
    })));
    expect(apiMocks.buscarDuplicidades).toHaveBeenCalledTimes(1);
  });

  it('não repete a busca de duplicidade durante a mesma tentativa de salvar', async () => {
    let concluirBusca: ((value: unknown) => void) | undefined;
    apiMocks.buscarDuplicidades.mockReturnValue(new Promise((resolve) => { concluirBusca = resolve; }));
    renderCreate();

    const salvar = screen.getByRole('button', { name: 'Salvar cliente' });
    fireEvent.click(salvar);
    fireEvent.click(salvar);

    expect(apiMocks.buscarDuplicidades).toHaveBeenCalledTimes(1);
    concluirBusca?.({ success: true, data: [] });
    await waitFor(() => expect(apiMocks.criarCliente).toHaveBeenCalledTimes(1));
  });

  it('usa a API de edição e devolve o id salvo', async () => {
    const onSaved = vi.fn();
    render(
      <ClienteFormDrawer
        open
        onOpenChange={vi.fn()}
        mode="edit"
        clienteId={clienteCriado.id}
        initialValue={dadosValidos}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Silva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(apiMocks.editarCliente).toHaveBeenCalledWith(
      clienteCriado.id,
      expect.objectContaining({ nome: 'Ana Silva' })
    ));
    expect(apiMocks.criarCliente).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith({ clienteId: clienteCriado.id });
  });

  it('no modo inline valida e devolve os dados sem persistir cliente ou pedido', async () => {
    const onValidated = vi.fn();
    render(
      <ClienteFormDrawer
        open
        onOpenChange={vi.fn()}
        mode="inline-order"
        initialValue={dadosValidos}
        onValidated={onValidated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuar pedido' }));

    await waitFor(() => expect(onValidated).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Ana Souza',
      telefone: '83999999999',
    })));
    expect(apiMocks.criarCliente).not.toHaveBeenCalled();
    expect(apiMocks.editarCliente).not.toHaveBeenCalled();
  });

  it('preserva os valores em erro de serviço e bloqueia submit duplicado', async () => {
    let resolver: ((value: unknown) => void) | undefined;
    apiMocks.criarCliente.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    renderCreate();

    const salvar = screen.getByRole('button', { name: 'Salvar cliente' });
    fireEvent.click(salvar);
    await waitFor(() => expect(apiMocks.criarCliente).toHaveBeenCalledTimes(1));
    fireEvent.click(salvar);
    expect(apiMocks.criarCliente).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Ana Souza');

    resolver?.({ success: false, data: null, error: 'Não foi possível salvar o cliente.' });
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível salvar o cliente.');
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Ana Souza');
  });

  it('usa 100dvh, uma coluna no conteúdo mobile e rodapé fora da rolagem', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    renderCreate();

    const dialog = screen.getByRole('dialog', { name: 'Novo cliente' });
    expect(dialog.className).toContain('h-[100dvh]');
    expect(screen.getByTestId('cliente-form-content').className).toContain('grid-cols-1');
    expect(dialog.querySelector('[data-operational-drawer-footer]')).toBeTruthy();
    expect(dialog.querySelector('[data-operational-drawer-scroll]')?.contains(screen.getByRole('button', { name: 'Salvar cliente' }))).toBe(false);
  });

  it('não reserva altura mínima vazia no painel de contato', () => {
    renderCreate();

    const painelContato = screen.getByTestId('cliente-contato-panel');
    expect(painelContato.className).toContain('overflow-hidden');
    expect(painelContato.className).not.toContain('min-h-');
  });

  it('mantém o cancelamento como ação secundária do drawer', () => {
    renderCreate();

    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancelar.className).toContain('bg-surface-card');
    expect(cancelar.className).toContain('hover:border-accent/35');
  });
});
