'use client';

// Portado do animate-ui (variante Radix UI). Lógica intacta; imports de alias
// @/... reescritos para caminhos relativos deste projeto.
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence, type Transition, type HTMLMotionProps } from 'motion/react';
import { X } from 'lucide-react';

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>;

function Dialog(props: DialogProps) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

type DialogTriggerProps = React.ComponentProps<typeof DialogPrimitive.Trigger>;

function DialogTrigger(props: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

type DialogPortalProps = React.ComponentProps<typeof DialogPrimitive.Portal>;

function DialogPortal(props: DialogPortalProps) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

type DialogCloseProps = React.ComponentProps<typeof DialogPrimitive.Close>;

function DialogClose(props: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

type DialogOverlayProps = HTMLMotionProps<'div'> & {
  transition?: Transition;
};

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(
  ({ transition = { duration: 0.2 }, ...props }, ref) => (
    <DialogPrimitive.Overlay asChild forceMount>
      <motion.div
        ref={ref}
        data-slot="dialog-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition}
        {...props}
      />
    </DialogPrimitive.Overlay>
  )
);
DialogOverlay.displayName = 'DialogOverlay';

type DialogContentProps = Omit<React.ComponentProps<typeof DialogPrimitive.Content>, 'asChild'> & {
  transition?: Transition;
  motionProps?: HTMLMotionProps<'div'>;
  showClose?: boolean;
  open?: boolean;
};

function DialogContent({
  children,
  transition = { type: 'spring', stiffness: 300, damping: 30 },
  motionProps,
  showClose = true,
  open,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal forceMount>
      <AnimatePresence>
        {open && (
          <>
            <DialogOverlay />
            <DialogPrimitive.Content asChild forceMount {...props}>
              <motion.div
                data-slot="dialog-content"
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={transition}
                {...motionProps}
              >
                {children}
                {showClose && (
                  <DialogClose asChild>
                    <button
                      type="button"
                      data-slot="dialog-close-btn"
                      aria-label="Fechar"
                    >
                      <X />
                    </button>
                  </DialogClose>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </>
        )}
      </AnimatePresence>
    </DialogPortal>
  );
}

type DialogHeaderProps = React.ComponentProps<'div'>;

function DialogHeader(props: DialogHeaderProps) {
  return <div data-slot="dialog-header" {...props} />;
}

type DialogFooterProps = React.ComponentProps<'div'>;

function DialogFooter(props: DialogFooterProps) {
  return <div data-slot="dialog-footer" {...props} />;
}

type DialogTitleProps = React.ComponentProps<typeof DialogPrimitive.Title>;

function DialogTitle(props: DialogTitleProps) {
  return <DialogPrimitive.Title data-slot="dialog-title" {...props} />;
}

type DialogDescriptionProps = React.ComponentProps<typeof DialogPrimitive.Description>;

function DialogDescription(props: DialogDescriptionProps) {
  return <DialogPrimitive.Description data-slot="dialog-description" {...props} />;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogProps,
  type DialogCloseProps,
  type DialogContentProps,
  type DialogDescriptionProps,
  type DialogFooterProps,
  type DialogHeaderProps,
  type DialogOverlayProps,
  type DialogPortalProps,
  type DialogTitleProps,
  type DialogTriggerProps,
};
