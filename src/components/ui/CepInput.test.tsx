// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CepInput } from './CepInput';

describe('<CepInput>', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uf: 'PB', localidade: 'Juazeirinho', bairro: 'Centro', logradouro: 'Rua A' }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('formata CEP como 12345-678', () => {
    render(<CepInput label="CEP" value="58500000" onChange={() => {}} />);
    expect((screen.getByLabelText('CEP') as HTMLInputElement).value).toBe('58500-000');
  });

  it('chama onAutoFill quando CEP atinge 8 dígitos', async () => {
    const onAutoFill = vi.fn();
    const { rerender } = render(
      <CepInput label="CEP" value="" onChange={() => {}} onAutoFill={onAutoFill} />
    );
    rerender(<CepInput label="CEP" value="58500000" onChange={() => {}} onAutoFill={onAutoFill} />);
    await waitFor(() =>
      expect(onAutoFill).toHaveBeenCalledWith({
        estado: 'PB', cidade: 'Juazeirinho', bairro: 'Centro', rua: 'Rua A',
      })
    );
  });
});
