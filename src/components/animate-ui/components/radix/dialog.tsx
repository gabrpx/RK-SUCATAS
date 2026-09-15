// Wrapper estilizado do Dialog Radix + Motion, seguindo o mesmo padrão do
// Modal.tsx existente (asChild + motion.div, sem AnimatePresence — o Radix
// controla o mount/unmount e a animação de entrada já é suficiente).
// Tokens do design system aplicados aqui, nunca hex direto.
import * as React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { cn } from '../../../../utils';

type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;
const Dialog = DialogPrimitive.Root;

type DialogTriggerProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>;
const DialogTrigger = DialogPrimitive.Trigger;

type DialogCloseProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>;
const DialogClose = DialogPrimitive.Close;

// O overlay captura cliques fora e fecha o dialog; stopPropagation impede
// que o clique dentro do Content o feche também.
type DialogContentProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footerClassName?: string;
};

// Menus e visualizadores de foto são renderizados em portals fora do Content.
// Sem esta exceção, o DismissableLayer do Radix os interpreta como clique
// externo e fecha o diálogo que está por baixo antes de a ação ser concluída.
function interacaoPertenceASobreposicaoDoDialog(event: {
  target?: EventTarget | null;
  detail?: { originalEvent?: { target?: EventTarget | null } };
}) {
  const alvoReal = (event.detail?.originalEvent?.target ?? event.target) as HTMLElement | null;
  return Boolean(alvoReal?.closest?.('[data-photo-overlay], [data-slot="dropdown-menu-content"]'));
}

function DialogContent({ open, onClose, title, description, children, className }: DialogContentProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-overlay-scrim backdrop-blur-sm flex items-end md:items-center justify-center md:p-4"
          style={{ zIndex: 'var(--z-modal)' as unknown as number }}
          onClick={onClose}
        >
          <DialogPrimitive.Content
            asChild
            onClick={(e) => e.stopPropagation()}
            onPointerDownOutside={(e) => {
              if (interacaoPertenceASobreposicaoDoDialog(e)) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (interacaoPertenceASobreposicaoDoDialog(e)) e.preventDefault();
            }}
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              className={cn(
                'relative w-full flex flex-col overflow-hidden',
                'bg-surface-card border border-border-subtle shadow-elevated-lg outline-none',
                'max-h-[92dvh] md:max-h-[88dvh] rounded-t-modal md:rounded-card md:max-w-2xl',
                className
              )}
            >
              <VisuallyHidden.Root asChild>
                <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              </VisuallyHidden.Root>
              {description && (
                <VisuallyHidden.Root asChild>
                  <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
                </VisuallyHidden.Root>
              )}
              {children}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type DialogCloseButtonProps = { className?: string };

function DialogCloseButton({ className }: DialogCloseButtonProps) {
  return (
    <DialogPrimitive.Close asChild>
      <button
        type="button"
        aria-label="Fechar"
        className={cn(
          'absolute right-3 top-3 p-1.5 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors z-10',
          className
        )}
      >
        <X size={15} />
      </button>
    </DialogPrimitive.Close>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogCloseButton,
  type DialogProps,
  type DialogTriggerProps,
  type DialogCloseProps,
  type DialogContentProps,
  type DialogCloseButtonProps,
};
