// @vitest-environment jsdom
// Fase 6: fechar um overlay de imagem (ImageZoom/VisualizadorFotos) aberto
// POR CIMA de um Modal não pode fechar o modal por trás — mesmo esse overlay
// renderizando via portal fora da árvore DOM do Dialog.Content (o que faz o
// DismissableLayer do Radix tratar qualquer clique nele como "fora" do
// modal, sem a exceção via data-photo-overlay em onPointerDownOutside).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal — fechar', () => {
  afterEach(() => cleanup());

  it('clicar no fundo (overlay) fecha o modal', () => {
    const onFechar = vi.fn();
    const { container } = render(
      <Modal aberto onFechar={onFechar} titulo="Teste">
        <p>conteúdo</p>
      </Modal>
    );
    const overlay = container.querySelector('[data-radix-dialog-overlay], [class*="fixed inset-0"]') || document.querySelector('div[style*="z-index"]');
    fireEvent.click(overlay!);
    expect(onFechar).toHaveBeenCalled();
  });

  it('clicar dentro do conteúdo NÃO fecha o modal', () => {
    const onFechar = vi.fn();
    const { getByText } = render(
      <Modal aberto onFechar={onFechar} titulo="Teste">
        <p>conteúdo do modal</p>
      </Modal>
    );
    fireEvent.click(getByText('conteúdo do modal'));
    expect(onFechar).not.toHaveBeenCalled();
  });
});

// A exceção de onPointerDownOutside/onInteractOutside pra elementos
// [data-photo-overlay] (Fase 6 — ImageZoom/VisualizadorFotos abertos por
// cima do modal não devem fechá-lo) depende do DismissableLayer real do
// Radix, que reage a um pointerdown nativo no documento — fireEvent do
// testing-library não reproduz esse listener em jsdom (uma versão anterior
// deste teste "passava" sem a exceção implementada, ou seja, não provava
// nada). Verificado manualmente no navegador em vez disso — ver checkpoint
// da Fase 6.
