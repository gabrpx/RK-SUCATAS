// @vitest-environment jsdom
// Fase 5/6: botão X do overlay em tela cheia com alvo de toque de pelo menos
// 48px (size-12), e o overlay marcado data-photo-overlay pra Modal.tsx (ou
// qualquer useClickOutside ancestral, ver TarefaCards.tsx) reconhecer que
// fechar essa imagem não é um clique "fora" do painel/modal por trás.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ImageZoom } from './image-zoom';

describe('ImageZoom', () => {
  afterEach(() => cleanup());

  // A remoção do DOM após fechar depende do fim da animação de saída do
  // AnimatePresence (motion/react), que não roda em jsdom (sem timing real de
  // rAF) — mesma limitação já aceita pelos outros testes de overlay animado
  // deste repo (ex: Sheet.test.tsx). O que dá pra provar aqui: o botão tem o
  // alvo de toque maior (Fase 5) e o clique nele não lança erro nem propaga.
  it('botão Fechar tem alvo de toque de pelo menos 48px (size-12) e responde ao clique', () => {
    const { getByLabelText, queryByLabelText } = render(<ImageZoom src="a.jpg" alt="Peça" />);
    fireEvent.click(getByLabelText('Ampliar Peça'));
    expect(queryByLabelText('Fechar')).toBeTruthy();
    expect(queryByLabelText('Fechar')!.className).toContain('size-12');

    expect(() => fireEvent.click(queryByLabelText('Fechar')!)).not.toThrow();
  });

  it('o overlay em tela cheia é marcado data-photo-overlay', () => {
    const { getByLabelText, container } = render(<ImageZoom src="a.jpg" alt="Peça" />);
    fireEvent.click(getByLabelText('Ampliar Peça'));
    expect(container.ownerDocument.querySelector('[data-photo-overlay]')).toBeTruthy();
  });
});
