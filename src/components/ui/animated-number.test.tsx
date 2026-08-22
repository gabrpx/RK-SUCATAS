// @vitest-environment jsdom
// O que importa garantir aqui não é o caminho da animação (isso é spring, roda
// em rAF e não dá pra afirmar quadro a quadro), e sim que o número SEMPRE
// termina no valor certo e formatado — inclusive quando o valor muda depois de
// montado e quando a contagem só deve começar ao entrar na tela.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AnimatedNumber } from './animated-number';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

describe('AnimatedNumber', () => {
  it('chega ao valor final formatado', async () => {
    render(<AnimatedNumber value={93805} format={formatCurrency} />);

    await waitFor(() => expect(screen.getByText('R$ 93.805,00')).toBeTruthy());
  });

  it('sem `format`, arredonda pra inteiro', async () => {
    render(<AnimatedNumber value={117} />);

    await waitFor(() => expect(screen.getByText('117')).toBeTruthy());
  });

  it('reanima até o novo valor quando a prop muda', async () => {
    const { rerender } = render(<AnimatedNumber value={10} />);
    await waitFor(() => expect(screen.getByText('10')).toBeTruthy());

    rerender(<AnimatedNumber value={42} />);
    await waitFor(() => expect(screen.getByText('42')).toBeTruthy());
  });

  it('com `inView`, ainda assim chega ao valor final quando o elemento está visível', async () => {
    // O polyfill de IntersectionObserver do setup responde "visível" na hora
    // (jsdom não tem layout), então isto cobre o caminho de quem rolou até o card.
    render(<AnimatedNumber value={7} inView />);

    await waitFor(() => expect(screen.getByText('7')).toBeTruthy());
  });
});
