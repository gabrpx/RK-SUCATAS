import { useContext } from 'react';
import { ConfirmCtx } from '../ConfirmProvider';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm requer <ConfirmProvider> na árvore');
  return (opts: ConfirmOptions) => ctx.ask(opts);
}
