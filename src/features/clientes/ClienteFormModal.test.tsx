// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ClienteFormModal } from './ClienteFormModal';

const baseProps = {
  aberto: true,
  onFechar: vi.fn(),
  onSalvar: vi.fn(),
  salvando: false,
  form: {
    nome: '',
    telefone: '',
    documento: '',
    data_nascimento: '',
    origem: null as string | null,
    preferencia_contato: null as string | null,
    tags: [] as string[],
    observacoes: '',
    cidade: '',
    estado: '',
    cep: '',
  },
  onFormChange: vi.fn(),
  editando: false,
  erroForm: null as string | null,
  opcoesModelo: [] as { id: string; label: string }[],
  motosBuscaForm: [] as { id: string; nome: string }[],
  onAdicionarMoto: vi.fn(),
  onRemoverMoto: vi.fn(),
  motoBuscaSel: '',
  onMotoBuscaSelChange: vi.fn(),
  tagsTexto: '',
  onTagsTextoChange: vi.fn(),
};

describe('ClienteFormModal', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CEP formata a exibição mas armazena só dígitos', () => {
    const onFormChange = vi.fn();
    render(<ClienteFormModal {...baseProps} onFormChange={onFormChange} />);

    const input = screen.getByLabelText('CEP') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '01001000' } });

    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ cep: '01001000' })
    );
  });

  it('CEP exibe formatado a partir dos dígitos armazenados', () => {
    render(
      <ClienteFormModal
        {...baseProps}
        form={{ ...baseProps.form, cep: '01001000' }}
      />
    );

    const input = screen.getByLabelText('CEP') as HTMLInputElement;
    expect(input.value).toBe('01001-000');
  });

  it('CEP com 8 dígitos dispara onFormChange com estado + cidade estruturados', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uf: 'PB', localidade: 'Juazeirinho', bairro: 'Centro', logradouro: 'Rua A' }),
    });
    const onFormChange = vi.fn();
    const { rerender } = render(<ClienteFormModal aberto {...baseProps} onFormChange={onFormChange} />);
    rerender(<ClienteFormModal aberto {...baseProps} form={{ ...baseProps.form, cep: '58500000' }} onFormChange={onFormChange} />);
    await waitFor(() => {
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'PB', cidade: 'Juazeirinho' })
      );
    });
  });

  it('botão Salvar é o único accent preenchido', () => {
    render(<ClienteFormModal {...baseProps} />);

    const salvarBtn = screen.getByRole('button', { name: /salvar/i });
    expect(salvarBtn.className).toMatch(/accent/);

    const cancelarBtn = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelarBtn.className).not.toMatch(/bg-accent/);
  });

  it('telefone armazena só dígitos e exibe formatado', () => {
    const onFormChange = vi.fn();
    render(
      <ClienteFormModal
        {...baseProps}
        form={{ ...baseProps.form, telefone: '83999999999' }}
        onFormChange={onFormChange}
      />
    );
    const input = screen.getByLabelText('Telefone') as HTMLInputElement;
    expect(input.value).toBe('(83) 9 9999-9999');
  });

  it('documento inválido exibe erro inline via DocInput', () => {
    render(
      <ClienteFormModal
        {...baseProps}
        form={{ ...baseProps.form, documento: '11111111111' }}
      />
    );
    expect(screen.getByText('CPF inválido')).toBeTruthy();
  });
});
