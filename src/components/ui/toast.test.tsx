// @vitest-environment jsdom
import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Toaster, aviso } from './toast';

afterEach(cleanup);

describe('toast API (baseline)', () => {
  it('renderiza <Toaster /> sem crashar', () => {
    expect(() => render(<Toaster />)).not.toThrow();
  });

  it('expõe aviso.sucesso/erro/atencao/info/falha/carregando', () => {
    expect(aviso.sucesso).toBeInstanceOf(Function);
    expect(aviso.erro).toBeInstanceOf(Function);
    expect(aviso.atencao).toBeInstanceOf(Function);
    expect(aviso.info).toBeInstanceOf(Function);
    expect(aviso.falha).toBeInstanceOf(Function);
    expect(aviso.carregando).toBeInstanceOf(Function);
  });

  it('dispara os avisos existentes sem opções extra e sem crashar', () => {
    render(<Toaster />);
    act(() => {
      aviso.sucesso('ok');
      aviso.erro('erro');
      aviso.atencao('atencao');
      aviso.info('info');
      aviso.falha(new Error('falhou'));
      aviso.carregando(Promise.resolve(1), { carregando: 'salvando', sucesso: 'salvo' });
    });
  });

  it('aceita descricao/acao/duracao (API já existente) sem crashar', () => {
    render(<Toaster />);
    act(() => {
      aviso.sucesso('venda concluída', {
        descricao: 'R$ 100,00',
        acao: { label: 'Desfazer', onClick: vi.fn() },
        duracao: 3000,
      });
    });
  });
});

describe('toast API (withSparkles opt-in)', () => {
  it('aviso.sucesso com withSparkles: true não crasha (Sparkles é lazy)', () => {
    render(<Toaster />);
    expect(() => {
      act(() => {
        aviso.sucesso('venda concluída', { withSparkles: true });
      });
    }).not.toThrow();
  });

  it('aviso.sucesso sem withSparkles continua igual (sem opt-in)', () => {
    render(<Toaster />);
    expect(() => {
      act(() => {
        aviso.sucesso('venda concluída');
      });
    }).not.toThrow();
  });
});
