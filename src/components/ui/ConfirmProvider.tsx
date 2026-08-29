// Estado global de um único Confirm pendente por vez — cobre o caso comum
// (perguntar antes de excluir/cancelar) sem precisar empilhar diálogos.
import * as React from 'react';
import { Confirm } from './Confirm';

interface State {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve?: (r: boolean) => void;
}

interface Ctx { ask: (opts: Omit<State, 'isOpen' | 'resolve'>) => Promise<boolean> }
export const ConfirmCtx = React.createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>({ isOpen: false, title: '' });

  const ask = React.useCallback((opts: Omit<State, 'isOpen' | 'resolve'>) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, isOpen: true, resolve });
    });
  }, []);

  const onResolve = (r: boolean) => {
    state.resolve?.(r);
    setState((s) => ({ ...s, isOpen: false }));
  };

  return (
    <ConfirmCtx.Provider value={{ ask }}>
      {children}
      <Confirm
        isOpen={state.isOpen}
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        destructive={state.destructive}
        onResolve={onResolve}
      />
    </ConfirmCtx.Provider>
  );
}
