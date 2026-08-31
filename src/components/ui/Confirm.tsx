// Diálogo de confirmação padrão do app — substitui window.confirm (que trava
// a thread do JS e não tem estilo nenhum). Usa o Modal real (Radix Dialog por
// baixo, API em português: aberto/onFechar/titulo/rodape/tamanho) em vez do
// Modal.tsx que o brief original citava — aquele arquivo foi removido como
// código morto na Task 18b.
import * as React from 'react';
import { Modal } from '@/src/components/ui/Modal';
import { cn } from '@/src/utils';

interface ConfirmProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onResolve: (result: boolean) => void;
}

export function Confirm({
  isOpen, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive, onResolve,
}: ConfirmProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  return (
    <Modal
      aberto={isOpen}
      onFechar={() => onResolve(false)}
      titulo={title}
      tamanho="sm"
      rodape={
        <div className="grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            onClick={() => onResolve(false)}
            className="px-4 py-2 rounded-control border border-border-default text-text-primary hover:bg-surface-raised"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onResolve(true)}
            className={cn(
              'px-4 py-2 rounded-control text-white',
              destructive ? 'bg-danger hover:bg-danger/90' : 'bg-accent hover:bg-accent/90'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {description && <p className="text-sm text-text-secondary">{description}</p>}
    </Modal>
  );
}
