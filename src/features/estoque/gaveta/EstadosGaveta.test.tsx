// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErroEstadoGavetas, SemPermissaoGavetas, ehErroDePermissao } from './EstadosGaveta';

afterEach(cleanup);

describe('ehErroDePermissao', () => {
  it('reconhece 403 e mensagens de permissão', () => {
    expect(ehErroDePermissao('Request failed 403')).toBe(true);
    expect(ehErroDePermissao('Sem permissão para acessar')).toBe(true);
    expect(ehErroDePermissao('Não autorizado')).toBe(true);
    expect(ehErroDePermissao('Falha de rede')).toBe(false);
    expect(ehErroDePermissao(null)).toBe(false);
  });
});

describe('ErroEstadoGavetas', () => {
  it('mostra a mensagem e chama "Tentar novamente"', () => {
    const onTentar = vi.fn();
    render(<ErroEstadoGavetas mensagem="Falha de rede" onTentarNovamente={onTentar} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Falha de rede/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onTentar).toHaveBeenCalledTimes(1);
  });
});

describe('SemPermissaoGavetas', () => {
  it('orienta o usuário sem oferecer retry', () => {
    render(<SemPermissaoGavetas />);
    expect(screen.getByText(/sem permissão/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).toBeNull();
  });
});
