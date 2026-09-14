'use client';

// Portado do animate-ui (variante Radix UI). Popover com content animado via
// Motion — paralelo ao popover.tsx existente em components/ui/.
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion, AnimatePresence, type Transition, type HTMLMotionProps } from 'motion/react';
import { X } from 'lucide-react';

type PopoverProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>;
const Popover = PopoverPrimitive.Root;

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>;
const PopoverTrigger = PopoverPrimitive.Trigger;

type PopoverCloseProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Close>;
const PopoverClose = PopoverPrimitive.Close;

type PopoverAnchorProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Anchor>;
const PopoverAnchor = PopoverPrimitive.Anchor;

type PopoverContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>,
  'asChild'
> & {
  transition?: Transition;
  motionProps?: HTMLMotionProps<'div'>;
  showClose?: boolean;
  open?: boolean;
};

function PopoverContent({
  children,
  transition = { type: 'spring', stiffness: 400, damping: 30 },
  motionProps,
  showClose = false,
  sideOffset = 4,
  open,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal forceMount>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Content asChild forceMount sideOffset={sideOffset} {...props}>
            <motion.div
              data-slot="popover-content"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={transition}
              {...motionProps}
            >
              {children}
              {showClose && (
                <PopoverClose asChild>
                  <button type="button" aria-label="Fechar">
                    <X />
                  </button>
                </PopoverClose>
              )}
            </motion.div>
          </PopoverPrimitive.Content>
        )}
      </AnimatePresence>
    </PopoverPrimitive.Portal>
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
  PopoverAnchor,
  type PopoverProps,
  type PopoverTriggerProps,
  type PopoverContentProps,
  type PopoverCloseProps,
  type PopoverAnchorProps,
};
