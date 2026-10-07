import * as React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { SPRING_SHEET } from './motion';
import { OperationalTokensContext } from './operationalTokens';

export interface OperationalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  size?: 'default' | 'wide';
  footer?: React.ReactNode;
  portalStyle?: React.CSSProperties;
  children: React.ReactNode;
}

const Z_DRAWER = { zIndex: 'var(--z-modal)' } as React.CSSProperties;
export function OperationalDrawer({
  open,
  onOpenChange,
  title,
  description,
  size = 'default',
  footer,
  portalStyle,
  children,
}: OperationalDrawerProps) {
  const reduceMotion = useReducedMotion();
  const contextTokens = React.useContext(OperationalTokensContext);
  const portalTokens = { ...contextTokens, ...portalStyle };
  const wasOpen = React.useRef(false);
  const returnFocusTo = React.useRef<HTMLElement | null>(null);

  if (open && !wasOpen.current && typeof document !== 'undefined') {
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  React.useEffect(() => {
    if (!open && wasOpen.current) {
      returnFocusTo.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                data-testid="operational-drawer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
                style={{ ...portalTokens, ...Z_DRAWER }}
                className="fixed inset-0 bg-overlay-scrim backdrop-blur-[1px]"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.aside
                initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
                animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
                transition={reduceMotion ? { duration: 0 } : SPRING_SHEET}
                style={{ ...portalTokens, ...Z_DRAWER }}
                className={`fixed inset-y-0 right-0 flex h-[100dvh] w-full flex-col overflow-hidden border-l border-border-default bg-surface-card font-[Geist,Inter,ui-sans-serif,system-ui,sans-serif] text-text-primary shadow-lg outline-none ${size === 'wide' ? 'max-w-[760px]' : 'max-w-[32rem]'}`}
              >
                <div className="z-10 flex shrink-0 items-start justify-between gap-3 border-b border-border-default bg-surface-card p-4 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.75rem))] sm:py-4">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="break-words text-base font-semibold tracking-tight text-text-primary">
                      {title}
                    </DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="mt-1 text-sm leading-5 text-text-muted">
                        {description}
                      </DialogPrimitive.Description>
                    ) : (
                      <VisuallyHidden.Root asChild>
                        <DialogPrimitive.Description>{title}</DialogPrimitive.Description>
                      </VisuallyHidden.Root>
                    )}
                  </div>
                  <DialogPrimitive.Close
                    aria-label="Fechar"
                    className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-control text-text-muted transition hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  >
                    <X aria-hidden="true" size={18} />
                  </DialogPrimitive.Close>
                </div>
                <div data-operational-drawer-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                  {children}
                </div>
                {footer ? (
                  <div
                    data-operational-drawer-footer
                    className="z-10 shrink-0 border-t border-border-default bg-surface-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
                  >
                    {footer}
                  </div>
                ) : null}
              </motion.aside>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
