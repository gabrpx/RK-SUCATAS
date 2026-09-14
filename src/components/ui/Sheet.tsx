// Sheet — bottom-sheet no mobile (respeita safe-area), side sheet à direita
// no desktop. Reaproveita a mesma mecânica do Modal (Radix Dialog: foco
// preso, Esc, scroll-lock) mas com entrada/saída deslizante em vez de
// fade+scale central — uso típico é formulário longo ou painel de detalhe,
// não uma confirmação curta (isso é o Modal).
import * as React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** default: bottom (mobile-first); 'right' pro side sheet de desktop */
  side?: 'bottom' | 'right';
  children: React.ReactNode;
}

export function Sheet({ isOpen, onClose, title, side = 'bottom', children }: SheetProps) {
  const bottom = side === 'bottom';
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AnimatePresence>
        {isOpen && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-overlay-scrim"
                style={{ zIndex: 'var(--z-modal)' as unknown as number }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={bottom ? { y: '100%' } : { x: '100%' }}
                animate={bottom ? { y: 0 } : { x: 0 }}
                exit={bottom ? { y: '100%' } : { x: '100%' }}
                transition={SPRING_SHEET}
                className={cn(
                  'fixed bg-surface-card border-border-default text-text-primary shadow-elevation-4 outline-none',
                  bottom
                    ? 'left-0 right-0 bottom-0 rounded-t-[24px] pb-[env(safe-area-inset-bottom)] max-h-[85vh] overflow-y-auto border-t'
                    : 'top-0 right-0 bottom-0 w-[400px] max-w-[95vw] border-l overflow-y-auto'
                )}
                style={{ zIndex: 'var(--z-modal)' as unknown as number }}
              >
                <div className="p-4 flex items-center justify-between border-b border-border-default/50">
                  {title ? (
                    <DialogPrimitive.Title asChild>
                      <h3 className="text-base font-bold">{title}</h3>
                    </DialogPrimitive.Title>
                  ) : (
                    <VisuallyHidden.Root asChild>
                      <DialogPrimitive.Title>Sheet</DialogPrimitive.Title>
                    </VisuallyHidden.Root>
                  )}
                  <DialogPrimitive.Close aria-label="Fechar" className="p-2 rounded-xl hover:bg-surface-raised text-text-muted">
                    <X size={18} />
                  </DialogPrimitive.Close>
                </div>
                <VisuallyHidden.Root asChild>
                  <DialogPrimitive.Description>Conteúdo do sheet</DialogPrimitive.Description>
                </VisuallyHidden.Root>
                <div className="p-4">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
