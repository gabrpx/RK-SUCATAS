// @vitest-environment jsdom
// Fase 5/6: botão X com alvo de toque maior (size-12) e sem vazar o clique
// de fechar pra um overlay/modal ancestral (a raiz também ganhou seu próprio
// stopPropagation — antes só tinha onClick={onFechar} puro).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { VisualizadorFotos } from './VisualizadorFotos';

describe('VisualizadorFotos', () => {
  afterEach(() => cleanup());

  it('botão Fechar tem alvo de toque de pelo menos 48px (size-12)', () => {
    const { getByLabelText } = render(
      <VisualizadorFotos fotos={['a.jpg']} indice={0} onTrocar={vi.fn()} onFechar={vi.fn()} />
    );
    expect(getByLabelText('Fechar').className).toContain('size-12');
  });

  it('clicar no botão Fechar chama onFechar', () => {
    const onFechar = vi.fn();
    const { getByLabelText } = render(
      <VisualizadorFotos fotos={['a.jpg']} indice={0} onTrocar={vi.fn()} onFechar={onFechar} />
    );
    fireEvent.click(getByLabelText('Fechar'));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('clicar no fundo (fora da foto) chama onFechar', () => {
    const onFechar = vi.fn();
    const { getByRole } = render(
      <VisualizadorFotos fotos={['a.jpg']} indice={0} onTrocar={vi.fn()} onFechar={onFechar} />
    );
    fireEvent.click(getByRole('presentation'));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('clicar na própria foto NÃO chama onFechar', () => {
    const onFechar = vi.fn();
    const { getByAltText } = render(
      <VisualizadorFotos fotos={['a.jpg']} indice={0} onTrocar={vi.fn()} onFechar={onFechar} />
    );
    fireEvent.click(getByAltText('Foto 1'));
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('o overlay raiz é marcado data-photo-overlay (pra Modal.tsx reconhecer que não é "fora" dele)', () => {
    const { getByRole } = render(
      <VisualizadorFotos fotos={['a.jpg']} indice={0} onTrocar={vi.fn()} onFechar={vi.fn()} />
    );
    expect(getByRole('presentation').getAttribute('data-photo-overlay')).toBe('');
  });
});
