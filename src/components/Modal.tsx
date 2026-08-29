import React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { SPRING_SHEET } from './ui/motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  footer?: React.ReactNode;
}

const MotionContent = motion(DialogPrimitive.Content);

export const Modal: React.FC<ModalProps> = ({
  isOpen, onClose, title, children, maxWidth = 'max-w-2xl',
  icon, iconBgColor = 'bg-surface-raised/50', iconColor = 'text-text-muted', footer,
}) => {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-overlay-scrim backdrop-blur-sm animate-in fade-in duration-200"
          style={{ zIndex: 'var(--z-modal)' as unknown as number }}
        />
        <MotionContent
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={SPRING_SHEET}
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] rounded-modal border shadow-elevation-4 overflow-hidden flex flex-col outline-none',
            maxWidth,
            'bg-surface-card border-border-default text-text-primary'
          )}
          style={{ zIndex: 'var(--z-modal)' as unknown as number }}
        >
          <div className="p-6 border-b border-border-default/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {icon && (
                <div className={cn('p-2 rounded-xl', iconBgColor, iconColor)}>{icon}</div>
              )}
              {title ? (
                <DialogPrimitive.Title asChild>
                  <h3 className="text-lg font-bold">{title}</h3>
                </DialogPrimitive.Title>
              ) : (
                <VisuallyHidden.Root asChild>
                  <DialogPrimitive.Title>Diálogo</DialogPrimitive.Title>
                </VisuallyHidden.Root>
              )}
            </div>
            <DialogPrimitive.Close
              className="p-2 rounded-xl transition-colors hover:bg-surface-raised text-text-muted"
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>
          <VisuallyHidden.Root asChild>
            <DialogPrimitive.Description>Conteúdo do diálogo</DialogPrimitive.Description>
          </VisuallyHidden.Root>
          <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">{children}</div>
          {footer && (
            <div className="p-6 border-t border-border-default/50 bg-surface-inset/20 flex items-center justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </MotionContent>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
