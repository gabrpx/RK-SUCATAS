// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { StateCitySelect } from './StateCitySelect';

// Mesmo padrão de Select.test.tsx / Combobox.test.tsx (Tasks 11/12): motion.tag
// vira o elemento puro, AnimatePresence some com o exit imediatamente — sem
// isso, o exit animado deixaria itens no DOM além do esperado em asserts
// síncronos (R9).
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) => {
      const C = (props: any) => {
        const { initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, ...rest } = props;
        const Tag = tag as any;
        return <Tag {...rest} />;
      };
      C.displayName = `motion.${tag}`;
      return C;
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('<StateCitySelect>', () => {
  afterEach(() => {
    cleanup();
  });

  it('trocar UF esvazia cidade', async () => {
    const onChange = vi.fn();
    render(<StateCitySelect value={{ estado: 'PB', cidade: 'Juazeirinho' }} onChange={onChange} />);
    await waitFor(() => screen.getByRole('combobox', { name: /paraíba/i }));
    fireEvent.click(screen.getByRole('combobox', { name: /paraíba/i }));
    fireEvent.click(await screen.findByText(/Pernambuco/));
    expect(onChange).toHaveBeenCalledWith({ estado: 'PE', cidade: '' });
  });

  it('mostra cidade selecionada quando UF já preenchida', async () => {
    render(<StateCitySelect value={{ estado: 'PB', cidade: 'Juazeirinho' }} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Juazeirinho/i })).toBeDefined());
  });
});
