// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ClienteFormModal } from './ClienteFormModal';

vi.mock('./cep', () => ({
  formatCep: (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  },
  validarCep: (c: string) => c.replace(/\D/g, '').length === 8,
  buscarCep: vi.fn(),
}));

import { buscarCep } from './cep';
const buscarCepMock = vi.mocked(buscarCep);

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
    buscarCepMock.mockResolvedValue(null);
  });

  const getCepInput = () => {
    const all = document.querySelectorAll<HTMLInputElement>('[data-cep-status]');
    return all[all.length - 1];
  };

  it('formata CEP em tempo real ao digitar', async () => {
    const onFormChange = vi.fn();
    render(<ClienteFormModal {...baseProps} onFormChange={onFormChange} />);

    fireEvent.change(getCepInput(), { target: { value: '01001000' } });

    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ cep: '01001-000' })
    );
  });

  it('mostra indicador positivo para CEP válido', async () => {
    buscarCepMock.mockResolvedValue({ cidade: 'São Paulo', uf: 'SP' });

    render(
      <ClienteFormModal
        {...baseProps}
        form={{ ...baseProps.form, cep: '01001-000' }}
      />
    );

    expect(getCepInput().getAttribute('data-cep-status')).toBe('positive');
  });

  it('mostra indicador negativo para CEP inválido parcial', () => {
    render(
      <ClienteFormModal
        {...baseProps}
        form={{ ...baseProps.form, cep: '123' }}
      />
    );

    expect(getCepInput().getAttribute('data-cep-status')).toBe('negative');
  });

  it('preenche cidade quando CEP é válido via ViaCEP', async () => {
    buscarCepMock.mockResolvedValue({ cidade: 'São Paulo', uf: 'SP' });
    const onFormChange = vi.fn();

    render(
      <ClienteFormModal
        {...baseProps}
        form={{ ...baseProps.form, cep: '01001-000' }}
        onFormChange={onFormChange}
      />
    );

    await waitFor(() => {
      expect(buscarCepMock).toHaveBeenCalledWith('01001-000');
    });

    await waitFor(() => {
      expect(onFormChange).toHaveBeenCalledWith(
        expect.objectContaining({ cidade: 'São Paulo - SP' })
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
});
