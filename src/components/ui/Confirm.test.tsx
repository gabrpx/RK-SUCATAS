// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { ConfirmProvider } from './ConfirmProvider';
import { useConfirm } from './hooks/useConfirm';

// Confirm usa o Modal real (Radix Dialog + motion.div com exit animado) — mesmo
// mock de motion/react das outras suites de modal/sheet (R9): sem ele o exit
// fica pendurado e o texto nunca some de fato no jsdom.
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

function Probe({ onResult }: { onResult: (r: boolean) => void }) {
  const confirm = useConfirm();
  return <button onClick={async () => onResult(await confirm({ title: 'Deletar?', destructive: true }))}>ask</button>;
}

describe('useConfirm', () => {
  afterEach(() => {
    cleanup();
  });

  it('resolve true no confirm', async () => {
    const results: boolean[] = [];
    render(
      <ConfirmProvider>
        <Probe onResult={(r) => results.push(r)} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText('ask'));
    // getByRole('heading', ...), não getByText: sem `subtitulo`, o Modal real
    // duplica o título como <Description> visualmente oculto (exigência do
    // Radix Dialog de ter aria-describedby) — getByText('Deletar?') bateria
    // nos dois nós.
    await waitFor(() => screen.getByRole('heading', { name: 'Deletar?' }));
    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() => expect(results).toEqual([true]));
  });

  it('resolve false no cancelar', async () => {
    const results: boolean[] = [];
    render(
      <ConfirmProvider>
        <Probe onResult={(r) => results.push(r)} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText('ask'));
    await waitFor(() => screen.getByRole('heading', { name: 'Deletar?' }));
    fireEvent.click(screen.getByText('Cancelar'));
    await waitFor(() => expect(results).toEqual([false]));
  });
});
